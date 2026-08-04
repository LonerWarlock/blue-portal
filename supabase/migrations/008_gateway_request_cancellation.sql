-- A cancellation intent is durable so the stream-owning Vercel instance can
-- observe it even when the DELETE request lands on another instance.
create table if not exists public.blue_request_cancellations (
  request_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day')
);

create index if not exists blue_request_cancellations_expires_at_idx
  on public.blue_request_cancellations (expires_at);

alter table public.blue_request_cancellations enable row level security;
revoke all on public.blue_request_cancellations from anon, authenticated;

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

  select * into reservation_record
    from public.billing_reservations
    where request_id = request_id_param
      and user_id = user_id_param
    for update;

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

revoke all on function public.cancel_blue_gateway_request(uuid, text) from public;
grant execute on function public.cancel_blue_gateway_request(uuid, text) to service_role;
