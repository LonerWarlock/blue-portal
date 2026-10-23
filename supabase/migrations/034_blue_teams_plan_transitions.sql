-- Prepaid Teams transitions. Upgrades keep the current expiry and charge only
-- the remaining-period difference. Downgrades are preferences, never a charge
-- or an automatic entitlement. Existing verified legacy receipts remain valid.
begin;

create table if not exists public.blue_teams_payment_reviews (
  payment_order_id uuid primary key references public.payment_orders(id),
  user_id uuid not null references auth.users(id),
  reason text not null,
  quote jsonb not null,
  subscription_snapshot jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  check ((resolved_at is null and resolution is null)
    or (resolved_at is not null and resolution is not null and length(trim(resolution))>0))
);
alter table public.blue_teams_payment_reviews enable row level security;
revoke all on public.blue_teams_payment_reviews from public, anon, authenticated, service_role;
grant select on public.blue_teams_payment_reviews to service_role;

create or replace function public.blue_teams_catalog_price(tier_param text, currency_param text,
  is_test_param boolean default false, live_test_param boolean default false)
returns numeric language sql immutable set search_path = '' as $$
  select case when currency_param not in ('INR','USD') then null
    when is_test_param and tier_param = 'solo' or live_test_param and tier_param = 'business'
      then case when currency_param = 'INR' then 1 else 0.01 end
    else case tier_param
      when 'solo' then case when currency_param = 'INR' then 499 else 5.27 end
      when 'pro' then case when currency_param = 'INR' then 1499 else 15.83 end
      when 'business' then case when currency_param = 'INR' then 4999 else 52.78 end
    end end
$$;
revoke all on function public.blue_teams_catalog_price(text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.blue_teams_catalog_price(text,text,boolean,boolean) to service_role;

create or replace function public.validate_blue_teams_checkout(session_id_param uuid, currency_param text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  checkout public.checkout_sessions%rowtype;
  subscription public.team_subscriptions%rowtype;
  quote jsonb;
  sandbox boolean;
begin
  if currency_param not in ('INR','USD') or currency_param is null then
    raise exception 'Choose a supported payment currency';
  end if;
  select * into checkout from public.checkout_sessions where id = session_id_param;
  quote := checkout.metadata->'teams_quote';
  if checkout.id is null or checkout.status <> 'pending' or checkout.expires_at <= now()
     or coalesce(quote->>'version','') <> '1' then
    raise exception 'This checkout is no longer available. Start again before paying';
  end if;
  if quote->>'currency_locked' is not null and quote->>'currency_locked' <> currency_param then
    raise exception 'This upgrade must use the currency of the existing paid plan';
  end if;
  sandbox := coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false);
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || checkout.user_id::text || ':' || sandbox::text,0));
  if exists(select 1 from public.blue_teams_payment_reviews r join public.payment_orders p on p.id=r.payment_order_id
      join public.checkout_sessions c on c.id=p.checkout_session_id where r.user_id=checkout.user_id and r.resolved_at is null
      and coalesce((c.metadata->>'blue_teams_test_mode')::boolean,false)=sandbox) then
    raise exception 'A collected Teams payment is awaiting review. Do not pay again; contact support to reconcile that receipt';
  end if;
  select * into subscription from public.team_subscriptions where user_id = checkout.user_id and is_test = sandbox;
  if quote->>'mode' = 'upgrade' then
    if subscription.id::text is distinct from quote->>'expected_subscription_id'
       or subscription.plan is distinct from quote->>'from_plan'
       or subscription.status is distinct from 'active'
       or subscription.current_period_end is distinct from (quote->>'expected_period_end')::timestamptz
       or subscription.current_period_start is distinct from (quote->>'expected_period_start')::timestamptz
       or subscription.payment_order_id::text is distinct from quote->>'expected_payment_order_id'
       or subscription.current_period_end <= now() then
      raise exception 'Your Teams access changed. Refresh your plan and start a new checkout before paying';
    end if;
  elsif subscription.status = 'active' and subscription.current_period_end > now()
      and subscription.plan is distinct from substring(checkout.plan from 12) then
    raise exception 'Your Teams plan changed. Refresh your plan and start a new checkout before paying';
  end if;
  return quote || jsonb_build_object('session_id',checkout.id,'quote_version',1,
    'quote_mode',quote->>'mode','current_period_end',subscription.current_period_end);
end;
$$;
revoke all on function public.validate_blue_teams_checkout(uuid,text) from public, anon, authenticated;
grant execute on function public.validate_blue_teams_checkout(uuid,text) to service_role;

create or replace function public.create_blue_teams_checkout(user_id_param uuid, tier_param text,
  is_test_param boolean default false, live_test_param boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  subscription public.team_subscriptions%rowtype;
  prior_checkout public.checkout_sessions%rowtype;
  source_order public.payment_orders%rowtype;
  quote jsonb;
  session_id uuid := gen_random_uuid();
  quoted_at timestamptz := now();
  starts_at timestamptz := now();
  ends_at timestamptz := now() + interval '30 days';
  expires_at timestamptz := now() + interval '15 minutes';
  mode text := 'new';
  current_rank integer;
  target_rank integer;
  remaining_ratio numeric := 1;
  source_inr numeric := 0;
  source_usd numeric := 0;
  amount_inr numeric;
  amount_usd numeric;
  locked_currency text;
  has_payment boolean;
  unresolved_intents integer;
begin
  if user_id_param is null or not exists(select 1 from auth.users where id=user_id_param)
     or tier_param is null or tier_param not in ('solo','pro','business')
     or is_test_param is null or live_test_param is null
     or is_test_param and live_test_param
     or is_test_param and tier_param <> 'solo'
     or live_test_param and tier_param <> 'business' then
    raise exception 'Invalid Teams account, tier or checkout mode';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || user_id_param::text || ':' || is_test_param::text,0));
  select * into subscription from public.team_subscriptions where user_id=user_id_param and is_test=is_test_param for update;
  if exists(select 1 from public.blue_teams_payment_reviews r join public.payment_orders p on p.id=r.payment_order_id
      join public.checkout_sessions c on c.id=p.checkout_session_id where r.user_id=user_id_param and r.resolved_at is null
      and coalesce((c.metadata->>'blue_teams_test_mode')::boolean,false)=is_test_param) then
    raise exception 'A collected Teams payment is awaiting review. Do not pay again; contact support to reconcile that receipt';
  end if;
  select count(*)::integer into unresolved_intents from public.checkout_sessions c
    where c.user_id=user_id_param and c.plan in ('blue_teams_solo','blue_teams_pro','blue_teams_business')
      and c.status='pending' and coalesce((c.metadata->>'blue_teams_test_mode')::boolean,false)=is_test_param
      and (c.expires_at>now() or exists(select 1 from public.payment_orders p where p.checkout_session_id=c.id
        and p.status in ('pending','completed')));
  if unresolved_intents>1 then
    raise exception 'Multiple Teams checkout attempts need reconciliation. Do not pay again; contact support';
  end if;

  -- Do not offer another payable intent while an older attempt could still
  -- collect money. Expired provider attempts require verified reconciliation.
  for prior_checkout in select c.* from public.checkout_sessions c
    where c.user_id=user_id_param and c.plan in ('blue_teams_solo','blue_teams_pro','blue_teams_business')
      and c.status='pending' and coalesce((c.metadata->>'blue_teams_test_mode')::boolean,false)=is_test_param
    order by c.expires_at desc
  loop
    select exists(select 1 from public.payment_orders p where p.checkout_session_id=prior_checkout.id
      and p.status in ('pending','completed')) into has_payment;
    if prior_checkout.expires_at > now() or has_payment then
      if prior_checkout.plan='blue_teams_' || tier_param and prior_checkout.expires_at>now()
         and coalesce((prior_checkout.metadata->>'blue_teams_live_test_mode')::boolean,false)=live_test_param
         and prior_checkout.metadata->'teams_quote'->>'version'='1' then
        quote := public.validate_blue_teams_checkout(prior_checkout.id,
          coalesce(prior_checkout.metadata->'teams_quote'->>'currency_locked','INR'));
        return quote || jsonb_build_object('reused',true);
      end if;
      raise exception 'A previous Teams checkout is still pending. Finish or resolve it before choosing another plan';
    end if;
    -- No provider order exists, so this unused expired link cannot collect.
    update public.checkout_sessions set status='expired' where id=prior_checkout.id and status='pending';
  end loop;

  target_rank := array_position(array['solo','pro','business'],tier_param);
  if subscription.status='active' and subscription.current_period_end>now() then
    current_rank := array_position(array['solo','pro','business'],subscription.plan);
    if target_rank < current_rank then
      raise exception 'A lower Teams plan starts only after the current plan ends. Schedule the change instead; no payment is required now';
    elsif target_rank = current_rank then
      mode := 'renewal'; starts_at := subscription.current_period_end;
      ends_at := starts_at + interval '30 days';
    else
      mode := 'upgrade'; starts_at := quoted_at; ends_at := subscription.current_period_end;
      remaining_ratio := extract(epoch from (ends_at-quoted_at))::numeric / 2592000;
      if remaining_ratio > 1 then
        raise exception 'This account has more than 30 prepaid days remaining. An upgrade needs a manual billing review; no payment has started';
      end if;
      if subscription.metadata->>'quote_mode'='upgrade' then
        raise exception 'This period already has a prorated upgrade. Another upgrade needs a manual billing review; no payment has started';
      end if;
      if subscription.payment_provider <> 'admin_grant'
         and not coalesce(subscription.metadata->'admin_grant'->>'id'=subscription.last_admin_grant_id::text
           and subscription.metadata->'admin_grant'->>'plan'=subscription.plan,false) then
        select * into source_order from public.payment_orders where id=subscription.payment_order_id;
        if source_order.id is null or source_order.user_id<>user_id_param or source_order.status<>'completed'
           or source_order.product_sku<>'blue_teams_' || subscription.plan || '_monthly'
           or source_order.currency not in ('INR','USD') or source_order.amount<=0 then
          raise exception 'The current prepaid value could not be verified. An upgrade needs a manual billing review; no payment has started';
        end if;
        locked_currency := source_order.currency;
        -- No FX conversion or nominal-value credit for discounts/₹1/grants.
        -- Credit only the actual collected source amount, in that currency.
        if locked_currency='INR' then source_inr := source_order.amount;
        else source_usd := source_order.amount; end if;
      end if;
      expires_at := least(expires_at,ends_at);
    end if;
  end if;
  amount_inr := round(greatest(1,(public.blue_teams_catalog_price(tier_param,'INR',is_test_param,live_test_param)-source_inr)*remaining_ratio),2);
  amount_usd := round(greatest(0.01,(public.blue_teams_catalog_price(tier_param,'USD',is_test_param,live_test_param)-source_usd)*remaining_ratio),2);
  quote := jsonb_build_object('version',1,'mode',mode,'from_plan',case when current_rank is not null then subscription.plan else null end,
    'quoted_at',quoted_at,'expected_subscription_id',subscription.id,'expected_period_start',subscription.current_period_start,
    'expected_period_end',subscription.current_period_end,'expected_payment_order_id',subscription.payment_order_id,
    'effective_start',starts_at,'effective_end',ends_at,'base_amount_inr',to_char(amount_inr,'FM999999990.00'),
    'base_amount_usd',to_char(amount_usd,'FM999999990.00'),'currency_locked',locked_currency);
  insert into public.checkout_sessions(id,user_id,plan,billing_cycle,status,expires_at,metadata)
    values(session_id,user_id_param,'blue_teams_' || tier_param,'monthly','pending',expires_at,
      jsonb_build_object('product_kind','blue_teams','product_sku','blue_teams_' || tier_param || '_monthly',
        'blue_teams_test_mode',is_test_param,'blue_teams_live_test_mode',live_test_param,
        'base_price_inr',quote->>'base_amount_inr','base_price_usd',quote->>'base_amount_usd',
        'currency_inr','INR','currency_usd','USD','duration_days',30,'teams_quote',quote));
  return quote || jsonb_build_object('session_id',session_id,'quote_version',1,'quote_mode',mode,
    'current_period_end',subscription.current_period_end,'reused',false);
end;
$$;
revoke all on function public.create_blue_teams_checkout(uuid,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.create_blue_teams_checkout(uuid,text,boolean,boolean) to service_role;

create or replace function public.schedule_blue_teams_change(user_id_param uuid, tier_param text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare subscription public.team_subscriptions%rowtype; scheduled jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || user_id_param::text || ':false',0));
  select * into subscription from public.team_subscriptions where user_id=user_id_param and is_test=false for update;
  if subscription.id is null or subscription.status<>'active' or subscription.current_period_end<=now()
     or tier_param is null or tier_param not in ('solo','pro','business')
     or array_position(array['solo','pro','business'],tier_param)>=array_position(array['solo','pro','business'],subscription.plan) then
    raise exception 'Only a lower plan can be scheduled while the current Teams plan is active';
  end if;
  if exists(select 1 from public.checkout_sessions c where c.user_id=user_id_param and c.status='pending'
      and c.plan like 'blue_teams_%' and coalesce((c.metadata->>'blue_teams_test_mode')::boolean,false)=false
      and (c.expires_at>now() or exists(select 1 from public.payment_orders p where p.checkout_session_id=c.id and p.status='pending'))) then
    raise exception 'Resolve the pending Teams checkout before scheduling a plan change';
  end if;
  scheduled := jsonb_build_object('plan',tier_param,'change_at',subscription.current_period_end,'payment_required',true);
  update public.team_subscriptions set metadata=metadata || jsonb_build_object('scheduled_change',scheduled),updated_at=now()
    where id=subscription.id;
  return jsonb_build_object('quote_mode','downgrade_scheduled','pending_plan',tier_param,
    'scheduled_change',scheduled,'current_period_end',subscription.current_period_end,'payment_required',true);
end;
$$;
revoke all on function public.schedule_blue_teams_change(uuid,text) from public, anon, authenticated;
grant execute on function public.schedule_blue_teams_change(uuid,text) to service_role;

create or replace function public.cancel_blue_teams_change(user_id_param uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || user_id_param::text || ':false',0));
  update public.team_subscriptions set metadata=metadata-'scheduled_change',updated_at=now()
    where user_id=user_id_param and is_test=false;
  return jsonb_build_object('canceled',true);
end;
$$;
revoke all on function public.cancel_blue_teams_change(uuid) from public, anon, authenticated;
grant execute on function public.cancel_blue_teams_change(uuid) to service_role;

create or replace function public.complete_blue_teams_checkout(session_id_param uuid,provider_param text,
  provider_order_id_param text,provider_transaction_id_param text,payer_email_param text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  checkout public.checkout_sessions%rowtype; payment public.payment_orders%rowtype;
  subscription public.team_subscriptions%rowtype; quote jsonb; tier text;
  sandbox boolean; live_test boolean; expected numeric; base numeric; remaining_imr numeric;
  starts_at timestamptz := now(); ends_at timestamptz;
  review_reason text; outcome text := 'completed';
  scope_user_id uuid; scope_sandbox boolean;
begin
  -- All Teams mutations take the account lock BEFORE row locks. In particular,
  -- create-checkout can retire unused expired links while holding this lock;
  -- locking that link first here would produce an inverted-order deadlock.
  select * into checkout from public.checkout_sessions where id=session_id_param;
  if checkout.id is null then raise exception 'Checkout session not found'; end if;
  scope_user_id := checkout.user_id;
  scope_sandbox := coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false);
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || scope_user_id::text || ':' || scope_sandbox::text,0));
  select * into checkout from public.checkout_sessions where id=session_id_param for update;
  if checkout.id is null or checkout.user_id is distinct from scope_user_id
     or coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false) is distinct from scope_sandbox then
    raise exception 'Checkout account or mode changed before settlement';
  end if;
  quote := checkout.metadata->'teams_quote';
  if quote is null then
    -- Reconcile old receipts at their original full catalogue/test price.
    -- A legacy different-tier payment goes to review instead of overwriting
    -- remaining higher-tier access or creating free upgraded prepaid days.
    tier := substring(checkout.plan from 12);
    quote := jsonb_build_object('version',1,'mode','new',
      'base_amount_inr',public.blue_teams_catalog_price(tier,'INR',
        coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false),
        coalesce((checkout.metadata->>'blue_teams_live_test_mode')::boolean,false)),
      'base_amount_usd',public.blue_teams_catalog_price(tier,'USD',
        coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false),
        coalesce((checkout.metadata->>'blue_teams_live_test_mode')::boolean,false)));
  end if;
  if provider_param is null or provider_param not in ('payu','paypal')
     or nullif(trim(provider_order_id_param),'') is null or nullif(trim(provider_transaction_id_param),'') is null
     or quote->>'version' is distinct from '1' or quote->>'mode' is null or quote->>'mode' not in ('new','renewal','upgrade') then
    raise exception 'Invalid Teams quote or payment identifiers';
  end if;
  tier := substring(checkout.plan from 12);
  sandbox := coalesce((checkout.metadata->>'blue_teams_test_mode')::boolean,false);
  live_test := coalesce((checkout.metadata->>'blue_teams_live_test_mode')::boolean,false);
  if tier is null or tier not in ('solo','pro','business') or checkout.billing_cycle<>'monthly'
     or sandbox and (tier<>'solo' or live_test) or live_test and tier<>'business' then
    raise exception 'Invalid Teams product or checkout mode';
  end if;
  select * into payment from public.payment_orders where checkout_session_id=checkout.id for update;
  if payment.id is null or payment.user_id<>checkout.user_id or payment.gateway<>provider_param
     or payment.provider_order_id is distinct from provider_order_id_param
     or payment.product_sku is distinct from checkout.plan || '_monthly'
     or payment.currency is distinct from (case when provider_param='payu' then 'INR' else 'USD' end)
     or quote->>'currency_locked' is not null and quote->>'currency_locked'<>payment.currency then
    raise exception 'Payment order does not match checkout';
  end if;
  if checkout.status='completed' and payment.status='completed'
     and payment.provider_transaction_id=provider_transaction_id_param then
    return jsonb_build_object('already_processed',true,'status','completed',
      'outcome',coalesce(checkout.metadata->>'payment_outcome','completed'));
  end if;
  if checkout.status<>'pending' or payment.status<>'pending' then raise exception 'Checkout is not pending'; end if;
  if payment.redeemed_imr is null or payment.redeemed_imr<0 or payment.redeemed_imr>100
     or payment.redeemed_imr::text='NaN' or (sandbox or live_test) and payment.redeemed_imr<>0 then
    raise exception 'Invalid IMR amount';
  end if;
  if quote->>'mode'='upgrade' and payment.redeemed_imr<>0 then
    raise exception 'IMR credits cannot be used for a prorated Teams upgrade';
  end if;
  base := (quote->>(case when payment.currency='INR' then 'base_amount_inr' else 'base_amount_usd' end))::numeric;
  expected := round(greatest(case when payment.currency='INR' then 1 else 0.01 end,
    base-payment.redeemed_imr*case when payment.currency='INR' then 0.5 else 0.005 end),2);
  if base is null or base<=0 or base::text='NaN' or payment.amount is distinct from expected then
    raise exception 'Payment amount does not match the immutable Teams quote';
  end if;
  select * into subscription from public.team_subscriptions where user_id=checkout.user_id and is_test=sandbox for update;
  if quote->>'mode'='upgrade' then
    if subscription.id::text is distinct from quote->>'expected_subscription_id'
       or subscription.plan is distinct from quote->>'from_plan' or subscription.status is distinct from 'active'
       or subscription.current_period_start is distinct from (quote->>'expected_period_start')::timestamptz
       or subscription.current_period_end is distinct from (quote->>'expected_period_end')::timestamptz
       or subscription.payment_order_id::text is distinct from quote->>'expected_payment_order_id' then
      review_reason := 'upgrade_entitlement_changed_after_quote';
    elsif subscription.current_period_end<=now() then review_reason := 'upgrade_period_ended_before_confirmation';
    end if;
    starts_at := subscription.current_period_start; ends_at := (quote->>'effective_end')::timestamptz;
  else
    ends_at := now()+interval '30 days';
    if subscription.status='active' and subscription.current_period_end>now() then
      if subscription.plan<>tier then review_reason := 'active_plan_changed_after_quote';
      else starts_at := subscription.current_period_start; ends_at := subscription.current_period_end+interval '30 days'; end if;
    end if;
  end if;
  if payment.redeemed_imr>0 then
    select balance into remaining_imr from public.wallets where user_id=checkout.user_id for update;
    if coalesce(remaining_imr,0)<payment.redeemed_imr then review_reason := coalesce(review_reason,'paid_order_imr_balance_changed'); end if;
  end if;
  if review_reason is null and payment.redeemed_imr>0 then
    update public.wallets set balance=balance-payment.redeemed_imr,updated_at=now() where user_id=checkout.user_id;
  end if;
  if review_reason is not null then
    outcome := 'requires_review';
    insert into public.blue_teams_payment_reviews(payment_order_id,user_id,reason,quote,subscription_snapshot)
      values(payment.id,checkout.user_id,review_reason,quote,case when subscription.id is null then null else to_jsonb(subscription) end);
  else
    insert into public.team_subscriptions(user_id,plan,status,is_test,current_period_start,current_period_end,
      payment_provider,payment_order_id,metadata,updated_at)
    values(checkout.user_id,tier,'active',sandbox,starts_at,ends_at,provider_param,payment.id,
      (coalesce(subscription.metadata,'{}'::jsonb)-'admin_grant'-'scheduled_change') ||
      jsonb_build_object('billing_cycle','monthly','duration_days',30,'quote_mode',quote->>'mode',
        'active_project_teams',case tier when 'solo' then 1 when 'pro' then 3 else 10 end,
        'agents_per_team',case tier when 'solo' then 3 when 'pro' then 5 else 8 end,
        'blue_teams_test_mode',sandbox,'blue_teams_live_test_mode',live_test,
        'payment_provider',provider_param,'payment_order_id',payment.id) ||
      case when subscription.metadata->'scheduled_change'->>'plan' in ('solo','pro','business')
        and array_position(array['solo','pro','business'],subscription.metadata->'scheduled_change'->>'plan')
          < array_position(array['solo','pro','business'],tier) then
        jsonb_build_object('scheduled_change',jsonb_build_object('plan',subscription.metadata->'scheduled_change'->>'plan',
          'change_at',ends_at,'payment_required',true)) else '{}'::jsonb end,now())
    on conflict(user_id,is_test) do update set plan=excluded.plan,status=excluded.status,
      current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      payment_provider=excluded.payment_provider,payment_order_id=excluded.payment_order_id,
      metadata=excluded.metadata,updated_at=excluded.updated_at;
  end if;
  -- A verified collected payment is recorded even when a changed entitlement
  -- needs human reconciliation. Never invite another charge for this receipt.
  update public.payment_orders set status='completed',provider_transaction_id=provider_transaction_id_param,
    completed_at=now(),updated_at=now() where id=payment.id;
  update public.checkout_sessions set status='completed',completed_at=now(),
    metadata=metadata || jsonb_build_object('payment_outcome',outcome,'payment_review_reason',review_reason) where id=checkout.id;
  return jsonb_build_object('already_processed',false,'status','completed','outcome',outcome,
    'quote_mode',quote->>'mode','plan',tier,'current_period_end',case when review_reason is null then ends_at else subscription.current_period_end end);
end;
$$;
revoke all on function public.complete_blue_teams_checkout(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_blue_teams_checkout(uuid,text,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
