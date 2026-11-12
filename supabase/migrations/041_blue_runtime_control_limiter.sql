-- Move admission/status polling limits off Redis. Same per-account limits;
-- server-only atomic counters, no prompt content, credit or billing changes.
begin;
create table if not exists public.blue_runtime_control_rate_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('status','admit:trial','admit:paid')),
  identity_hash text not null,
  window_start timestamptz not null,
  requests integer not null check (requests between 1 and 61),
  primary key (user_id, scope, identity_hash)
);
alter table public.blue_runtime_control_rate_windows enable row level security;
revoke all on public.blue_runtime_control_rate_windows from public,anon,authenticated,service_role;
create or replace function public.limit_blue_runtime_control(user_id_param uuid,scope_param text,identity_param text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  window_time timestamptz := date_trunc('minute',clock_timestamp());
  max_requests integer;
  request_count integer;
begin
  max_requests := case scope_param when 'status' then 30 when 'admit:trial' then 20 when 'admit:paid' then 60 end;
  if user_id_param is null or max_requests is null or identity_param is null or length(identity_param) > 128 then
    raise exception using errcode='22023',message='Invalid control-plane limiter identity';
  end if;
  delete from public.blue_runtime_control_rate_windows
    where user_id=user_id_param and window_start < window_time - interval '1 day';
  insert into public.blue_runtime_control_rate_windows as windows(user_id,scope,identity_hash,window_start,requests)
    values(user_id_param,scope_param,md5(identity_param),window_time,1)
    on conflict (user_id,scope,identity_hash) do update set
      requests=case when windows.window_start=excluded.window_start then least(windows.requests+1,max_requests+1) else 1 end,
      window_start=excluded.window_start
    returning requests into request_count;
  return jsonb_build_object('allowed',request_count <= max_requests,'remaining',greatest(0,max_requests-request_count),
    'retry_after_seconds',case when request_count <= max_requests then 0 else
      greatest(1,least(60,ceil(extract(epoch from (window_time+interval '1 minute'-clock_timestamp())))::integer)) end);
end;
$$;
revoke all on function public.limit_blue_runtime_control(uuid,text,text) from public,anon,authenticated;
grant execute on function public.limit_blue_runtime_control(uuid,text,text) to service_role;
-- Durable cleanup acknowledgement: a crash or Redis outage after billing
-- settlement must not strand a sorted-set hold forever or trigger polling writes.
alter table public.blue_proxy_calls add column if not exists redis_released_at timestamptz;
create index if not exists blue_proxy_calls_redis_cleanup_idx on public.blue_proxy_calls(updated_at)
  where state in ('settled','released') and redis_released_at is null;
create or replace function public.confirm_blue_proxy_redis_release(call_id_param uuid)
returns void language sql security definer set search_path = '' as $$
  update public.blue_proxy_calls set redis_released_at=coalesce(redis_released_at,now())
    where id=call_id_param and state in ('settled','released');
$$;
revoke all on function public.confirm_blue_proxy_redis_release(uuid) from public,anon,authenticated;
grant execute on function public.confirm_blue_proxy_redis_release(uuid) to service_role;
notify pgrst,'reload schema';
commit;
