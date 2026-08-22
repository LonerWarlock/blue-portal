-- A local Blue/OpenCode engine cannot reveal the exact provider request ID
-- before its stream opens. Track an opaque process-scoped client identifier so
-- Stop can cancel every pending legacy gateway request owned by that process.
-- The identifier is random, never an API key, and rotates after every Stop.

create table if not exists public.blue_gateway_client_requests (
  request_id text primary key references public.billing_reservations(request_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_instance_id text not null check (char_length(client_instance_id) between 8 and 127),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index if not exists blue_gateway_client_requests_owner_idx
  on public.blue_gateway_client_requests (user_id, client_instance_id, expires_at);

create table if not exists public.blue_gateway_client_cancellations (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_instance_id text not null check (char_length(client_instance_id) between 8 and 127),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  primary key (user_id, client_instance_id)
);

alter table public.blue_gateway_client_requests enable row level security;
alter table public.blue_gateway_client_cancellations enable row level security;
revoke all on public.blue_gateway_client_requests from anon, authenticated;
revoke all on public.blue_gateway_client_cancellations from anon, authenticated;

create or replace function public.cancel_blue_gateway_client_requests(
  user_id_param uuid,
  client_instance_id_param text
) returns jsonb as $$
declare
  cancelled_count integer := 0;
begin
  if client_instance_id_param is null or client_instance_id_param !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' then
    raise exception 'Invalid Blue client instance ID';
  end if;

  delete from public.blue_gateway_client_requests where expires_at < now();
  delete from public.blue_gateway_client_cancellations where expires_at < now();

  -- Store a short-lived marker first. It closes the race where Stop arrives
  -- while a legacy request is still being admitted by another serverless
  -- instance; that request releases its reservation before going upstream.
  insert into public.blue_gateway_client_cancellations (user_id, client_instance_id)
  values (user_id_param, client_instance_id_param)
  on conflict (user_id, client_instance_id) do update
    set requested_at = now(), expires_at = now() + interval '2 minutes';

  with pending as (
    select request_id
      from public.blue_gateway_client_requests mapping
      join public.billing_reservations reservation using (request_id)
     where mapping.user_id = user_id_param
       and mapping.client_instance_id = client_instance_id_param
       and mapping.expires_at > now()
       and reservation.user_id = user_id_param
       and reservation.status = 'pending'
  ), cancelled as (
    insert into public.blue_request_cancellations (request_id, user_id)
    select request_id, user_id_param from pending
    on conflict (request_id) do update
      set requested_at = excluded.requested_at,
          expires_at = now() + interval '1 day'
    returning request_id
  )
  select count(*) into cancelled_count from cancelled;

  return jsonb_build_object('accepted', true, 'cancelled_count', cancelled_count);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_blue_gateway_client_cancellation_requested(
  user_id_param uuid,
  client_instance_id_param text
) returns boolean as $$
  select exists (
    select 1
      from public.blue_gateway_client_cancellations
     where user_id = user_id_param
       and client_instance_id = client_instance_id_param
       and expires_at > now()
  );
$$ language sql security definer set search_path = public;

revoke all on function public.cancel_blue_gateway_client_requests(uuid, text) from public;
revoke all on function public.is_blue_gateway_client_cancellation_requested(uuid, text) from public;
grant execute on function public.cancel_blue_gateway_client_requests(uuid, text) to service_role;
grant execute on function public.is_blue_gateway_client_cancellation_requested(uuid, text) to service_role;
