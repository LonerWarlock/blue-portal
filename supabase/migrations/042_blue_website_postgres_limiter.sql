-- All non-inference rate limits use Postgres. No credits, subscriptions or
-- authentication credentials are changed. Only hashed limiter identities stored.
begin;
create table if not exists public.blue_website_rate_windows (
  scope text not null,
  identity_hash text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  requests integer not null check (requests between 1 and 10001),
  primary key (scope,identity_hash)
);
create index if not exists blue_website_rate_windows_expiry_idx on public.blue_website_rate_windows(expires_at);
alter table public.blue_website_rate_windows enable row level security;
revoke all on public.blue_website_rate_windows from public,anon,authenticated,service_role;
create or replace function public.limit_blue_website_request(scope_param text,identity_hash_param text,
  limit_param integer,window_seconds_param integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_time_value timestamptz := clock_timestamp();
  window_time timestamptz;
  request_count integer;
begin
  if scope_param is null or scope_param !~ '^[a-zA-Z0-9:_-]{1,80}$'
    or identity_hash_param is null or identity_hash_param !~ '^[a-f0-9]{64}$'
    or limit_param is null or limit_param < 1 or limit_param > 10000
    or window_seconds_param is null or window_seconds_param < 1 or window_seconds_param > 86400 then
    raise exception using errcode='22023',message='Invalid website limiter policy';
  end if;
  window_time:=to_timestamp(floor(extract(epoch from current_time_value)/window_seconds_param)*window_seconds_param);
  -- Bounded retention cleanup, indexed; never unbounded per-request deletion.
  with expired as (select scope,identity_hash from public.blue_website_rate_windows
    where expires_at < current_time_value - interval '1 day' order by expires_at limit 100)
  delete from public.blue_website_rate_windows windows using expired
    where windows.scope=expired.scope and windows.identity_hash=expired.identity_hash;
  insert into public.blue_website_rate_windows as windows(scope,identity_hash,window_start,expires_at,requests)
    values(scope_param,identity_hash_param,window_time,window_time+make_interval(secs=>window_seconds_param),1)
    on conflict (scope,identity_hash) do update set
      requests=case when windows.window_start=excluded.window_start then least(windows.requests+1,limit_param+1) else 1 end,
      window_start=excluded.window_start,expires_at=excluded.expires_at
    returning requests into request_count;
  return jsonb_build_object('allowed',request_count<=limit_param,'remaining',greatest(0,limit_param-request_count),
    'retry_after_seconds',case when request_count<=limit_param then 0 else
      greatest(1,ceil(extract(epoch from (window_time+make_interval(secs=>window_seconds_param)-current_time_value)))::integer) end);
end;
$$;
revoke all on function public.limit_blue_website_request(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.limit_blue_website_request(text,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
