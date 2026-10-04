-- Blue prepaid subscriptions: monthly INR 149 / 30 days, quarterly INR 399 /
-- 90 days, yearly INR 1299 / 365 days. Existing monthly USD checkout is retained.
-- Include the payment ledger prerequisite for deployments predating migration 021.
begin;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null unique references public.checkout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_sku text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('INR', 'USD')),
  redeemed_imr numeric(12, 2) not null default 0 check (redeemed_imr >= 0),
  gateway text not null check (gateway in ('payu', 'paypal')),
  provider_order_id text,
  provider_transaction_id text,
  custom_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'expired')),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists payment_orders_provider_order_idx
  on public.payment_orders(gateway, provider_order_id) where provider_order_id is not null;
create unique index if not exists payment_orders_provider_transaction_idx
  on public.payment_orders(gateway, provider_transaction_id) where provider_transaction_id is not null;
create index if not exists payment_orders_user_created_idx on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_expiry_idx on public.payment_orders(status, expires_at);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from public, anon, authenticated;
grant all on public.payment_orders to service_role;

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
    when 'monthly' then base_price := 149; duration_days := 30;
    when 'quarterly' then base_price := 399; duration_days := 90;
    when 'yearly' then base_price := 1299; duration_days := 365;
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
  if checkout_record.status is distinct from 'pending' or checkout_record.expires_at <= now()
     or order_record.status is distinct from 'pending' or order_record.expires_at <= now() then
    raise exception 'Checkout session is not active';
  end if;
  if order_record.redeemed_imr is null or order_record.redeemed_imr < 0
     or order_record.redeemed_imr > 100 or order_record.redeemed_imr::text = 'NaN' then
    raise exception 'Invalid IMR amount';
  end if;
  if provider_param = 'payu' and order_record.currency = 'INR' then
    expected_amount := round(greatest(1, base_price - order_record.redeemed_imr * 0.5), 2);
  elsif provider_param = 'paypal' and order_record.currency = 'USD'
        and checkout_record.billing_cycle = 'monthly' then
    expected_amount := round(greatest(0.01, 1.99 - order_record.redeemed_imr * 0.5 / 100), 2);
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
