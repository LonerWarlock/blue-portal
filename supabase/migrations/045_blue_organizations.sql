-- Organization billing expansion. Apply before Portal/client rollout.
begin;
create table if not exists public.blue_organizations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table if not exists public.blue_organization_wallets (
 organization_id uuid primary key references public.blue_organizations(id),
 available numeric(18,10) not null default 0 check(available>=0),
 held numeric(18,10) not null default 0 check(held>=0),
 purchased numeric(18,10) not null default 0 check(purchased>=0),
 spent numeric(18,10) not null default 0 check(spent>=0)
);
create table if not exists public.blue_organization_members (
 organization_id uuid not null references public.blue_organizations(id), user_id uuid not null references auth.users(id),
 active boolean not null default true, spend_cap numeric(18,10) check(spend_cap>=0),
 spent numeric(18,10) not null default 0 check(spent>=0), held numeric(18,10) not null default 0 check(held>=0),
 joined_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create index if not exists blue_org_members_user on public.blue_organization_members(user_id) where active;
create table if not exists public.blue_organization_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.blue_organizations(id),
 email text not null check(email=lower(trim(email)) and length(email)<=254), token_hash text not null unique,
 status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
 expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now()
);
create unique index if not exists blue_org_pending_email on public.blue_organization_invitations(organization_id,email) where status='pending';
create table if not exists public.blue_organization_events (
 id bigint generated always as identity primary key, organization_id uuid not null references public.blue_organizations(id),
 actor_id uuid references auth.users(id), request_id text, payment_id uuid, kind text not null,
 credits numeric(18,10) not null default 0, created_at timestamptz not null default now()
);
create index if not exists blue_org_events_usage on public.blue_organization_events(organization_id,actor_id,created_at);
create unique index if not exists blue_org_payment_once on public.blue_organization_events(payment_id) where kind='purchase';
drop trigger if exists blue_org_events_immutable on public.blue_organization_events;
create trigger blue_org_events_immutable before update or delete on public.blue_organization_events
 for each row execute function public.blue_credit_events_immutable();
alter table public.blue_runtime_tasks add column if not exists organization_id uuid references public.blue_organizations(id);
alter table public.billing_reservations add column if not exists organization_id uuid references public.blue_organizations(id);
alter table public.credit_payments add column if not exists organization_id uuid references public.blue_organizations(id);
create index if not exists blue_org_task_holds on public.billing_reservations(organization_id,user_id) where status='pending';

create or replace function public.blue_organization_create(actor uuid,organization_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verified account required';end if;
 if (select count(*) from public.blue_organizations where owner_id=actor)>=20 then raise exception 'Organization limit reached';end if;
 insert into public.blue_organizations(owner_id,name) values(actor,trim(organization_name)) returning id into result;
 insert into public.blue_organization_wallets(organization_id) values(result);
 insert into public.blue_organization_members(organization_id,user_id) values(result,actor);
 return result;
end;$$;

create or replace function public.blue_organization_context(actor uuid,org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.blue_organizations%rowtype;m public.blue_organization_members%rowtype;w public.blue_organization_wallets%rowtype;
begin
 select * into o from public.blue_organizations where id=org;
 select * into m from public.blue_organization_members where organization_id=org and user_id=actor and active;
 if m.user_id is null or o.status<>'active' or exists(select 1 from public.blue_profiles where user_id=actor and status='suspended') then raise exception 'Organization access denied';end if;
 select * into w from public.blue_organization_wallets where organization_id=org;
 return jsonb_build_object('id',org,'name',o.name,'owner',o.owner_id=actor,'available',w.available,'held',w.held,
  'purchased',w.purchased,'spent',w.spent,'seat_limit',floor(w.purchased/10),'member_spent',m.spent,
  'member_held',m.held,'spend_cap',m.spend_cap,'allowance',least(w.available,case when m.spend_cap is null then w.available else greatest(0,m.spend_cap-m.spent-m.held) end),
  'funded',w.available+w.held>0);
end;$$;

create or replace function public.blue_organization_invite(actor uuid,org uuid,invite_email text,hash_param text) returns uuid
language plpgsql security definer set search_path='' as $$
declare seats integer;used integer;result uuid;address text:=lower(trim(invite_email));
begin
 perform 1 from public.blue_organizations where id=org and owner_id=actor and status='active' for update;
 if not found then raise exception 'Organization owner required';end if;
 if address is null or address!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(address)>254
  or hash_param!~'^[0-9a-f]{64}$' then raise exception 'Invalid invitation';end if;
 update public.blue_organization_invitations set status='expired' where organization_id=org and status='pending' and expires_at<=now();
 if exists(select 1 from public.blue_organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=org and m.active and lower(u.email)=address) then raise exception 'Member already belongs to organization';end if;
 select floor(purchased/10) into seats from public.blue_organization_wallets where organization_id=org;
 select (select count(*) from public.blue_organization_members where organization_id=org and active)
  +(select count(*) from public.blue_organization_invitations where organization_id=org and status='pending') into used;
 if used>=seats then raise exception 'Organization seat limit reached';end if;
 insert into public.blue_organization_invitations(organization_id,email,token_hash) values(org,address,hash_param) returning id into result;
 insert into public.blue_organization_events(organization_id,actor_id,kind) values(org,actor,'invitation_created');return result;
end;$$;

create or replace function public.blue_organization_revoke_invite(actor uuid,org uuid,invitation uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.blue_organizations where id=org and owner_id=actor for update;
 if not found then raise exception 'Organization owner required';end if;
 if exists(select 1 from public.blue_organization_invitations where id=invitation and organization_id=org and status='accepted') then raise exception 'Invitation was already accepted. Remove the member instead.';end if;
 update public.blue_organization_invitations set status='revoked' where id=invitation and organization_id=org and status='pending';
 if found then insert into public.blue_organization_events(organization_id,actor_id,kind) values(org,actor,'invitation_revoked');end if;
 return true;
end;$$;

create or replace function public.blue_organization_accept(actor uuid,hash_param text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.blue_organization_invitations%rowtype;address text;target uuid;
begin
 select organization_id into target from public.blue_organization_invitations where token_hash=hash_param;
 perform 1 from public.blue_organizations where id=target and status='active' for update;
 if not found then raise exception 'Invitation unavailable';end if;
 select * into i from public.blue_organization_invitations where token_hash=hash_param for update;
 select lower(email) into address from auth.users where id=actor and email_confirmed_at is not null;
 if i.id is null or i.status not in ('pending','accepted') or i.email is distinct from address or i.expires_at<=now()
  then raise exception 'Invitation unavailable or sign-in email does not match';end if;
 if i.status='accepted' then
  if not exists(select 1 from public.blue_organization_members where organization_id=target and user_id=actor and active)
   then raise exception 'Invitation no longer active';end if;return target;
 end if;
 -- The pending invitation already owns its seat. Preserve lifetime counters on rejoin.
 insert into public.blue_organization_members(organization_id,user_id) values(target,actor)
  on conflict(organization_id,user_id) do update set active=true;
 update public.blue_organization_invitations set status='accepted' where id=i.id;
 insert into public.blue_organization_events(organization_id,actor_id,kind) values(target,actor,'member_joined');return target;
end;$$;

create or replace function public.blue_organization_member_update(actor uuid,org uuid,member uuid,remove_param boolean,cap_param numeric) returns boolean
language plpgsql security definer set search_path='' as $$
declare m public.blue_organization_members%rowtype;
begin
 perform 1 from public.blue_organizations where id=org and owner_id=actor for update;
 if not found then raise exception 'Organization owner required';end if;
 select * into m from public.blue_organization_members where organization_id=org and user_id=member for update;
 if not found then raise exception 'Member not found';end if;
 if remove_param and actor=member then raise exception 'Owner cannot remove their own seat';end if;
 if not remove_param and cap_param is not null and (cap_param<0 or cap_param<m.spent+m.held)
  then raise exception 'Spending cap must cover already spent and reserved credits';end if;
 update public.blue_organization_members set active=case when remove_param then false else active end,
  spend_cap=case when remove_param then spend_cap else cap_param end where organization_id=org and user_id=member;
 insert into public.blue_organization_events(organization_id,actor_id,kind) values(org,actor,case when remove_param then 'member_removed' else 'member_cap_changed' end);
 return true;
end;$$;

-- Task lock is always first; member lock second; shared wallet only for task budget changes.
create or replace function public.blue_organization_hold(actor uuid,org uuid,task_id text,amount numeric) returns numeric
language plpgsql security definer set search_path='' as $$
declare m public.blue_organization_members%rowtype;funds numeric;
begin
 if amount is null or amount<0 then raise exception 'Invalid reservation amount';end if;
 select * into m from public.blue_organization_members where organization_id=org and user_id=actor for update;
 if not found or not m.active or exists(select 1 from public.blue_profiles where user_id=actor and status='suspended') or not exists(select 1 from public.blue_organizations where id=org and status='active') then raise exception 'Organization access denied';end if;
 if m.spend_cap is not null and m.spent+m.held+amount>m.spend_cap then raise exception 'Organization member credit cap reached';end if;
 update public.blue_organization_wallets set available=available-amount,held=held+amount
  where organization_id=org and available>=amount and available+held>0 returning available into funds;
 if funds is null then raise exception 'Insufficient Organization Blue Credits';end if;
 update public.blue_organization_members set held=held+amount where organization_id=org and user_id=actor;
 insert into public.blue_organization_events(organization_id,actor_id,request_id,kind,credits) values(org,actor,task_id,'hold',amount);
 return funds;
end;$$;

create or replace function public.blue_organization_finish_hold(actor uuid,org uuid,task_id text,reserved numeric,charge numeric) returns numeric
language plpgsql security definer set search_path='' as $$
declare funds numeric;
begin
 if charge is null or charge<0 or charge>reserved then raise exception 'Invalid Organization settlement';end if;
 perform 1 from public.blue_organization_members where organization_id=org and user_id=actor for update;
 update public.blue_organization_wallets set available=available+reserved-charge,held=held-reserved,spent=spent+charge
  where organization_id=org and held>=reserved returning available into funds;
 if funds is null then raise exception 'Organization hold is unavailable';end if;
 update public.blue_organization_members set held=held-reserved,spent=spent+charge where organization_id=org and user_id=actor;
 insert into public.blue_organization_events(organization_id,actor_id,request_id,kind,credits) values(org,actor,task_id,'charge',charge),(org,actor,task_id,'refund',reserved-charge);
 return funds;
end;$$;

create or replace function public.assert_blue_organization_task(task_id text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.blue_runtime_tasks%rowtype;m public.blue_organization_members%rowtype;
begin
 select * into t from public.blue_runtime_tasks where request_id=task_id;
 if t.organization_id is null then return;end if;
 select * into m from public.blue_organization_members where organization_id=t.organization_id and user_id=t.user_id for update;
 if not found or not m.active or exists(select 1 from public.blue_profiles where user_id=t.user_id and status='suspended') or not exists(select 1 from public.blue_organizations where id=t.organization_id and status='active')
  then raise exception 'Organization access denied';end if;
 if m.spend_cap is not null and m.spent+m.held>m.spend_cap then raise exception 'Organization member credit cap reached';end if;
 if not exists(select 1 from public.blue_organization_wallets where organization_id=t.organization_id and held>=t.reserved_blue_credits) then raise exception 'Organization task budget is unavailable';end if;
 if not exists(select 1 from public.billing_reservations r where r.request_id=t.request_id and r.user_id=t.user_id
  and r.organization_id=t.organization_id and r.status='pending' and r.reserved_blue_credits=t.reserved_blue_credits)
  then raise exception 'Organization task budget is unavailable';end if;
end;$$;

create or replace function public.admit_blue_organization_task(
 user_id_param uuid,request_id_param text,device_hash_param text,payload_hash_param text,model_param text,mode_param text,
 is_free_param boolean,access_tier_param text,amount_param numeric,global_limit_param integer,queue_limit_param integer,
 queue_expires_at_param timestamptz,active_expires_at_param timestamptz,reviewer_model_param text,feature_param text,purpose_param text,organization_id_param uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.blue_runtime_tasks%rowtype;context jsonb;position integer;
begin
 if request_id_param is null or request_id_param!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' or length(device_hash_param)<>64 or length(payload_hash_param)<>64
  or mode_param not in ('normal','ui_max') or feature_param not in ('project','teams') or purpose_param not in ('text','image')
  or amount_param is null or amount_param<0 or queue_expires_at_param<=now() or active_expires_at_param<=now() then raise exception 'Invalid Organization task';end if;
 perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));
 select * into t from public.blue_runtime_tasks where request_id=request_id_param for update;
 if t.request_id is not null then
  if t.user_id<>user_id_param or t.organization_id is distinct from organization_id_param or t.device_hash<>device_hash_param or t.payload_hash<>payload_hash_param
   or t.model<>model_param or t.reviewer_model is distinct from reviewer_model_param or t.feature<>feature_param or t.proxy_purpose<>purpose_param
   then raise exception 'Organization task identity conflict';end if;
 else
  context:=public.blue_organization_context(user_id_param,organization_id_param);
  if not (context->>'funded')::boolean then raise exception 'Insufficient Organization Blue Credits';end if;
  if (select count(*) from public.blue_runtime_tasks where state='queued' and queue_expires_at>now())>=greatest(1,least(queue_limit_param,10000)) then raise exception 'Blue runtime queue is full';end if;
  insert into public.blue_runtime_tasks(request_id,user_id,organization_id,device_hash,payload_hash,model,mode,is_free,access_tier,state,
   requested_blue_credits,reserved_blue_credits,queued_at,queue_expires_at,expires_at,runtime_transport,reviewer_model,feature,proxy_purpose,credit_multiplier)
  values(request_id_param,user_id_param,organization_id_param,device_hash_param,payload_hash_param,model_param,mode_param,is_free_param,'full','queued',
   amount_param,0,now(),queue_expires_at_param,queue_expires_at_param,'ticket',reviewer_model_param,feature_param,purpose_param,1);
 end if;
 perform public.promote_blue_runtime_queue(global_limit_param,greatest(1,least(global_limit_param,250)),active_expires_at_param);
 select * into t from public.blue_runtime_tasks where request_id=request_id_param;
 select count(*) into position from public.blue_runtime_tasks where state='queued' and queue_expires_at>now() and (queued_at,request_id)<=(t.queued_at,t.request_id);
 return jsonb_build_object('accepted',true,'state',t.state,'remaining',(select available from public.blue_organization_wallets where organization_id=organization_id_param),'queue_position',position);
end;$$;

-- Billing context cannot be changed through any legacy/task update path.
create or replace function public.blue_organization_binding_immutable() returns trigger language plpgsql set search_path='' as $$
begin if new.organization_id is distinct from old.organization_id then raise exception 'Billing context is immutable';end if;return new;end;$$;
drop trigger if exists blue_org_task_binding on public.blue_runtime_tasks;
create trigger blue_org_task_binding before update on public.blue_runtime_tasks for each row execute function public.blue_organization_binding_immutable();
drop trigger if exists blue_org_payment_binding on public.credit_payments;
create trigger blue_org_payment_binding before update on public.credit_payments for each row execute function public.blue_organization_binding_immutable();

-- Security is completed with explicit service-only grants at the end of this migration.

create or replace function public.blue_personal_reserve_blue_credits(
  user_id_param uuid,
  request_id_param text,
  model_param text,
  amount_param numeric
) returns jsonb as $$
declare
  profile_record public.blue_profiles%rowtype;
  existing_record public.billing_reservations%rowtype;
  new_balance numeric;
begin
  if request_id_param is null or length(trim(request_id_param)) < 8 then
    raise exception 'Invalid request ID';
  end if;
  if amount_param is null or amount_param < 0 then
    raise exception 'Invalid reservation amount';
  end if;

  perform public.release_expired_blue_credit_reservations(user_id_param);

  select * into profile_record
    from public.blue_profiles
    where user_id = user_id_param;

  if profile_record.user_id is null
     or profile_record.status <> 'active'
     or profile_record.total_credits_purchased <= 0 then
    raise exception 'Blue Pro is not active';
  end if;

  select * into existing_record
    from public.billing_reservations
    where request_id = request_id_param
    for update;

  if existing_record.request_id is not null then
    if existing_record.user_id <> user_id_param then
      raise exception 'Request ID already belongs to another user';
    end if;
    if existing_record.model <> model_param then
      raise exception 'Request ID model does not match the original request';
    end if;

    -- A released reservation represents a confirmed failed upstream attempt.
    -- It may be reactivated for the next attempt under the same public request
    -- ID. Pending and settled requests are never sent upstream again.
    if existing_record.status = 'released' then
      if amount_param > 0 then
        update public.wallets
          set blue_credits = coalesce(blue_credits, 0) - amount_param,
              updated_at = now()
          where user_id = user_id_param
            and account_type = 'pro_payg'
            and coalesce(blue_credits, 0) >= amount_param
          returning blue_credits into new_balance;
      else
        select blue_credits into new_balance
          from public.wallets
          where user_id = user_id_param and account_type = 'pro_payg';
      end if;
      if new_balance is null then
        raise exception 'Insufficient Blue Credits';
      end if;

      update public.billing_reservations
        set status = 'pending',
            reserved_blue_credits = amount_param,
            charged_blue_credits = null,
            provider_cost = null,
            prompt_tokens = null,
            completion_tokens = null,
            balance_after = null,
            expires_at = now() + interval '15 minutes',
            settled_at = null
        where request_id = request_id_param;

      return jsonb_build_object(
        'request_id', request_id_param,
        'reserved', amount_param,
        'remaining', new_balance,
        'status', 'pending',
        'accepted', true,
        'reactivated', true
      );
    end if;

    select blue_credits into new_balance from public.wallets where user_id = user_id_param;
    return jsonb_build_object(
      'request_id', existing_record.request_id,
      'reserved', existing_record.reserved_blue_credits,
      'remaining', coalesce(new_balance, 0),
      'status', existing_record.status,
      'accepted', false,
      'reactivated', false
    );
  end if;

  if amount_param > 0 then
    update public.wallets
      set blue_credits = coalesce(blue_credits, 0) - amount_param,
          updated_at = now()
      where user_id = user_id_param
        and account_type = 'pro_payg'
        and coalesce(blue_credits, 0) >= amount_param
      returning blue_credits into new_balance;

    if new_balance is null then
      raise exception 'Insufficient Blue Credits';
    end if;
  else
    select blue_credits into new_balance
      from public.wallets
      where user_id = user_id_param and account_type = 'pro_payg';
    if new_balance is null then
      raise exception 'Blue Pro wallet not found';
    end if;
  end if;

  insert into public.billing_reservations (
    request_id, user_id, model, reserved_blue_credits
  ) values (
    request_id_param, user_id_param, model_param, amount_param
  );

  return jsonb_build_object(
    'request_id', request_id_param,
    'reserved', amount_param,
    'remaining', new_balance,
    'status', 'pending',
    'accepted', true,
    'reactivated', false
  );
end;
$$ language plpgsql security definer set search_path = public;
create or replace function public.reserve_blue_credits(
  user_id_param uuid,
  request_id_param text,
  model_param text,
  amount_param numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r public.billing_reservations%rowtype;t public.blue_runtime_tasks%rowtype;p public.credit_payments%rowtype;funds numeric;charge numeric;
begin

  select organization_id into org from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if org is null then return public.blue_personal_reserve_blue_credits(user_id_param,request_id_param,model_param,amount_param);end if;
  select * into r from public.billing_reservations where request_id=request_id_param for update;
  if r.request_id is not null then
   if r.user_id<>user_id_param or r.organization_id is distinct from org or r.model<>model_param then raise exception 'Reservation identity conflict';end if;
   return jsonb_build_object('accepted',false,'reserved',r.reserved_blue_credits,'status',r.status,'remaining',(select available from public.blue_organization_wallets where organization_id=org));
  end if;
  funds:=public.blue_organization_hold(user_id_param,org,request_id_param,amount_param);
  insert into public.billing_reservations(request_id,user_id,organization_id,model,reserved_blue_credits,credit_multiplier)
   values(request_id_param,user_id_param,org,model_param,amount_param,1);
  return jsonb_build_object('accepted',true,'reserved',amount_param,'remaining',funds,'status','pending','reactivated',false);

end;$$;

create or replace function public.blue_personal_settle_blue_credit_reservation(user_id_param uuid,request_id_param text,
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
create or replace function public.settle_blue_credit_reservation(user_id_param uuid,request_id_param text,
  provider_cost_param numeric,blue_credit_multiplier_param numeric,prompt_tokens_param bigint,completion_tokens_param bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r public.billing_reservations%rowtype;t public.blue_runtime_tasks%rowtype;p public.credit_payments%rowtype;funds numeric;charge numeric;
begin

  perform 1 from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  select * into r from public.billing_reservations where request_id=request_id_param and user_id=user_id_param for update;
  if r.organization_id is null then return public.blue_personal_settle_blue_credit_reservation(user_id_param,request_id_param,provider_cost_param,blue_credit_multiplier_param,prompt_tokens_param,completion_tokens_param);end if;
  if r.status='settled' then return jsonb_build_object('charged',r.charged_blue_credits,'remaining',r.balance_after,'provider_cost',r.provider_cost,'status','settled');end if;
  if r.status<>'pending' or provider_cost_param is null or provider_cost_param<0 then raise exception 'Invalid Organization settlement';end if;
  charge:=round(provider_cost_param*r.credit_multiplier,10);
  funds:=public.blue_organization_finish_hold(user_id_param,r.organization_id,request_id_param,r.reserved_blue_credits,charge);
  update public.billing_reservations set status='settled',charged_blue_credits=charge,provider_cost=provider_cost_param,
   prompt_tokens=greatest(prompt_tokens_param,0),completion_tokens=greatest(completion_tokens_param,0),balance_after=funds,settled_at=now() where request_id=request_id_param;
  return jsonb_build_object('charged',charge,'remaining',funds,'provider_cost',provider_cost_param,'status','settled');

end;$$;

create or replace function public.blue_personal_release_blue_credit_reservation(
  user_id_param uuid,
  request_id_param text
) returns jsonb as $$
declare
  reservation_record public.billing_reservations%rowtype;
  new_balance numeric;
begin
  select * into reservation_record
    from public.billing_reservations
    where request_id = request_id_param and user_id = user_id_param
    for update;

  if reservation_record.request_id is null then
    raise exception 'Billing reservation not found';
  end if;

  if reservation_record.status <> 'pending' then
    select blue_credits into new_balance from public.wallets where user_id = user_id_param;
    return jsonb_build_object('request_id', request_id_param, 'remaining', coalesce(new_balance, 0), 'status', reservation_record.status);
  end if;

  update public.wallets
    set blue_credits = coalesce(blue_credits, 0) + reservation_record.reserved_blue_credits,
        updated_at = now()
    where user_id = user_id_param
    returning blue_credits into new_balance;

  update public.billing_reservations
    set status = 'released', balance_after = new_balance, settled_at = now()
    where request_id = request_id_param;

  return jsonb_build_object('request_id', request_id_param, 'remaining', new_balance, 'status', 'released');
end;
$$ language plpgsql security definer set search_path = public;
create or replace function public.release_blue_credit_reservation(
  user_id_param uuid,
  request_id_param text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r public.billing_reservations%rowtype;t public.blue_runtime_tasks%rowtype;p public.credit_payments%rowtype;funds numeric;charge numeric;
begin

  perform 1 from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  select * into r from public.billing_reservations where request_id=request_id_param and user_id=user_id_param for update;
  if r.organization_id is null then return public.blue_personal_release_blue_credit_reservation(user_id_param,request_id_param);end if;
  if r.status<>'pending' then return jsonb_build_object('remaining',r.balance_after,'status',r.status);end if;
  funds:=public.blue_organization_finish_hold(user_id_param,r.organization_id,request_id_param,r.reserved_blue_credits,0);
  update public.billing_reservations set status='released',balance_after=funds,settled_at=now() where request_id=request_id_param;
  return jsonb_build_object('remaining',funds,'status','released');

end;$$;

create or replace function public.blue_personal_extend_blue_runtime_task_v2(user_id_param uuid,request_id_param text,
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
create or replace function public.extend_blue_runtime_task_v2(user_id_param uuid,request_id_param text,
  extension_id_param text,amount_param numeric,expires_at_param timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r public.billing_reservations%rowtype;t public.blue_runtime_tasks%rowtype;p public.credit_payments%rowtype;funds numeric;charge numeric;
begin

  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param for update;
  if t.organization_id is null then return public.blue_personal_extend_blue_runtime_task_v2(user_id_param,request_id_param,extension_id_param,amount_param,expires_at_param);end if;
  if exists(select 1 from public.blue_runtime_extensions where request_id=request_id_param and extension_id=extension_id_param and state='applied') then
   return jsonb_build_object('duplicate',true,'remaining',(select available from public.blue_organization_wallets where organization_id=t.organization_id));end if;
  if t.state not in ('provisioning','active') or amount_param is null or amount_param<=0 or expires_at_param<=now()
   or extension_id_param!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$' then raise exception 'Invalid Organization extension';end if;
  perform public.assert_blue_organization_task(request_id_param);
  funds:=public.blue_organization_hold(user_id_param,t.organization_id,request_id_param,amount_param);
  update public.billing_reservations set reserved_blue_credits=reserved_blue_credits+amount_param,expires_at=expires_at_param+interval '10 minutes' where request_id=request_id_param and status='pending';
  if not found then raise exception 'Reservation is not pending';end if;
  update public.blue_runtime_tasks set reserved_blue_credits=reserved_blue_credits+amount_param,expires_at=greatest(expires_at,expires_at_param),updated_at=now() where request_id=request_id_param;
  insert into public.blue_runtime_extensions(request_id,extension_id,user_id,amount,state,updated_at) values(request_id_param,extension_id_param,user_id_param,amount_param,'applied',now());
  return jsonb_build_object('extended',true,'reserved',t.reserved_blue_credits+amount_param,'remaining',funds);

end;$$;

create or replace function public.blue_personal_complete_blue_credit_payment(payment_id_param uuid,provider_txnid_param text)
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
create or replace function public.complete_blue_credit_payment(payment_id_param uuid,provider_txnid_param text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;r public.billing_reservations%rowtype;t public.blue_runtime_tasks%rowtype;p public.credit_payments%rowtype;funds numeric;charge numeric;
begin

  select * into p from public.credit_payments where id=payment_id_param and provider_txnid=provider_txnid_param for update;
  if p.organization_id is null then return public.blue_personal_complete_blue_credit_payment(payment_id_param,provider_txnid_param);end if;
  if p.status='completed' then return jsonb_build_object('already_processed',true,'credits',p.credits_purchased);end if;
  if p.status<>'pending' or p.credits_purchased<50 or p.credits_purchased>1000 or p.credits_purchased<>trunc(p.credits_purchased)
   or p.payment_provider not in ('payu','paypal') then raise exception 'Invalid Organization payment';end if;
  perform 1 from public.blue_organizations where id=p.organization_id and owner_id=p.user_id and status='active' for update;
  if not found then raise exception 'Organization payment owner mismatch';end if;
  update public.blue_organization_wallets set available=available+p.credits_purchased,purchased=purchased+p.credits_purchased where organization_id=p.organization_id returning available into funds;
  insert into public.blue_organization_events(organization_id,actor_id,payment_id,kind,credits) values(p.organization_id,p.user_id,p.id,'purchase',p.credits_purchased);
  update public.credit_payments set status='completed',completed_at=now(),provider_order_id=provider_txnid_param where id=p.id;
  return jsonb_build_object('credits',p.credits_purchased,'remaining',funds);

end;$$;

create or replace function public.admit_blue_runtime_task_v5(
  user_id_param uuid,request_id_param text,device_hash_param text,payload_hash_param text,
  model_param text,mode_param text,is_free_param boolean,access_tier_param text,amount_param numeric,
  global_limit_param integer,queue_limit_param integer,queue_expires_at_param timestamptz,
  active_expires_at_param timestamptz,reviewer_model_param text,feature_param text,purpose_param text
) returns jsonb as $$
declare result jsonb; t public.blue_runtime_tasks%rowtype;
begin
 if exists(select 1 from public.blue_runtime_tasks where request_id=request_id_param and organization_id is not null) then raise exception 'Task billing context conflict';end if;
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

create or replace function public.authorize_blue_proxy_task(user_id_param uuid,request_id_param text,device_hash_param text,model_param text)
returns jsonb as $$
declare t public.blue_runtime_tasks%rowtype;
begin
  select * into t from public.blue_runtime_tasks where request_id=request_id_param and user_id=user_id_param;
  if t.request_id is null or t.runtime_transport<>'ticket' or t.state<>'active' or t.expires_at<=now()
    or t.device_hash<>device_hash_param or not(model_param=any(t.proxy_models))
    or (t.organization_id is null and not exists(select 1 from public.blue_profiles where user_id=user_id_param and status='active'))
    or exists(select 1 from public.blue_runtime_model_blocks where model in (t.model,model_param))
    then raise exception 'Task access denied'; end if;
  perform public.assert_blue_organization_task(request_id_param);
  return jsonb_build_object('purpose',t.proxy_purpose,'is_free',t.is_free,'model',t.model,
    'reviewer_model',t.reviewer_model,'provider_ceiling',case when t.is_free and t.reviewer_model is null then 0
      else t.reserved_blue_credits/t.credit_multiplier end,'spent',t.provider_cost,'committed',t.proxy_committed_cost);
end;
$$ language plpgsql security definer set search_path=public;

create or replace function public.blue_credit_snapshot(user_id_param uuid)
returns jsonb as $$
  with wallet as (
    select greatest(coalesce(blue_credits, 0), 0) as available
      from public.wallets where user_id = user_id_param
  ), holds as (
    select
      coalesce(sum(reservation.reserved_blue_credits), 0) as held,
      count(*) filter (where reservation.reserved_blue_credits > 0) as hold_count,
      coalesce(sum(reservation.reserved_blue_credits) filter (
        where task.state = 'stopping'
      ), 0) as pending_settlement,
      count(*) filter (
        where task.state = 'stopping' and reservation.reserved_blue_credits > 0
      ) as pending_settlement_count
      from public.billing_reservations reservation
      left join public.blue_runtime_tasks task
        on task.request_id = reservation.request_id
       and task.user_id = reservation.user_id
     where reservation.user_id = user_id_param and reservation.status = 'pending' and reservation.organization_id is null
  )
  select jsonb_build_object(
    'available_blue_credits', coalesce((select available from wallet), 0),
    'temporarily_held_blue_credits', held,
    'total_blue_credits', coalesce((select available from wallet), 0) + held,
    'hold_count', hold_count,
    'pending_settlement_blue_credits', pending_settlement,
    'pending_settlement_count', pending_settlement_count,
    'as_of', statement_timestamp()
  ) from holds;
$$ language sql stable security definer set search_path = public;

create or replace function public.refresh_blue_teams_credit_access(user_id_param uuid)
returns numeric as $$
declare funds numeric;
begin
  perform 1 from public.wallets where user_id=user_id_param for update;
  select coalesce((select blue_credits from public.wallets where user_id=user_id_param),0)
    + coalesce((select sum(reserved_blue_credits) from public.billing_reservations
      where user_id=user_id_param and organization_id is null and status='pending'),0) into funds;
  if funds<=0 then
    update public.blue_teams_credit_access set depleted_at=coalesce(depleted_at,now()),updated_at=now()
      where user_id=user_id_param and depleted_at is null;
  end if;
  return greatest(funds,0);
end;
$$ language plpgsql security definer set search_path=public;


create or replace function public.blue_organization_list(actor uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(public.blue_organization_context(actor,o.id) order by o.created_at),'[]'::jsonb)
 from public.blue_organizations o join public.blue_organization_members m on m.organization_id=o.id
 where m.user_id=actor and m.active and o.status='active';
$$;
create or replace function public.blue_organization_admin_snapshot(actor uuid,org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context jsonb;
begin
 context:=public.blue_organization_context(actor,org);
 if not (context->>'owner')::boolean then return jsonb_build_object('organization',context);end if;
 return jsonb_build_object('organization',context,
  'members',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'active',m.active,'spent',m.spent,'held',m.held,'spend_cap',m.spend_cap,'joined_at',m.joined_at) order by m.joined_at),'[]'::jsonb)
   from public.blue_organization_members m join auth.users u on u.id=m.user_id where m.organization_id=org),
  'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'status',i.status,'expires_at',i.expires_at) order by i.created_at),'[]'::jsonb)
   from public.blue_organization_invitations i where i.organization_id=org and i.status='pending' and i.expires_at>now()));
end;$$;

do $$declare tab text;f record;begin
 foreach tab in array array['blue_organizations','blue_organization_wallets','blue_organization_members','blue_organization_invitations','blue_organization_events'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant all on public.%I to service_role',tab);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and
  (proname like 'blue_organization_%' or proname like 'blue_personal_%' or proname in ('assert_blue_organization_task','admit_blue_organization_task')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;$$;
grant usage,select on sequence public.blue_organization_events_id_seq to service_role;
notify pgrst,'reload schema';
commit;
