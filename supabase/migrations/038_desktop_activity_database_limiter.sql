-- A shared database limiter keeps Desktop telemetry working without Redis.
-- Operational counters only: no prompts, paths, model content or billing writes.
begin;
create table if not exists public.desktop_activity_rate_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests between 1 and 121)
);
alter table public.desktop_activity_rate_windows enable row level security;
revoke all on public.desktop_activity_rate_windows from public, anon, authenticated, service_role;
create or replace function public.limit_desktop_activity(user_id_param uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  window_time timestamptz := date_trunc('minute', clock_timestamp());
  request_count integer;
  wait_seconds integer;
begin
  if user_id_param is null then
    raise exception using errcode = '22023', message = 'An activity owner is required';
  end if;
  insert into public.desktop_activity_rate_windows as windows(user_id,window_start,requests)
    values(user_id_param,window_time,1)
    on conflict (user_id) do update set
      requests = case when windows.window_start = excluded.window_start
        then least(windows.requests + 1,121) else 1 end,
      window_start = excluded.window_start
    returning requests into request_count;
  wait_seconds := greatest(1,least(60,ceil(extract(epoch from (window_time + interval '1 minute' - clock_timestamp())))::integer));
  return jsonb_build_object('allowed',request_count <= 120,
    'remaining',greatest(0,120-request_count),'retry_after_seconds',
    case when request_count <= 120 then 0 else wait_seconds end);
end;
$$;
revoke all on function public.limit_desktop_activity(uuid) from public,anon,authenticated;
grant execute on function public.limit_desktop_activity(uuid) to service_role;
commit;
