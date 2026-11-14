-- One service-only atomic pre-dispatch transaction. Legacy callers remain supported.
-- No prompts, outputs, keys or task tickets are stored here.
begin;

alter table public.blue_proxy_calls
  add column if not exists admission_version smallint not null default 1,
  add column if not exists admission_attempt_id uuid,
  add column if not exists enforced_output_limit bigint,
  add column if not exists redis_hold_required boolean not null default true;

-- One bounded row per account, shared by legacy and atomic admissions.
create table if not exists public.blue_proxy_rate_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check(requests between 1 and 120)
);
alter table public.blue_proxy_rate_windows enable row level security;
revoke all on public.blue_proxy_rate_windows from public,anon,authenticated,service_role;

-- The DDL lock on blue_proxy_calls prevents an admission gap during installation.
-- Include already admitted legacy requests from this minute, once on first apply.
insert into public.blue_proxy_rate_windows(user_id,window_start,requests)
  select user_id,date_trunc('minute',clock_timestamp()),least(120,count(*))::integer
  from public.blue_proxy_calls where created_at >= date_trunc('minute',clock_timestamp())
  group by user_id on conflict(user_id) do nothing;

create or replace function public.limit_blue_proxy_call_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare window_time timestamptz := date_trunc('minute',clock_timestamp()); counter integer;
begin
  insert into public.blue_proxy_rate_windows as w(user_id,window_start,requests)
    values(new.user_id,window_time,1)
    on conflict(user_id) do update set
      requests=case when w.window_start=excluded.window_start then w.requests+1 else 1 end,
      window_start=excluded.window_start
    where w.window_start<>excluded.window_start or w.requests<120
    returning requests into counter;
  if counter is null then raise exception 'Model request rate limit reached'; end if;
  return new;
end;
$$;
revoke all on function public.limit_blue_proxy_call_insert() from public,anon,authenticated;
drop trigger if exists blue_proxy_call_rate on public.blue_proxy_calls;
create trigger blue_proxy_call_rate before insert on public.blue_proxy_calls
  for each row execute function public.limit_blue_proxy_call_insert();

create or replace function public.admit_blue_proxy_call_v2(
  user_id_param uuid,request_id_param text,device_hash_param text,model_param text,
  call_id_param uuid,payload_hash_param text,attempt_id_param uuid,quote_param jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  t public.blue_runtime_tasks%rowtype; prior public.blue_proxy_calls%rowtype;
  ceiling numeric; remaining numeric; fixed_cost numeric; output_rate numeric;
  output_limit bigint; enforced_limit bigint; held numeric; purpose text;
begin
  -- All paths lock task before call; no upstream work runs in this transaction.
  select * into t from public.blue_runtime_tasks
    where request_id=request_id_param and user_id=user_id_param for update;
  perform public.authorize_blue_proxy_task(user_id_param,request_id_param,device_hash_param,model_param);
  if call_id_param is null or attempt_id_param is null or payload_hash_param is null
    or payload_hash_param !~ '^[0-9a-f]{64}$' then raise exception 'Invalid call reservation'; end if;
  select * into prior from public.blue_proxy_calls where id=call_id_param;
  if prior.id is not null then
    if prior.user_id<>user_id_param or prior.request_id<>request_id_param or prior.model<>model_param
      or prior.payload_hash<>payload_hash_param then raise exception 'Call identity conflict'; end if;
    -- Even the original owner must not dispatch twice after a lost response.
    return jsonb_build_object('accepted',false,'state',prior.state);
  end if;
  if jsonb_typeof(quote_param) is distinct from 'object' or quote_param->>'version' is distinct from '1'
    or jsonb_typeof(quote_param->'fixed_cost') is distinct from 'number'
    or jsonb_typeof(quote_param->'output_rate') is distinct from 'number' then raise exception 'Invalid server pricing quote'; end if;
  purpose:=quote_param->>'purpose';
  if purpose is null or purpose not in ('text','image') or purpose<>t.proxy_purpose then raise exception 'Task access denied'; end if;
  fixed_cost:=(quote_param->>'fixed_cost')::numeric;
  output_rate:=(quote_param->>'output_rate')::numeric;
  if fixed_cost is null or output_rate is null or fixed_cost<0 or fixed_cost>1000000 or output_rate<0 or output_rate>1000000
    then raise exception 'Invalid server pricing quote'; end if;
  if quote_param->'output_limit'='null'::jsonb then
    if purpose<>'image' or output_rate<>0 then raise exception 'Invalid image pricing quote'; end if;
  else
    if jsonb_typeof(quote_param->'output_limit') is distinct from 'number'
      or (quote_param->>'output_limit') !~ '^[0-9]+$' then raise exception 'Invalid server token limit'; end if;
    output_limit:=(quote_param->>'output_limit')::bigint;
    if output_limit is null or output_limit<1 or output_limit>1000000000 then raise exception 'Invalid server token limit'; end if;
  end if;
  if (select count(*) from public.blue_proxy_calls where request_id=request_id_param and state in ('reserved','dispatching','pending'))>=8
    then raise exception 'Too many active model requests'; end if;
  ceiling:=case when t.is_free and t.reviewer_model is null then 0 else t.reserved_blue_credits/t.credit_multiplier end;
  remaining:=greatest(0,ceiling-t.proxy_committed_cost);
  enforced_limit:=output_limit;
  if output_limit is not null and output_rate>0 then
    enforced_limit:=least(output_limit,floor((remaining-fixed_cost)/output_rate)::bigint);
  end if;
  if fixed_cost>remaining or enforced_limit<1 then raise exception 'Task model allowance exhausted'; end if;
  held:=case when purpose='image' then remaining
    else ceil((fixed_cost+coalesce(enforced_limit,0)*output_rate)*10000000000)/10000000000 end;
  if held>remaining then raise exception 'Task model allowance exhausted'; end if;
  insert into public.blue_proxy_calls(id,request_id,user_id,model,payload_hash,hold_cost,state,
    admission_version,admission_attempt_id,enforced_output_limit,redis_hold_required,redis_released_at)
    values(call_id_param,request_id_param,user_id_param,model_param,payload_hash_param,held,'dispatching',
      2,attempt_id_param,enforced_limit,false,clock_timestamp());
  update public.blue_runtime_tasks set proxy_committed_cost=proxy_committed_cost+held,updated_at=now()
    where request_id=request_id_param;
  insert into public.blue_credit_events(user_id,request_id,call_id,kind,provider_usd)
    values(user_id_param,request_id_param,call_id_param,'call_hold',held);
  return jsonb_build_object('accepted',true,'purpose',purpose,'hold_cost',held,'output_limit',enforced_limit);
end;
$$;

-- Lost admission response: only the Worker attempt that NEVER started its
-- upstream fetch can request this release. A duplicate HTTP attempt cannot.
create or replace function public.release_blue_proxy_admission(
  user_id_param uuid,request_id_param text,call_id_param uuid,attempt_id_param uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.blue_proxy_calls%rowtype;
begin
  perform 1 from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if not found then return false; end if;
  select * into c from public.blue_proxy_calls where id=call_id_param for update;
  if c.id is null or c.user_id<>user_id_param or c.request_id<>request_id_param or c.admission_version<>2
    or c.admission_attempt_id is distinct from attempt_id_param or attempt_id_param is null
    or c.provider_generation_id is not null then return false; end if;
  if c.state='released' then return true; end if;
  if c.state<>'dispatching' then return false; end if;
  perform public.settle_blue_proxy_call(call_id_param,0,0,0,true);
  return true;
end;
$$;

revoke all on function public.admit_blue_proxy_call_v2(uuid,text,text,text,uuid,text,uuid,jsonb),
  public.release_blue_proxy_admission(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admit_blue_proxy_call_v2(uuid,text,text,text,uuid,text,uuid,jsonb),
  public.release_blue_proxy_admission(uuid,text,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
