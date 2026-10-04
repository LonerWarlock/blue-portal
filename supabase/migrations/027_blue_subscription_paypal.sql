-- PayPal/USD prepaid subscriptions for all Blue durations.
-- Prices approved on 2026-10-04: monthly 1.99, quarterly 5.33, yearly 17.35.
-- Preserve INR, existing access, atomic IMR spending and replay protection.
-- Prerequisite: migration 026.
begin;

create or replace function public.complete_blue_subscription_checkout(
  session_id_param uuid,
  provider_param text,
  provider_order_id_param text,
  provider_transaction_id_param text,
  payer_email_param text
) returns jsonb as $$
declare
  checkout_record public.checkout_sessions%rowtype;
  order_record public.payment_orders%rowtype;
  existing_subscription public.subscriptions%rowtype;
  wallet_balance numeric := 0;
  base_price numeric;
  base_price_usd numeric;
  expected_amount numeric;
  duration_days integer;
  period_start timestamptz := now();
  period_end timestamptz;
begin
  if provider_param is null or provider_param not in ('payu', 'paypal')
     or nullif(trim(provider_order_id_param), '') is null
     or nullif(trim(provider_transaction_id_param), '') is null then
    raise exception 'Invalid payment provider identifiers';
  end if;

  select * into checkout_record from public.checkout_sessions
   where id = session_id_param for update;
  if checkout_record.id is null then raise exception 'Checkout session not found'; end if;
  if checkout_record.plan is distinct from 'blue' then raise exception 'Unsupported checkout product'; end if;
  case checkout_record.billing_cycle
    when 'monthly' then base_price := 149; base_price_usd := 1.99; duration_days := 30;
    when 'quarterly' then base_price := 399; base_price_usd := 5.33; duration_days := 90;
    when 'yearly' then base_price := 1299; base_price_usd := 17.35; duration_days := 365;
    else raise exception 'Unsupported billing cycle';
  end case;

  select * into order_record from public.payment_orders
   where checkout_session_id = checkout_record.id for update;
  if order_record.id is null
     or order_record.user_id is distinct from checkout_record.user_id
     or order_record.product_sku is distinct from 'blue_' || checkout_record.billing_cycle
     or order_record.gateway is distinct from provider_param
     or order_record.provider_order_id is distinct from provider_order_id_param then
    raise exception 'Payment order does not match checkout';
  end if;

  -- A replay never charges IMR again or extends the subscription a second time.
  if checkout_record.status = 'completed' and order_record.status = 'completed'
     and order_record.provider_transaction_id = provider_transaction_id_param then
    return jsonb_build_object('already_processed', true, 'status', 'completed');
  end if;
  if checkout_record.status is distinct from 'pending' or order_record.status is distinct from 'pending' then
    raise exception 'Checkout session is not active';
  end if;
  -- Only service-role callbacks invoke this function. A PayPal callback may
  -- reconcile a provider-confirmed COMPLETED capture after a transient database
  -- failure or checkout expiry; it must never initiate a new capture after expiry.
  -- The route verifies the stored order, captured amount/currency and capture ID.
  if provider_param <> 'paypal'
     and (checkout_record.expires_at <= now() or order_record.expires_at <= now()) then
    raise exception 'Checkout session is not active';
  end if;
  if order_record.redeemed_imr is null or order_record.redeemed_imr < 0
     or order_record.redeemed_imr > 100 or order_record.redeemed_imr::text = 'NaN' then
    raise exception 'Invalid IMR amount';
  end if;
  if provider_param = 'payu' and order_record.currency = 'INR' then
    expected_amount := round(greatest(1, base_price - order_record.redeemed_imr * 0.5), 2);
  elsif provider_param = 'paypal' and order_record.currency = 'USD' then
    expected_amount := round(greatest(0.01, base_price_usd - order_record.redeemed_imr * 0.5 / 100), 2);
  else
    raise exception 'Unsupported payment currency for this billing cycle';
  end if;
  if order_record.amount is distinct from expected_amount then
    raise exception 'Payment amount does not match subscription price';
  end if;

  -- Serialize different successful checkouts for the same user, even if they
  -- have no subscription row yet. Never replace remaining paid/free access.
  perform pg_advisory_xact_lock(hashtextextended('blue_checkout:' || checkout_record.user_id::text, 0));
  select * into existing_subscription from public.subscriptions
   where user_id = checkout_record.user_id for update;
  period_end := now() + make_interval(days => duration_days);
  if existing_subscription.plan = 'blue' and existing_subscription.status = 'active' then
    if existing_subscription.current_period_end is null then
      period_start := coalesce(existing_subscription.current_period_start, now());
      period_end := null; -- Keep any pre-existing non-expiring entitlement.
    elsif existing_subscription.current_period_end > now() then
      period_start := coalesce(existing_subscription.current_period_start, now());
      period_end := existing_subscription.current_period_end + make_interval(days => duration_days);
    end if;
  end if;

  if order_record.redeemed_imr > 0 then
    select balance into wallet_balance from public.wallets
     where user_id = checkout_record.user_id for update;
    if coalesce(wallet_balance, 0) < order_record.redeemed_imr then raise exception 'Insufficient IMR balance'; end if;
    update public.wallets set balance = balance - order_record.redeemed_imr, updated_at = now()
     where user_id = checkout_record.user_id;
  end if;

  update public.payment_orders set status = 'completed',
    provider_transaction_id = provider_transaction_id_param, completed_at = now(), updated_at = now()
   where id = order_record.id;
  update public.checkout_sessions set status = 'completed', completed_at = now() where id = checkout_record.id;

  insert into public.subscriptions (
    user_id, plan, status, current_period_start, current_period_end,
    stripe_subscription_id, stripe_customer_id, metadata, updated_at
  ) values (
    checkout_record.user_id, 'blue', 'active', period_start, period_end,
    provider_param || '_' || provider_order_id_param, provider_param || '_' || checkout_record.user_id::text,
    coalesce(existing_subscription.metadata, '{}'::jsonb) || jsonb_build_object(
      'email', left(coalesce(payer_email_param, ''), 254),
      'payment_provider', provider_param, 'payment_order_id', order_record.id,
      'billing_cycle', checkout_record.billing_cycle, 'duration_days', duration_days,
      'warning_email_sent', false, 'expiry_email_sent', false
    ), now()
  ) on conflict (user_id) do update set
    plan = 'blue', status = 'active', current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_customer_id = excluded.stripe_customer_id, metadata = excluded.metadata, updated_at = now();

  return jsonb_build_object('already_processed', false, 'status', 'completed',
    'billing_cycle', checkout_record.billing_cycle, 'duration_days', duration_days, 'current_period_end', period_end);
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function public.complete_blue_subscription_checkout(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_blue_subscription_checkout(uuid, text, text, text, text) to service_role;
commit;


