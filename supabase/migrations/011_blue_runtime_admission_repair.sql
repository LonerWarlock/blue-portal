-- Repair Blue runtime admissions that have a valid pending billing reservation
-- but no matching runtime task. This can happen when a request ID survives an
-- interrupted rollout between the billing reservation and runtime task models.
-- Replays reuse the existing reservation and never deduct Blue Credits twice.

create or replace function public.admit_blue_runtime_task(
  user_id_param uuid,
  request_id_param text,
  device_hash_param text,
  payload_hash_param text,
  model_param text,
  mode_param text,
  is_free_param boolean,
  access_tier_param text,
  amount_param numeric,
  concurrency_limit_param integer,
  expires_at_param timestamptz
) returns jsonb as $$
declare
  task_record public.blue_runtime_tasks%rowtype;
  reservation_record public.billing_reservations%rowtype;
  reservation jsonb;
  active_count integer;
  effective_reservation numeric;
  recovered_orphan boolean := false;
begin
  if request_id_param is null or request_id_param !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' then
    raise exception 'Invalid request ID';
  end if;
  if length(device_hash_param) <> 64 or length(payload_hash_param) <> 64 then
    raise exception 'Invalid runtime identity';
  end if;
  if mode_param not in ('normal', 'ui_max') then
    raise exception 'Invalid runtime mode';
  end if;
  if access_tier_param not in ('trial', 'full') then
    raise exception 'Invalid access tier';
  end if;
  if amount_param is null or amount_param < 0 then
    raise exception 'Invalid runtime allowance';
  end if;

  perform pg_advisory_xact_lock(hashtext(user_id_param::text));

  select * into task_record
    from public.blue_runtime_tasks
    where request_id = request_id_param
    for update;

  if task_record.request_id is not null then
    if task_record.user_id <> user_id_param then
      raise exception 'Request ID already belongs to another user';
    end if;
    if task_record.device_hash <> device_hash_param
       or task_record.payload_hash <> payload_hash_param
       or task_record.model <> model_param
       or task_record.mode <> mode_param
       or task_record.is_free <> is_free_param then
      return jsonb_build_object('accepted', false, 'conflict', true, 'state', task_record.state);
    end if;
    return jsonb_build_object(
      'accepted', false,
      'conflict', false,
      'state', task_record.state,
      'reserved', task_record.reserved_blue_credits,
      'expires_at', task_record.expires_at
    );
  end if;

  select count(*) into active_count
    from public.blue_runtime_tasks
    where user_id = user_id_param
      and state in ('provisioning', 'active', 'stopping')
      and expires_at > now();
  if active_count >= greatest(1, concurrency_limit_param) then
    raise exception 'Blue runtime concurrency limit reached';
  end if;

  reservation := public.reserve_blue_credits(
    user_id_param,
    request_id_param,
    model_param,
    amount_param
  );

  if coalesce((reservation->>'accepted')::boolean, false) is true then
    effective_reservation := amount_param;
  else
    -- A pending reservation with no task is a recoverable, already-paid
    -- admission. Lock and validate it before creating the missing task.
    select * into reservation_record
      from public.billing_reservations
      where request_id = request_id_param
      for update;

    if reservation_record.request_id is null then
      raise exception 'Blue runtime reservation was not persisted';
    end if;
    if reservation_record.user_id <> user_id_param then
      raise exception 'Request ID already belongs to another user';
    end if;
    if reservation_record.model <> model_param then
      raise exception 'Request ID model does not match the original request';
    end if;
    if reservation_record.status <> 'pending' then
      return jsonb_build_object(
        'accepted', false,
        'conflict', true,
        'terminal', true,
        'state', reservation_record.status,
        'reserved', reservation_record.reserved_blue_credits
      );
    end if;

    effective_reservation := reservation_record.reserved_blue_credits;
    recovered_orphan := true;
  end if;

  insert into public.blue_runtime_tasks (
    request_id, user_id, device_hash, payload_hash, model, mode, is_free,
    access_tier, state, reserved_blue_credits, expires_at
  ) values (
    request_id_param, user_id_param, device_hash_param, payload_hash_param,
    model_param, mode_param, is_free_param, access_tier_param, 'provisioning',
    effective_reservation, expires_at_param
  );

  update public.billing_reservations
    set expires_at = expires_at_param + interval '10 minutes'
    where request_id = request_id_param and user_id = user_id_param;

  return jsonb_build_object(
    'accepted', true,
    'conflict', false,
    'recovered', recovered_orphan,
    'state', 'provisioning',
    'reserved', effective_reservation,
    'remaining', reservation->'remaining',
    'expires_at', expires_at_param
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.admit_blue_runtime_task(uuid, text, text, text, text, text, boolean, text, numeric, integer, timestamptz) from public;
grant execute on function public.admit_blue_runtime_task(uuid, text, text, text, text, text, boolean, text, numeric, integer, timestamptz) to service_role;
