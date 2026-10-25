-- Blue Teams PAYG activation and one-to-one usage billing.
-- Apply before the matching portal/Desktop deployment. No wallet is wiped.
-- Existing reservations used the former default 1.5 rate. If a deployment used
-- a different legacy rate, set blue.legacy_credit_multiplier BEFORE this script.
begin;

create table if not exists public.blue_teams_credit_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  qualifying_payment_id uuid references public.credit_payments(id) on delete set null,
  activated_at timestamptz not null default now(),
  depleted_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.blue_teams_credit_access enable row level security;
revoke all on public.blue_teams_credit_access from public, anon, authenticated;
grant all on public.blue_teams_credit_access to service_role;

alter table public.billing_reservations add column if not exists credit_multiplier numeric;
update public.billing_reservations set credit_multiplier =
  coalesce(nullif(current_setting('blue.legacy_credit_multiplier', true), '')::numeric, 1.5)
  where credit_multiplier is null;
alter table public.billing_reservations alter column credit_multiplier set default 1;
alter table public.billing_reservations alter column credit_multiplier set not null;
alter table public.blue_runtime_tasks add column if not exists credit_multiplier numeric;
update public.blue_runtime_tasks task set credit_multiplier = coalesce(
  (select credit_multiplier from public.billing_reservations r where r.request_id=task.request_id and r.user_id=task.user_id),
  nullif(current_setting('blue.legacy_credit_multiplier',true),'')::numeric, 1.5)
  where credit_multiplier is null;
alter table public.blue_runtime_tasks alter column credit_multiplier set default 1;
alter table public.blue_runtime_tasks alter column credit_multiplier set not null;
alter table public.blue_runtime_tasks add column if not exists feature text not null default 'project';
alter table public.blue_runtime_tasks drop constraint if exists blue_runtime_tasks_feature_check;
alter table public.blue_runtime_tasks add constraint blue_runtime_tasks_feature_check check (feature in ('project','teams'));

-- Holds are still owned credits. Reserving the last available credit does not
-- mean it has been spent; all queries use available + still-pending holds.
create or replace function public.refresh_blue_teams_credit_access(user_id_param uuid)
returns numeric as $$
declare funds numeric;
begin
  perform 1 from public.wallets where user_id=user_id_param for update;
  select coalesce((select blue_credits from public.wallets where user_id=user_id_param),0)
    + coalesce((select sum(reserved_blue_credits) from public.billing_reservations
      where user_id=user_id_param and status='pending'),0) into funds;
  if funds<=0 then
    update public.blue_teams_credit_access set depleted_at=coalesce(depleted_at,now()),updated_at=now()
      where user_id=user_id_param and depleted_at is null;
  end if;
  return greatest(funds,0);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.blue_teams_credit_entitlement(user_id_param uuid)
returns jsonb as $$
declare funds numeric; available numeric; paid_active boolean:=false; active_plan text;
  period_end timestamptz; source text;
begin
  funds:=public.refresh_blue_teams_credit_access(user_id_param);
  select greatest(coalesce(blue_credits,0),0) into available from public.wallets where user_id=user_id_param;
  select true into paid_active from public.blue_teams_credit_access access
    join public.credit_payments payment on payment.id=access.qualifying_payment_id
    join public.blue_profiles profile on profile.user_id=access.user_id
    join public.wallets wallet on wallet.user_id=access.user_id
    where access.user_id=user_id_param and access.depleted_at is null and funds>0
      and payment.user_id=user_id_param and payment.status='completed' and payment.credits_purchased>=25
      and profile.status='active' and wallet.account_type='pro_payg';
  if coalesce(paid_active,false) then active_plan:='payg';source:='credits';
  else
    -- Honour already-paid subscriptions until expiry. No new subscriptions are sold.
    select plan,current_period_end into active_plan,period_end from public.team_subscriptions
      where user_id=user_id_param and is_test=false and status='active' and current_period_end>now()
      order by current_period_end desc limit 1;
    if active_plan is not null then source:='legacy_subscription'; end if;
  end if;
  return jsonb_build_object('user_id',user_id_param,'plan',active_plan,
    'status',case when active_plan is null then 'inactive' else 'active' end,
    'current_period_end',period_end,'access_source',source,'required_purchase_credits',25,
    'blue_models_only',true,'available_blue_credits',coalesce(available,0),'total_blue_credits',funds,
    'active_project_teams',case active_plan when 'solo' then 1 when 'pro' then 3 when 'business' then 10 when 'payg' then 10 else 0 end,
    'agents_per_team',case active_plan when 'solo' then 3 when 'pro' then 5 when 'business' then 8 when 'payg' then 8 else 0 end);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.complete_blue_credit_payment(payment_id_param uuid,provider_txnid_param text)
returns jsonb as $$
declare payment_record public.credit_payments%rowtype;new_balance numeric;next_tier text;
begin
  select * into payment_record from public.credit_payments
    where id=payment_id_param and provider_txnid=provider_txnid_param for update;
  if payment_record.id is null then raise exception 'Payment not found'; end if;
  if payment_record.status='completed' then
    select blue_credits into new_balance from public.wallets where user_id=payment_record.user_id;
    return jsonb_build_object('already_processed',true,'remaining',coalesce(new_balance,0),'credits',payment_record.credits_purchased);
  end if;
  if payment_record.status<>'pending' then raise exception 'Payment is not pending';end if;
  if payment_record.credits_purchased<=0 or payment_record.payment_provider not in ('payu','paypal') then
    raise exception 'Invalid Blue Credits payment';end if;
  -- Ensure a stable wallet lock exists even on the very first purchase.
  insert into public.wallets(user_id,balance,account_type,blue_credits,updated_at)
    values(payment_record.user_id,0,'pro_payg',0,now()) on conflict(user_id) do nothing;
  perform public.refresh_blue_teams_credit_access(payment_record.user_id);
  update public.credit_payments set status='completed',completed_at=now(),provider_order_id=provider_txnid_param
    where id=payment_record.id;
  update public.wallets set account_type='pro_payg',blue_credits=coalesce(blue_credits,0)+payment_record.credits_purchased,
    updated_at=now() where user_id=payment_record.user_id returning blue_credits into new_balance;
  next_tier:=case when payment_record.pack_id in ('standard','custom') then 'full' else 'trial' end;
  insert into public.blue_profiles(user_id,status,access_tier,total_credits_purchased,total_credits_used,last_top_up_credits,activated_at,updated_at)
    values(payment_record.user_id,'active',next_tier,payment_record.credits_purchased,0,payment_record.credits_purchased,now(),now())
    on conflict(user_id) do update set status='active',
      access_tier=case when blue_profiles.access_tier='full' then 'full' else excluded.access_tier end,
      total_credits_purchased=blue_profiles.total_credits_purchased+excluded.total_credits_purchased,
      last_top_up_credits=excluded.last_top_up_credits,activated_at=coalesce(blue_profiles.activated_at,now()),updated_at=now();
  -- A replay of a previously completed payment never reaches this grant.
  if payment_record.credits_purchased>=25 then
    insert into public.blue_teams_credit_access(user_id,qualifying_payment_id,activated_at,depleted_at,updated_at)
      values(payment_record.user_id,payment_record.id,now(),null,now())
      on conflict(user_id) do update set qualifying_payment_id=excluded.qualifying_payment_id,
        activated_at=now(),depleted_at=null,updated_at=now();
  end if;
  return jsonb_build_object('already_processed',false,'remaining',new_balance,'credits',payment_record.credits_purchased,'access_tier',next_tier);
end;
$$ language plpgsql security definer set search_path=public;

-- A task queued before this deployment may get its first hold afterwards.
-- Its old rate must travel with that new hold; fresh tasks and gateway holds
-- have no old task binding and retain the one-to-one default.
create or replace function public.bind_blue_reservation_credit_rate() returns trigger as $$
begin
  new.credit_multiplier:=coalesce((select task.credit_multiplier from public.blue_runtime_tasks task
    where task.request_id=new.request_id and task.user_id=new.user_id),new.credit_multiplier,1);
  return new;
end;
$$ language plpgsql security definer set search_path=public;
drop trigger if exists blue_reservation_credit_rate on public.billing_reservations;
create trigger blue_reservation_credit_rate before insert on public.billing_reservations
  for each row execute function public.bind_blue_reservation_credit_rate();
revoke all on function public.bind_blue_reservation_credit_rate() from public,anon,authenticated;

-- Settlement remains idempotent and honours the rate bound when the hold was
-- admitted. New holds always default to 1; changing Vercel's legacy multiplier
-- cannot charge the checkout fee a second time during model usage.
create or replace function public.settle_blue_credit_reservation(user_id_param uuid,request_id_param text,
  provider_cost_param numeric,blue_credit_multiplier_param numeric,prompt_tokens_param bigint,completion_tokens_param bigint)
returns jsonb as $$
declare reservation_record public.billing_reservations%rowtype;charge numeric;adjustment numeric;new_balance numeric;
begin
  if provider_cost_param is null or provider_cost_param<0 then raise exception 'Invalid provider cost';end if;
  select * into reservation_record from public.billing_reservations where request_id=request_id_param and user_id=user_id_param for update;
  if reservation_record.request_id is null then raise exception 'Billing reservation not found';end if;
  if reservation_record.status='settled' then
    return jsonb_build_object('request_id',request_id_param,'charged',reservation_record.charged_blue_credits,
      'provider_cost',reservation_record.provider_cost,'remaining',reservation_record.balance_after,'status','settled');
  end if;
  if reservation_record.status<>'pending' then raise exception 'Billing reservation is not pending';end if;
  charge:=round(provider_cost_param*reservation_record.credit_multiplier,10);
  adjustment:=reservation_record.reserved_blue_credits-charge;
  update public.wallets set blue_credits=coalesce(blue_credits,0)+adjustment,updated_at=now()
    where user_id=user_id_param and (adjustment>=0 or blue_credits>=abs(adjustment)) returning blue_credits into new_balance;
  if new_balance is null then raise exception 'Reservation was lower than the final charge';end if;
  update public.billing_reservations set status='settled',charged_blue_credits=charge,provider_cost=provider_cost_param,
    prompt_tokens=greatest(prompt_tokens_param,0),completion_tokens=greatest(completion_tokens_param,0),
    balance_after=new_balance,settled_at=now() where request_id=request_id_param;
  update public.blue_profiles set total_credits_used=total_credits_used+charge,updated_at=now() where user_id=user_id_param;
  insert into public.billing_transactions(user_id,model,prompt_tokens,completion_tokens,cost,provider_cost,blue_credits_cost,
    account_type,rate_card_version,request_id,balance_after)
    values(user_id_param,reservation_record.model,greatest(prompt_tokens_param,0),greatest(completion_tokens_param,0),
      provider_cost_param,provider_cost_param,charge,'pro_payg','openrouter-usage-cost-x'||reservation_record.credit_multiplier::text,
      request_id_param,new_balance) on conflict(request_id) do nothing;
  perform public.refresh_blue_teams_credit_access(user_id_param);
  return jsonb_build_object('request_id',request_id_param,'charged',charge,'provider_cost',provider_cost_param,'remaining',new_balance,'status','settled');
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.deduct_blue_credits(user_id_param uuid,cost_param numeric) returns numeric as $$
declare funds numeric;
begin
  if cost_param is null or cost_param<0 then raise exception 'Invalid Blue Credit charge';end if;
  update public.wallets set blue_credits=blue_credits-cost_param,updated_at=now()
    where user_id=user_id_param and blue_credits>=cost_param returning blue_credits into funds;
  if funds is null then raise exception 'Insufficient Blue Credits';end if;
  perform public.refresh_blue_teams_credit_access(user_id_param);return funds;
end;
$$ language plpgsql security definer set search_path=public;
create or replace function public.add_blue_credits(user_id_param uuid,amount_param numeric) returns numeric as $$
declare funds numeric;
begin
  if amount_param is null or amount_param<0 then raise exception 'Invalid Blue Credit adjustment';end if;
  perform public.refresh_blue_teams_credit_access(user_id_param);
  update public.wallets set blue_credits=blue_credits+amount_param,updated_at=now()
    where user_id=user_id_param returning blue_credits into funds;return funds;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.revoke_blue_teams_refunded_payment() returns trigger as $$
begin
  if old.status='completed' and new.status<>'completed' then
    update public.blue_teams_credit_access set depleted_at=coalesce(depleted_at,now()),updated_at=now()
      where qualifying_payment_id=new.id;
  end if;return new;
end;
$$ language plpgsql security definer set search_path=public;
drop trigger if exists blue_teams_payment_revocation on public.credit_payments;
create trigger blue_teams_payment_revocation after update of status on public.credit_payments
  for each row execute function public.revoke_blue_teams_refunded_payment();

-- Feature and reviewer are immutable under the existing global admission lock.
create or replace function public.admit_blue_runtime_task_v4(user_id_param uuid,request_id_param text,
  device_hash_param text,payload_hash_param text,model_param text,mode_param text,is_free_param boolean,
  access_tier_param text,amount_param numeric,global_limit_param integer,queue_limit_param integer,
  queue_expires_at_param timestamptz,active_expires_at_param timestamptz,reviewer_model_param text,feature_param text)
returns jsonb as $$
declare existing public.blue_runtime_tasks%rowtype;receipt jsonb;access jsonb;
begin
  if feature_param not in ('project','teams') or feature_param is null then raise exception 'Invalid Blue runtime feature';end if;
  perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));
  perform pg_advisory_xact_lock(hashtext(user_id_param::text));
  select * into existing from public.blue_runtime_tasks where request_id=request_id_param for update;
  if existing.request_id is not null then
    if existing.user_id<>user_id_param then raise exception 'Request ID already belongs to another user';end if;
    if existing.feature<>feature_param then return jsonb_build_object('accepted',false,'conflict',true,'state',existing.state);end if;
  end if;
  if reviewer_model_param is null then
    receipt:=public.admit_blue_runtime_task_v2(user_id_param,request_id_param,device_hash_param,payload_hash_param,
      model_param,mode_param,is_free_param,access_tier_param,amount_param,global_limit_param,queue_limit_param,queue_expires_at_param,active_expires_at_param);
  else
    receipt:=public.admit_blue_runtime_task_v3(user_id_param,request_id_param,device_hash_param,payload_hash_param,
      model_param,mode_param,is_free_param,access_tier_param,amount_param,global_limit_param,queue_limit_param,queue_expires_at_param,active_expires_at_param,reviewer_model_param);
  end if;
  if coalesce((receipt->>'conflict')::boolean,false) then return receipt;end if;
  -- Run the normal reservation/queue transaction first to retain its lock
  -- order. No provider credential exists yet. A failed entitlement check rolls
  -- back this entire admission and every tentative reservation/queue write.
  if existing.request_id is null and feature_param='teams' then
    access:=public.blue_teams_credit_entitlement(user_id_param);
    if access->>'status'<>'active' then raise exception 'Blue Teams requires a purchase of at least 25 Blue Credits and remaining credits';end if;
  end if;
  update public.blue_runtime_tasks task set feature=feature_param,credit_multiplier=coalesce(
    (select credit_multiplier from public.billing_reservations reservation where reservation.request_id=task.request_id and reservation.user_id=task.user_id),task.credit_multiplier)
    where request_id=request_id_param and user_id=user_id_param;
  return receipt;
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.extend_blue_runtime_task_v2(user_id_param uuid,request_id_param text,
  extension_id_param text,amount_param numeric,expires_at_param timestamptz) returns jsonb as $$
declare task public.blue_runtime_tasks%rowtype;access jsonb;
begin
  perform pg_advisory_xact_lock(hashtext(user_id_param::text));
  select * into task from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if task.request_id is null then raise exception 'Blue runtime task not found';end if;
  -- Settlement takes reservation -> wallet. Acquire this reservation before
  -- entitlement takes the wallet lock, avoiding an extension/settlement cycle.
  perform 1 from public.billing_reservations where request_id=request_id_param and user_id=user_id_param for update;
  if task.feature='teams' and not exists (select 1 from public.blue_runtime_extensions
    where request_id=request_id_param and extension_id=extension_id_param and state='applied') then
    access:=public.blue_teams_credit_entitlement(user_id_param);
    if access->>'status'<>'active' then raise exception 'Blue Teams requires a purchase of at least 25 Blue Credits and remaining credits';end if;
  end if;
  return public.extend_blue_runtime_task(user_id_param,request_id_param,extension_id_param,amount_param,expires_at_param);
end;
$$ language plpgsql security definer set search_path=public;

-- Retire the database quote creation too, while keeping provider callbacks able
-- to reconcile payments already collected against existing stored orders.
create or replace function public.create_blue_teams_checkout(user_id_param uuid,tier_param text,
  is_test_param boolean default false,live_test_param boolean default false) returns jsonb as $$
begin raise exception 'Teams subscriptions have been replaced by Blue Credits';end;
$$ language plpgsql security definer set search_path=public;
create or replace function public.schedule_blue_teams_change(user_id_param uuid,tier_param text) returns jsonb as $$
begin raise exception 'Teams subscriptions have been replaced by Blue Credits';end;
$$ language plpgsql security definer set search_path=public;

revoke all on function public.refresh_blue_teams_credit_access(uuid) from public,anon,authenticated;
revoke all on function public.blue_teams_credit_entitlement(uuid) from public,anon,authenticated;
revoke all on function public.complete_blue_credit_payment(uuid,text) from public,anon,authenticated;
revoke all on function public.settle_blue_credit_reservation(uuid,text,numeric,numeric,bigint,bigint) from public,anon,authenticated;
revoke all on function public.deduct_blue_credits(uuid,numeric) from public,anon,authenticated;
revoke all on function public.add_blue_credits(uuid,numeric) from public,anon,authenticated;
revoke all on function public.revoke_blue_teams_refunded_payment() from public,anon,authenticated;
revoke all on function public.admit_blue_runtime_task_v4(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.extend_blue_runtime_task_v2(uuid,text,text,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.refresh_blue_teams_credit_access(uuid) to service_role;
grant execute on function public.blue_teams_credit_entitlement(uuid) to service_role;
grant execute on function public.complete_blue_credit_payment(uuid,text) to service_role;
grant execute on function public.settle_blue_credit_reservation(uuid,text,numeric,numeric,bigint,bigint) to service_role;
grant execute on function public.deduct_blue_credits(uuid,numeric) to service_role;
grant execute on function public.add_blue_credits(uuid,numeric) to service_role;
grant execute on function public.admit_blue_runtime_task_v4(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text,text) to service_role;
grant execute on function public.extend_blue_runtime_task_v2(uuid,text,text,numeric,timestamptz) to service_role;

-- Legacy helpers must not bypass the new server-only admission and credit
-- authority. Supabase may grant anon/authenticated directly by default;
-- revoking PUBLIC alone does not remove those explicit privileges.
revoke all on function public.reserve_blue_credits(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_blue_credits(uuid,text,text,numeric) to service_role;
revoke all on function public.release_blue_credit_reservation(uuid,text) from public,anon,authenticated;
grant execute on function public.release_blue_credit_reservation(uuid,text) to service_role;
revoke all on function public.release_expired_blue_credit_reservations(uuid) from public,anon,authenticated;
grant execute on function public.release_expired_blue_credit_reservations(uuid) to service_role;
revoke all on function public.increment_blue_credits_purchased(uuid,numeric) from public,anon,authenticated;
grant execute on function public.increment_blue_credits_purchased(uuid,numeric) to service_role;
revoke all on function public.increment_blue_credits_used(uuid,numeric) from public,anon,authenticated;
grant execute on function public.increment_blue_credits_used(uuid,numeric) to service_role;
revoke all on function public.admit_blue_runtime_task(uuid,text,text,text,text,text,boolean,text,numeric,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.admit_blue_runtime_task(uuid,text,text,text,text,text,boolean,text,numeric,integer,timestamptz) to service_role;
revoke all on function public.admit_blue_runtime_task_v2(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.admit_blue_runtime_task_v2(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz) to service_role;
revoke all on function public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admit_blue_runtime_task_v3(uuid,text,text,text,text,text,boolean,text,numeric,integer,integer,timestamptz,timestamptz,text) to service_role;
revoke all on function public.extend_blue_runtime_task(uuid,text,text,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.extend_blue_runtime_task(uuid,text,text,numeric,timestamptz) to service_role;
revoke all on function public.rollback_blue_runtime_extension(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.rollback_blue_runtime_extension(uuid,text,text,numeric) to service_role;
revoke all on function public.cancel_blue_gateway_request(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_blue_gateway_request(uuid,text) to service_role;
revoke all on function public.promote_blue_runtime_queue(integer,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.promote_blue_runtime_queue(integer,integer,timestamptz) to service_role;

-- Deliberately no lifetime-purchase backfill: it cannot prove that an old wallet
-- never reached zero. Existing paid Teams access remains honoured until expiry.
commit;
