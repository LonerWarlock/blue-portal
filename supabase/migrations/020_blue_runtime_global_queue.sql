-- Distributed Blue direct-runtime admission queue.
--
-- This is a control-plane queue only. It stores model/admission metadata and
-- never receives prompts, source code, tool output, or model responses.

alter table public.blue_runtime_tasks
  add column if not exists requested_blue_credits numeric(18, 10) not null default 0
    check (requested_blue_credits >= 0),
  add column if not exists queued_at timestamptz,
  add column if not exists queue_expires_at timestamptz,
  add column if not exists provisioning_started_at timestamptz,
  add column if not exists execution_released_at timestamptz,
  add column if not exists provider_generation_id text;

update public.blue_runtime_tasks
  set requested_blue_credits = reserved_blue_credits
  where requested_blue_credits = 0 and reserved_blue_credits > 0;

alter table public.blue_runtime_tasks
  drop constraint if exists blue_runtime_tasks_state_check;
alter table public.blue_runtime_tasks
  add constraint blue_runtime_tasks_state_check
    check (state in (
      'queued', 'provisioning', 'active', 'stopping',
      'completed', 'cancelled', 'failed', 'expired'
    ));

create index if not exists blue_runtime_tasks_global_execution_idx
  on public.blue_runtime_tasks (state, expires_at, execution_released_at)
  where state in ('provisioning', 'active', 'stopping');

create index if not exists blue_runtime_tasks_queue_idx
  on public.blue_runtime_tasks (access_tier, queued_at, request_id)
  where state = 'queued';

create table if not exists public.blue_runtime_queue_scheduler (
  singleton boolean primary key default true check (singleton),
  paid_streak integer not null default 0 check (paid_streak between 0 and 3),
  updated_at timestamptz not null default now()
);

insert into public.blue_runtime_queue_scheduler (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.blue_runtime_queue_scheduler enable row level security;
revoke all on public.blue_runtime_queue_scheduler from anon, authenticated;

-- Promote queued work while holding one global transaction lock. Three paid
-- tasks may be selected consecutively, after which the oldest eligible trial
-- task receives a slot. Per-account concurrency remains 1 for trial and 3 for
-- paid accounts. Reservations are created only when a task receives a slot.
create or replace function public.promote_blue_runtime_queue(
  global_limit_param integer,
  promotion_limit_param integer,
  active_expires_at_param timestamptz
) returns jsonb as $$
declare
  global_limit integer := greatest(1, least(coalesce(global_limit_param, 100), 10000));
  promotion_limit integer := greatest(1, least(coalesce(promotion_limit_param, 25), 250));
  occupied_count integer := 0;
  promoted_count integer := 0;
  paid_streak_value integer := 0;
  candidate public.blue_runtime_tasks%rowtype;
  reservation jsonb;
  promoted_ids text[] := array[]::text[];
begin
  perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));

  update public.blue_runtime_tasks
     set state = 'expired',
         terminal_reason = 'queue_timeout',
         updated_at = now(),
         finished_at = now()
   where state = 'queued'
     and queue_expires_at <= now();

  select paid_streak into paid_streak_value
    from public.blue_runtime_queue_scheduler
   where singleton = true
   for update;
  paid_streak_value := coalesce(paid_streak_value, 0);

  select count(*) into occupied_count
    from public.blue_runtime_tasks
   where expires_at > now()
     and (
       state in ('provisioning', 'active')
       or (state = 'stopping' and execution_released_at is null)
     );

  while occupied_count < global_limit and promoted_count < promotion_limit loop
    candidate := null;

    if paid_streak_value >= 3 then
      select queued.* into candidate
        from public.blue_runtime_tasks queued
       where queued.state = 'queued'
         and queued.queue_expires_at > now()
         and queued.access_tier = 'trial'
         and (
           select count(*) from public.blue_runtime_tasks running
            where running.user_id = queued.user_id
              and running.expires_at > now()
              and (
                running.state in ('provisioning', 'active')
                or (running.state = 'stopping' and running.execution_released_at is null)
              )
         ) < 1
       order by queued.queued_at, queued.request_id
       for update skip locked
       limit 1;
    end if;

    if candidate.request_id is null then
      select queued.* into candidate
        from public.blue_runtime_tasks queued
       where queued.state = 'queued'
         and queued.queue_expires_at > now()
         and queued.access_tier = 'full'
         and (
           select count(*) from public.blue_runtime_tasks running
            where running.user_id = queued.user_id
              and running.expires_at > now()
              and (
                running.state in ('provisioning', 'active')
                or (running.state = 'stopping' and running.execution_released_at is null)
              )
         ) < 3
       order by queued.queued_at, queued.request_id
       for update skip locked
       limit 1;
    end if;

    if candidate.request_id is null then
      select queued.* into candidate
        from public.blue_runtime_tasks queued
       where queued.state = 'queued'
         and queued.queue_expires_at > now()
         and queued.access_tier = 'trial'
         and (
           select count(*) from public.blue_runtime_tasks running
            where running.user_id = queued.user_id
              and running.expires_at > now()
              and (
                running.state in ('provisioning', 'active')
                or (running.state = 'stopping' and running.execution_released_at is null)
              )
         ) < 1
       order by queued.queued_at, queued.request_id
       for update skip locked
       limit 1;
    end if;

    exit when candidate.request_id is null;

    begin
      reservation := public.reserve_blue_credits(
        candidate.user_id,
        candidate.request_id,
        candidate.model,
        candidate.requested_blue_credits
      );

      if coalesce((reservation->>'accepted')::boolean, false) is true then
        update public.blue_runtime_tasks
           set state = 'provisioning',
               reserved_blue_credits = candidate.requested_blue_credits,
               provisioning_started_at = now(),
               expires_at = active_expires_at_param,
               updated_at = now()
         where request_id = candidate.request_id
           and state = 'queued';

        update public.billing_reservations
           set expires_at = active_expires_at_param + interval '10 minutes'
         where request_id = candidate.request_id
           and user_id = candidate.user_id
           and status = 'pending';

        occupied_count := occupied_count + 1;
        promoted_count := promoted_count + 1;
        promoted_ids := array_append(promoted_ids, candidate.request_id);
        if candidate.access_tier = 'full' then
          paid_streak_value := least(3, paid_streak_value + 1);
        else
          paid_streak_value := 0;
        end if;
      else
        update public.blue_runtime_tasks
           set state = 'failed',
               terminal_reason = 'billing_reservation_unavailable',
               updated_at = now(),
               finished_at = now()
         where request_id = candidate.request_id
           and state = 'queued';
      end if;
    exception when others then
      update public.blue_runtime_tasks
         set state = 'failed',
             terminal_reason = case
               when sqlerrm ilike '%insufficient%' then 'insufficient_blue_credits'
               else 'billing_reservation_failed'
             end,
             updated_at = now(),
             finished_at = now()
       where request_id = candidate.request_id
         and state = 'queued';
    end;
  end loop;

  update public.blue_runtime_queue_scheduler
     set paid_streak = paid_streak_value,
         updated_at = now()
   where singleton = true;

  return jsonb_build_object(
    'promoted', promoted_count,
    'promoted_request_ids', to_jsonb(promoted_ids),
    'occupied', occupied_count,
    'capacity', global_limit
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admit_blue_runtime_task_v2(
  user_id_param uuid,
  request_id_param text,
  device_hash_param text,
  payload_hash_param text,
  model_param text,
  mode_param text,
  is_free_param boolean,
  access_tier_param text,
  amount_param numeric,
  global_limit_param integer,
  queue_limit_param integer,
  queue_expires_at_param timestamptz,
  active_expires_at_param timestamptz
) returns jsonb as $$
declare
  task_record public.blue_runtime_tasks%rowtype;
  queue_count integer := 0;
  queue_position integer := 0;
  remaining_balance numeric := 0;
begin
  if request_id_param is null or request_id_param !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' then
    raise exception 'Invalid request ID';
  end if;
  if length(device_hash_param) <> 64 or length(payload_hash_param) <> 64 then
    raise exception 'Invalid runtime identity';
  end if;
  if mode_param not in ('normal', 'ui_max') then raise exception 'Invalid runtime mode'; end if;
  if access_tier_param not in ('trial', 'full') then raise exception 'Invalid access tier'; end if;
  if amount_param is null or amount_param < 0 then raise exception 'Invalid runtime allowance'; end if;
  if queue_expires_at_param <= now() or active_expires_at_param <= now() then
    raise exception 'Invalid runtime expiry';
  end if;

  perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));

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
  else
    update public.blue_runtime_tasks
       set state = 'expired', terminal_reason = 'queue_timeout', updated_at = now(), finished_at = now()
     where state = 'queued' and queue_expires_at <= now();

    select count(*) into queue_count
      from public.blue_runtime_tasks
     where state = 'queued' and queue_expires_at > now();
    if queue_count >= greatest(1, least(coalesce(queue_limit_param, 500), 10000)) then
      raise exception 'Blue runtime queue is full';
    end if;

    insert into public.blue_runtime_tasks (
      request_id, user_id, device_hash, payload_hash, model, mode, is_free,
      access_tier, state, requested_blue_credits, reserved_blue_credits,
      queued_at, queue_expires_at, expires_at, last_heartbeat_at
    ) values (
      request_id_param, user_id_param, device_hash_param, payload_hash_param,
      model_param, mode_param, is_free_param, access_tier_param, 'queued',
      amount_param, 0, now(), queue_expires_at_param, queue_expires_at_param, null
    );
  end if;

  perform public.promote_blue_runtime_queue(
    global_limit_param,
    greatest(1, least(coalesce(global_limit_param, 100), 250)),
    active_expires_at_param
  );

  select * into task_record
    from public.blue_runtime_tasks
   where request_id = request_id_param;

  if task_record.state = 'queued' then
    select count(*) into queue_position
      from public.blue_runtime_tasks queued
     where queued.state = 'queued'
       and queued.queue_expires_at > now()
       and (queued.queued_at, queued.request_id) <= (task_record.queued_at, task_record.request_id);
  end if;

  select coalesce(blue_credits, 0) into remaining_balance
    from public.wallets where user_id = user_id_param;

  return jsonb_build_object(
    'accepted', true,
    'conflict', false,
    'state', task_record.state,
    'reserved', task_record.reserved_blue_credits,
    'remaining', coalesce(remaining_balance, 0),
    'queue_position', case when task_record.state = 'queued' then queue_position else null end,
    'queue_expires_at', task_record.queue_expires_at,
    'expires_at', task_record.expires_at
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.promote_blue_runtime_queue(integer, integer, timestamptz) from public;
revoke all on function public.admit_blue_runtime_task_v2(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz) from public;
grant execute on function public.promote_blue_runtime_queue(integer, integer, timestamptz) to service_role;
grant execute on function public.admit_blue_runtime_task_v2(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz) to service_role;
