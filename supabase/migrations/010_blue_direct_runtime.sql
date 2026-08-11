-- Blue Direct OpenRouter Runtime.
--
-- The portal stores only control-plane and billing metadata. Prompts, source
-- code, tool output, provider output, and project memory are never stored here.

-- Remove the abandoned durable-proxy experiment if it reached an environment.
drop function if exists public.admit_blue_gateway_request(uuid, text, text, text, numeric);
drop function if exists public.claim_blue_gateway_request(uuid, text, text, text, integer);
drop function if exists public.renew_blue_gateway_request_lease(uuid, text, text, text, integer);
drop function if exists public.finish_blue_gateway_request(uuid, text, text, text, numeric, bigint, bigint, text, text);
drop function if exists public.cancel_blue_gateway_request(uuid, text);
drop table if exists public.blue_gateway_requests;

create table if not exists public.blue_runtime_tasks (
  request_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  payload_hash text not null,
  model text not null,
  mode text not null check (mode in ('normal', 'ui_max')),
  is_free boolean not null default false,
  access_tier text not null check (access_tier in ('trial', 'full')),
  state text not null default 'provisioning'
    check (state in ('provisioning', 'active', 'stopping', 'completed', 'failed', 'expired')),
  reserved_blue_credits numeric(18, 10) not null default 0
    check (reserved_blue_credits >= 0),
  charged_blue_credits numeric(18, 10) not null default 0
    check (charged_blue_credits >= 0),
  balance_after numeric(18, 10),
  provider_cost numeric(18, 10) not null default 0
    check (provider_cost >= 0),
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  terminal_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.blue_runtime_tasks add column if not exists is_free boolean not null default false;
alter table public.blue_runtime_tasks add column if not exists charged_blue_credits numeric(18, 10) not null default 0;
alter table public.blue_runtime_tasks add column if not exists balance_after numeric(18, 10);

create index if not exists blue_runtime_tasks_user_state_idx
  on public.blue_runtime_tasks (user_id, state, created_at desc);
create index if not exists blue_runtime_tasks_expiry_idx
  on public.blue_runtime_tasks (state, expires_at)
  where state in ('provisioning', 'active', 'stopping');

create table if not exists public.blue_runtime_credentials (
  id uuid primary key default gen_random_uuid(),
  request_id text not null references public.blue_runtime_tasks(request_id) on delete cascade,
  key_hash text unique,
  encrypted_key text,
  encryption_iv text,
  encryption_tag text,
  encryption_version text,
  guardrail_id text,
  provider_limit numeric(18, 10) not null default 0
    check (provider_limit >= 0),
  provider_usage_start numeric(18, 10) not null default 0
    check (provider_usage_start >= 0),
  provider_usage_final numeric(18, 10),
  state text not null default 'provisioning'
    check (state in ('provisioning', 'active', 'disabled', 'deleted', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists blue_runtime_credentials_one_live_idx
  on public.blue_runtime_credentials (request_id)
  where state in ('provisioning', 'active');
create index if not exists blue_runtime_credentials_request_idx
  on public.blue_runtime_credentials (request_id, created_at desc);

create table if not exists public.blue_runtime_extensions (
  request_id text not null references public.blue_runtime_tasks(request_id) on delete cascade,
  extension_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18, 10) not null check (amount > 0),
  state text not null default 'applied' check (state in ('applied', 'rolled_back')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, extension_id)
);

create table if not exists public.blue_model_guardrails (
  model text primary key,
  guardrail_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blue_runtime_model_blocks (
  model text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.blue_runtime_tasks enable row level security;
alter table public.blue_runtime_credentials enable row level security;
alter table public.blue_runtime_extensions enable row level security;
alter table public.blue_model_guardrails enable row level security;
alter table public.blue_runtime_model_blocks enable row level security;
revoke all on public.blue_runtime_tasks from anon, authenticated;
revoke all on public.blue_runtime_credentials from anon, authenticated;
revoke all on public.blue_runtime_extensions from anon, authenticated;
revoke all on public.blue_model_guardrails from anon, authenticated;
revoke all on public.blue_runtime_model_blocks from anon, authenticated;

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
  reservation jsonb;
  active_count integer;
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
  if coalesce((reservation->>'accepted')::boolean, false) is not true then
    return jsonb_build_object(
      'accepted', false,
      'conflict', false,
      'state', coalesce(reservation->>'status', 'provisioning'),
      'reserved', coalesce((reservation->>'reserved')::numeric, 0)
    );
  end if;

  insert into public.blue_runtime_tasks (
    request_id, user_id, device_hash, payload_hash, model, mode, is_free,
    access_tier, state, reserved_blue_credits, expires_at
  ) values (
    request_id_param, user_id_param, device_hash_param, payload_hash_param,
    model_param, mode_param, is_free_param, access_tier_param, 'provisioning', amount_param,
    expires_at_param
  );

  update public.billing_reservations
    set expires_at = expires_at_param + interval '10 minutes'
    where request_id = request_id_param and user_id = user_id_param;

  return jsonb_build_object(
    'accepted', true,
    'conflict', false,
    'state', 'provisioning',
    'reserved', amount_param,
    'remaining', reservation->'remaining',
    'expires_at', expires_at_param
  );
end;
$$ language plpgsql security definer set search_path = public;

drop function if exists public.extend_blue_runtime_task(uuid, text, numeric, timestamptz);
drop function if exists public.rollback_blue_runtime_extension(uuid, text, numeric);

create or replace function public.extend_blue_runtime_task(
  user_id_param uuid,
  request_id_param text,
  extension_id_param text,
  amount_param numeric,
  expires_at_param timestamptz
) returns jsonb as $$
declare
  task_record public.blue_runtime_tasks%rowtype;
  reservation_record public.billing_reservations%rowtype;
  extension_record public.blue_runtime_extensions%rowtype;
  new_balance numeric;
begin
  if amount_param is null or amount_param <= 0 then
    raise exception 'Invalid extension allowance';
  end if;
  if extension_id_param is null or extension_id_param !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' then
    raise exception 'Invalid extension ID';
  end if;
  perform pg_advisory_xact_lock(hashtext(user_id_param::text));
  select * into task_record from public.blue_runtime_tasks
    where request_id = request_id_param and user_id = user_id_param for update;
  if task_record.request_id is null then raise exception 'Blue runtime task not found'; end if;
  if task_record.state not in ('provisioning', 'active') then
    raise exception 'Blue runtime task cannot be extended';
  end if;
  select * into reservation_record from public.billing_reservations
    where request_id = request_id_param and user_id = user_id_param for update;
  if reservation_record.request_id is null or reservation_record.status <> 'pending' then
    raise exception 'Blue runtime reservation is not pending';
  end if;

  select * into extension_record from public.blue_runtime_extensions
    where request_id = request_id_param and extension_id = extension_id_param for update;
  if extension_record.request_id is not null and extension_record.state = 'applied' then
    select blue_credits into new_balance from public.wallets where user_id = user_id_param;
    return jsonb_build_object(
      'extended', false,
      'duplicate', true,
      'reserved', task_record.reserved_blue_credits,
      'remaining', coalesce(new_balance, 0)
    );
  end if;

  update public.wallets
    set blue_credits = coalesce(blue_credits, 0) - amount_param, updated_at = now()
    where user_id = user_id_param and account_type = 'pro_payg'
      and coalesce(blue_credits, 0) >= amount_param
    returning blue_credits into new_balance;
  if new_balance is null then raise exception 'Insufficient Blue Credits'; end if;

  update public.billing_reservations
    set reserved_blue_credits = reserved_blue_credits + amount_param,
        expires_at = expires_at_param + interval '10 minutes'
    where request_id = request_id_param;
  update public.blue_runtime_tasks
    set reserved_blue_credits = reserved_blue_credits + amount_param,
        expires_at = greatest(expires_at, expires_at_param), updated_at = now()
    where request_id = request_id_param;

  insert into public.blue_runtime_extensions (
    request_id, extension_id, user_id, amount, state, updated_at
  ) values (
    request_id_param, extension_id_param, user_id_param, amount_param, 'applied', now()
  ) on conflict (request_id, extension_id) do update
    set amount = excluded.amount, state = 'applied', updated_at = now();

  return jsonb_build_object(
    'extended', true,
    'duplicate', false,
    'reserved', reservation_record.reserved_blue_credits + amount_param,
    'remaining', new_balance
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.rollback_blue_runtime_extension(
  user_id_param uuid,
  request_id_param text,
  extension_id_param text,
  amount_param numeric
) returns void as $$
declare
  extension_record public.blue_runtime_extensions%rowtype;
begin
  if amount_param is null or amount_param <= 0 then return; end if;
  perform pg_advisory_xact_lock(hashtext(user_id_param::text));
  select * into extension_record from public.blue_runtime_extensions
    where request_id = request_id_param and extension_id = extension_id_param for update;
  if extension_record.request_id is null or extension_record.state <> 'applied' then return; end if;
  update public.billing_reservations
    set reserved_blue_credits = greatest(0, reserved_blue_credits - amount_param)
    where request_id = request_id_param and user_id = user_id_param and status = 'pending';
  update public.blue_runtime_tasks
    set reserved_blue_credits = greatest(0, reserved_blue_credits - amount_param), updated_at = now()
    where request_id = request_id_param and user_id = user_id_param
      and state in ('provisioning', 'active');
  update public.wallets
    set blue_credits = coalesce(blue_credits, 0) + amount_param, updated_at = now()
    where user_id = user_id_param and account_type = 'pro_payg';
  update public.blue_runtime_extensions
    set state = 'rolled_back', updated_at = now()
    where request_id = request_id_param and extension_id = extension_id_param;
end;
$$ language plpgsql security definer set search_path = public;

-- Runtime tasks must be reconciled against authoritative provider usage before
-- their reservations can be released. Legacy reservations keep the old expiry.
create or replace function public.release_expired_blue_credit_reservations(
  user_id_param uuid
) returns numeric as $$
declare
  refund numeric := 0;
  new_balance numeric := 0;
begin
  with released as (
    update public.billing_reservations r
      set status = 'released', settled_at = now()
      where r.user_id = user_id_param
        and r.status = 'pending'
        and r.expires_at <= now()
        and not exists (
          select 1 from public.blue_runtime_tasks t
          where t.request_id = r.request_id
            and t.state in ('provisioning', 'active', 'stopping')
        )
      returning r.reserved_blue_credits
  )
  select coalesce(sum(reserved_blue_credits), 0) into refund from released;
  if refund > 0 then
    update public.wallets
      set blue_credits = coalesce(blue_credits, 0) + refund, updated_at = now()
      where user_id = user_id_param returning blue_credits into new_balance;
  else
    select coalesce(blue_credits, 0) into new_balance
      from public.wallets where user_id = user_id_param;
  end if;
  return coalesce(new_balance, 0);
end;
$$ language plpgsql security definer set search_path = public;

-- Preserve cancellation for the two-release legacy proxy compatibility window.
create or replace function public.cancel_blue_gateway_request(
  user_id_param uuid,
  request_id_param text
) returns jsonb as $$
declare
  reservation_record public.billing_reservations%rowtype;
begin
  if request_id_param is null or length(trim(request_id_param)) < 8 then
    raise exception 'Invalid request ID';
  end if;
  delete from public.blue_request_cancellations where expires_at < now();
  select * into reservation_record from public.billing_reservations
    where request_id = request_id_param and user_id = user_id_param for update;
  if reservation_record.request_id is null then
    return jsonb_build_object('accepted', false, 'status', 'not_found');
  end if;
  if reservation_record.status <> 'pending' then
    return jsonb_build_object('accepted', false, 'status', reservation_record.status);
  end if;
  insert into public.blue_request_cancellations (request_id, user_id)
  values (request_id_param, user_id_param)
  on conflict (request_id) do update
    set requested_at = excluded.requested_at,
        expires_at = now() + interval '1 day';
  return jsonb_build_object('accepted', true, 'status', 'pending');
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.admit_blue_runtime_task(uuid, text, text, text, text, text, boolean, text, numeric, integer, timestamptz) from public;
revoke all on function public.extend_blue_runtime_task(uuid, text, text, numeric, timestamptz) from public;
revoke all on function public.rollback_blue_runtime_extension(uuid, text, text, numeric) from public;
revoke all on function public.cancel_blue_gateway_request(uuid, text) from public;
grant execute on function public.admit_blue_runtime_task(uuid, text, text, text, text, text, boolean, text, numeric, integer, timestamptz) to service_role;
grant execute on function public.extend_blue_runtime_task(uuid, text, text, numeric, timestamptz) to service_role;
grant execute on function public.rollback_blue_runtime_extension(uuid, text, text, numeric) to service_role;
grant execute on function public.cancel_blue_gateway_request(uuid, text) to service_role;
