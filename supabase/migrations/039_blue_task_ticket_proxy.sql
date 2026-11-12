-- Prepaid inference is authorized by Blue tickets. No new OpenRouter child keys.
-- Existing tasks retain the legacy settlement path until their keys are revoked.
begin;
alter table public.blue_runtime_tasks
  add column if not exists runtime_transport text not null default 'legacy',
  add column if not exists proxy_models text[] not null default '{}',
  add column if not exists proxy_purpose text not null default 'text',
  add column if not exists proxy_committed_cost numeric(18,10) not null default 0;
-- The currently deployed v4 backend can still admit tasks before Portal is
-- pushed. Only the new v5 admission explicitly opts a new task into tickets.
alter table public.blue_runtime_tasks alter column runtime_transport set default 'legacy';

create table if not exists public.blue_proxy_calls (
  id uuid primary key,
  request_id text not null references public.blue_runtime_tasks(request_id),
  user_id uuid not null,
  model text not null,
  payload_hash text not null,
  hold_cost numeric(18,10) not null check(hold_cost >= 0),
  provider_cost numeric(18,10),
  state text not null check(state in ('reserved','dispatching','pending','settled','released')),
  provider_generation_id text unique,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blue_proxy_calls_task_idx on public.blue_proxy_calls(request_id,state);
create index if not exists blue_proxy_calls_reconcile_idx on public.blue_proxy_calls(state,updated_at)
  where state in ('reserved','dispatching','pending');
create table if not exists public.blue_credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  request_id text not null,
  call_id uuid,
  kind text not null,
  blue_credits numeric(18,10) not null default 0,
  provider_usd numeric(18,10) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists blue_credit_events_account_idx on public.blue_credit_events(user_id,created_at);
alter table public.blue_proxy_calls enable row level security;
alter table public.blue_credit_events enable row level security;
revoke all on public.blue_proxy_calls,public.blue_credit_events from public,anon,authenticated;
grant all on public.blue_proxy_calls,public.blue_credit_events to service_role;
grant usage,select on sequence public.blue_credit_events_id_seq to service_role;

create or replace function public.blue_credit_events_immutable() returns trigger as $$
begin raise exception 'Credit events are append only'; end;
$$ language plpgsql set search_path=public;
drop trigger if exists blue_credit_events_immutable on public.blue_credit_events;
create trigger blue_credit_events_immutable before update or delete on public.blue_credit_events
  for each row execute function public.blue_credit_events_immutable();

create or replace function public.record_blue_reservation_event() returns trigger as $$
begin
  if TG_OP='INSERT' then
    insert into public.blue_credit_events(user_id,request_id,kind,blue_credits)
      values(new.user_id,new.request_id,'wallet_hold',new.reserved_blue_credits);
  elsif new.reserved_blue_credits is distinct from old.reserved_blue_credits then
    insert into public.blue_credit_events(user_id,request_id,kind,blue_credits)
      values(new.user_id,new.request_id,'wallet_hold_change',new.reserved_blue_credits-old.reserved_blue_credits);
  end if;
  if TG_OP='UPDATE' and old.status='pending' and new.status in ('settled','released') then
    insert into public.blue_credit_events(user_id,request_id,kind,blue_credits,provider_usd)
      values(new.user_id,new.request_id,'wallet_charge',coalesce(new.charged_blue_credits,0),coalesce(new.provider_cost,0));
    insert into public.blue_credit_events(user_id,request_id,kind,blue_credits)
      values(new.user_id,new.request_id,'wallet_refund',new.reserved_blue_credits-coalesce(new.charged_blue_credits,0));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path=public;
drop trigger if exists blue_reservation_ledger on public.billing_reservations;
create trigger blue_reservation_ledger after insert or update on public.billing_reservations
  for each row execute function public.record_blue_reservation_event();

create or replace function public.admit_blue_runtime_task_v5(
  user_id_param uuid,request_id_param text,device_hash_param text,payload_hash_param text,
  model_param text,mode_param text,is_free_param boolean,access_tier_param text,amount_param numeric,
  global_limit_param integer,queue_limit_param integer,queue_expires_at_param timestamptz,
  active_expires_at_param timestamptz,reviewer_model_param text,feature_param text,purpose_param text
) returns jsonb as $$
declare result jsonb; t public.blue_runtime_tasks%rowtype;
begin
  if purpose_param not in ('text','image') then raise exception 'Invalid task purpose'; end if;
  -- Use the same lock as v4 so old/new admissions cannot race the transport tag.
  perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));
  select * into t from public.blue_runtime_tasks where request_id=request_id_param for update;
  if t.request_id is not null and t.runtime_transport<>'ticket'
    then raise exception 'Legacy task must be finalized before retry'; end if;
  result:=public.admit_blue_runtime_task_v4(user_id_param,request_id_param,device_hash_param,payload_hash_param,
    model_param,mode_param,is_free_param,access_tier_param,amount_param,global_limit_param,queue_limit_param,
    queue_expires_at_param,active_expires_at_param,reviewer_model_param,feature_param);
  if coalesce((result->>'conflict')::boolean,false) then return result; end if;
  select * into t from public.blue_runtime_tasks where request_id=request_id_param for update;
  update public.blue_runtime_tasks set runtime_transport='ticket',proxy_purpose=purpose_param where request_id=request_id_param;
  return result;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.activate_blue_proxy_task(user_id_param uuid,request_id_param text,models_param text[])
returns jsonb as $$
declare t public.blue_runtime_tasks%rowtype;
begin
  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if t.request_id is null or t.runtime_transport<>'ticket' or t.state not in ('provisioning','active') or t.expires_at<=now()
    then raise exception 'Task is not active'; end if;
  if cardinality(models_param) not between 1 and 2 or array_position(models_param,null) is not null
    then raise exception 'Invalid task model routes'; end if;
  if cardinality(t.proxy_models)>0 and t.proxy_models is distinct from models_param then raise exception 'Task model routes changed'; end if;
  update public.blue_runtime_tasks set state='active',proxy_models=models_param,last_heartbeat_at=now(),updated_at=now()
    where request_id=request_id_param;
  return jsonb_build_object('active',true);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.authorize_blue_proxy_task(user_id_param uuid,request_id_param text,device_hash_param text,model_param text)
returns jsonb as $$
declare t public.blue_runtime_tasks%rowtype;
begin
  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param;
  if t.request_id is null or t.runtime_transport<>'ticket' or t.state<>'active' or t.expires_at<=now()
    or t.device_hash<>device_hash_param or not(model_param=any(t.proxy_models))
    or not exists(select 1 from public.blue_profiles where user_id=user_id_param and status='active')
    or exists(select 1 from public.blue_runtime_model_blocks where model in (t.model,model_param))
    then raise exception 'Task access denied'; end if;
  return jsonb_build_object('purpose',t.proxy_purpose,'is_free',t.is_free,'model',t.model,
    'reviewer_model',t.reviewer_model,'provider_ceiling',case when t.is_free and t.reviewer_model is null then 0
      else t.reserved_blue_credits/t.credit_multiplier end,'spent',t.provider_cost,'committed',t.proxy_committed_cost);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.reserve_blue_proxy_call(user_id_param uuid,request_id_param text,device_hash_param text,
  model_param text,call_id_param uuid,payload_hash_param text,hold_cost_param numeric)
returns jsonb as $$
declare t public.blue_runtime_tasks%rowtype; prior public.blue_proxy_calls%rowtype; ceiling numeric;
begin
  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  perform public.authorize_blue_proxy_task(user_id_param,request_id_param,device_hash_param,model_param);
  select * into prior from public.blue_proxy_calls where id=call_id_param;
  if prior.id is not null then return jsonb_build_object('accepted',false,'state',prior.state); end if;
  if hold_cost_param is null or hold_cost_param<0 or length(payload_hash_param)<>64 then raise exception 'Invalid call reservation'; end if;
  if (select count(*) from public.blue_proxy_calls where request_id=request_id_param and state in ('reserved','dispatching','pending'))>=8
    then raise exception 'Too many active model requests'; end if;
  ceiling:=case when t.is_free and t.reviewer_model is null then 0 else t.reserved_blue_credits/t.credit_multiplier end;
  if t.proxy_committed_cost+hold_cost_param>ceiling then raise exception 'Task model allowance exhausted'; end if;
  insert into public.blue_proxy_calls(id,request_id,user_id,model,payload_hash,hold_cost,state)
    values(call_id_param,request_id_param,user_id_param,model_param,payload_hash_param,hold_cost_param,'reserved');
  update public.blue_runtime_tasks set proxy_committed_cost=proxy_committed_cost+hold_cost_param where request_id=request_id_param;
  insert into public.blue_credit_events(user_id,request_id,call_id,kind,provider_usd)
    values(user_id_param,request_id_param,call_id_param,'call_hold',hold_cost_param);
  return jsonb_build_object('accepted',true,'ceiling',ceiling,'spent',t.provider_cost);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.dispatch_blue_proxy_call(call_id_param uuid) returns boolean as $$
declare c public.blue_proxy_calls%rowtype; t public.blue_runtime_tasks%rowtype;
begin
  -- Consistent lock order: task before call, also used by settlement.
  select * into c from public.blue_proxy_calls where id=call_id_param;
  select * into t from public.blue_runtime_tasks where request_id=c.request_id for update;
  select * into c from public.blue_proxy_calls where id=call_id_param for update;
  if c.state<>'reserved' or t.state<>'active' or t.expires_at<=now() then return false; end if;
  update public.blue_proxy_calls set state='dispatching',updated_at=now() where id=call_id_param;
  return true;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.observe_blue_proxy_generation(call_id_param uuid,generation_id_param text)
returns boolean as $$
begin
  if generation_id_param !~ '^gen-[A-Za-z0-9_-]{4,196}$' then raise exception 'Invalid generation ID'; end if;
  update public.blue_proxy_calls set provider_generation_id=generation_id_param,updated_at=now()
    where id=call_id_param and state in ('dispatching','pending')
      and (provider_generation_id is null or provider_generation_id=generation_id_param);
  return found;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.settle_blue_proxy_call(call_id_param uuid,cost_param numeric,prompt_tokens_param bigint,
  completion_tokens_param bigint,release_param boolean default false) returns jsonb as $$
declare c public.blue_proxy_calls%rowtype; t public.blue_runtime_tasks%rowtype; actual numeric;
begin
  select * into c from public.blue_proxy_calls where id=call_id_param;
  if c.id is null then raise exception 'Call not found'; end if;
  select * into t from public.blue_runtime_tasks where request_id=c.request_id for update;
  select * into c from public.blue_proxy_calls where id=call_id_param for update;
  if c.state in ('settled','released') then return jsonb_build_object('settled',true); end if;
  -- Service-only release: reserved, or a dispatch committed but fetch never
  -- started. Cron releases only reserved calls; unknown dispatches stay held.
  if release_param and (c.state not in ('reserved','dispatching') or c.provider_generation_id is not null)
    then raise exception 'Dispatched call needs provider settlement'; end if;
  if cost_param is null or cost_param<0 then raise exception 'Invalid provider usage'; end if;
  actual:=case when release_param then 0 else cost_param end;
  update public.blue_proxy_calls set state=case when release_param then 'released' else 'settled' end,
    provider_cost=actual,prompt_tokens=greatest(0,prompt_tokens_param),completion_tokens=greatest(0,completion_tokens_param),updated_at=now()
    where id=call_id_param;
  update public.blue_runtime_tasks set proxy_committed_cost=greatest(0,proxy_committed_cost-c.hold_cost+actual),
    provider_cost=provider_cost+actual,prompt_tokens=prompt_tokens+greatest(0,prompt_tokens_param),
    completion_tokens=completion_tokens+greatest(0,completion_tokens_param),updated_at=now() where request_id=c.request_id;
  insert into public.blue_credit_events(user_id,request_id,call_id,kind,provider_usd)
    values(c.user_id,c.request_id,c.id,case when release_param then 'call_release' else 'call_usage' end,actual);
  if actual>c.hold_cost+0.00000001 then
    insert into public.blue_runtime_model_blocks(model,reason) values(t.model,'Provider usage exceeded the verified request ceiling')
      on conflict(model) do nothing;
  end if;
  return jsonb_build_object('settled',true,'overrun',actual>c.hold_cost);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.finish_blue_proxy_task(user_id_param uuid,request_id_param text,outcome_param text)
returns jsonb as $$
declare t public.blue_runtime_tasks%rowtype; result jsonb; final_state text; user_cost numeric;
begin
  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if t.request_id is null or t.runtime_transport<>'ticket' then raise exception 'Ticket task not found'; end if;
  if t.state in ('completed','failed','cancelled','expired') then return jsonb_build_object('pending',false); end if;
  if outcome_param not in ('completed','failed','stopped','expired') then raise exception 'Invalid task outcome'; end if;
  if t.state='stopping' then outcome_param:=t.terminal_reason; end if;
  update public.blue_runtime_tasks set state='stopping',terminal_reason=outcome_param,
    execution_released_at=now(),settlement_requested_at=coalesce(settlement_requested_at,now()),updated_at=now()
    where request_id=request_id_param;
  if exists(select 1 from public.blue_proxy_calls where request_id=request_id_param and state in ('reserved','dispatching','pending'))
    then return jsonb_build_object('pending',true); end if;
  -- Provider overruns are recorded fully but never overdraw prepaid customer funds.
  user_cost:=case when t.is_free and t.reviewer_model is null then 0
    else least(t.provider_cost,t.reserved_blue_credits/t.credit_multiplier) end;
  result:=public.settle_blue_credit_reservation(user_id_param,request_id_param,user_cost,t.credit_multiplier,t.prompt_tokens,t.completion_tokens);
  final_state:=case outcome_param when 'completed' then 'completed' when 'stopped' then 'cancelled' when 'expired' then 'expired' else 'failed' end;
  update public.blue_runtime_tasks set state=final_state,charged_blue_credits=(result->>'charged')::numeric,
    balance_after=(result->>'remaining')::numeric,settlement_next_attempt_at=null,updated_at=now(),finished_at=now()
    where request_id=request_id_param;
  return jsonb_build_object('pending',false);
end;
$$ language plpgsql security definer set search_path=public;

-- No client role can authorize, reserve, dispatch, settle, or edit the ledger.
revoke all on function public.admit_blue_runtime_task_v5(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text,text,text),
  public.activate_blue_proxy_task(uuid,text,text[]),public.authorize_blue_proxy_task(uuid,text,text,text),
  public.reserve_blue_proxy_call(uuid,text,text,text,uuid,text,numeric),public.dispatch_blue_proxy_call(uuid),
  public.observe_blue_proxy_generation(uuid,text),public.settle_blue_proxy_call(uuid,numeric,bigint,bigint,boolean),
  public.finish_blue_proxy_task(uuid,text,text),public.record_blue_reservation_event() from public,anon,authenticated;
grant execute on function public.admit_blue_runtime_task_v5(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text,text,text),
  public.activate_blue_proxy_task(uuid,text,text[]),public.authorize_blue_proxy_task(uuid,text,text,text),
  public.reserve_blue_proxy_call(uuid,text,text,text,uuid,text,numeric),public.dispatch_blue_proxy_call(uuid),
  public.observe_blue_proxy_generation(uuid,text),public.settle_blue_proxy_call(uuid,numeric,bigint,bigint,boolean),
  public.finish_blue_proxy_task(uuid,text,text) to service_role;
commit;
