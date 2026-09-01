-- Launch-critical security baseline for API keys, checkout settlement and RLS.

create extension if not exists pgcrypto;

create table if not exists public.user_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key text,
  key_hash text,
  key_prefix text,
  last_four text,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table public.user_keys
  add column if not exists key text,
  add column if not exists key_hash text,
  add column if not exists key_prefix text,
  add column if not exists last_four text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists rotated_at timestamptz not null default now();

alter table public.user_keys alter column key drop not null;

update public.user_keys
   set key_hash = encode(digest(key, 'sha256'), 'hex'),
       key_prefix = coalesce(key_prefix, left(key, 10)),
       last_four = coalesce(last_four, right(key, 4)),
       rotated_at = now()
 where key is not null and key_hash is null;

update public.user_keys set key = null where key_hash is not null;

create unique index if not exists user_keys_key_hash_idx
  on public.user_keys(key_hash) where key_hash is not null;
create unique index if not exists user_keys_user_id_idx
  on public.user_keys(user_id);

alter table public.user_keys enable row level security;
revoke all on public.user_keys from anon, authenticated;

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
  on public.payment_orders(gateway, provider_order_id)
  where provider_order_id is not null;
create unique index if not exists payment_orders_provider_transaction_idx
  on public.payment_orders(gateway, provider_transaction_id)
  where provider_transaction_id is not null;
create index if not exists payment_orders_user_created_idx
  on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_expiry_idx
  on public.payment_orders(status, expires_at);

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;

-- Replace legacy policies that granted USING(true) to every database role.
drop policy if exists "Admin full access on checkout_sessions" on public.checkout_sessions;
drop policy if exists "Admin full access on subscriptions" on public.subscriptions;
drop policy if exists "Admin full access on blue_profiles" on public.blue_profiles;
drop policy if exists "Admin full access on credit_payments" on public.credit_payments;
drop policy if exists "Admin full access on billing_reservations" on public.billing_reservations;

drop policy if exists "Service role full access on checkout_sessions" on public.checkout_sessions;
create policy "Service role full access on checkout_sessions"
  on public.checkout_sessions for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on subscriptions" on public.subscriptions;
create policy "Service role full access on subscriptions"
  on public.subscriptions for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on blue_profiles" on public.blue_profiles;
create policy "Service role full access on blue_profiles"
  on public.blue_profiles for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on credit_payments" on public.credit_payments;
create policy "Service role full access on credit_payments"
  on public.credit_payments for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on billing_reservations" on public.billing_reservations;
create policy "Service role full access on billing_reservations"
  on public.billing_reservations for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on user_keys" on public.user_keys;
create policy "Service role full access on user_keys"
  on public.user_keys for all to service_role using (true) with check (true);
drop policy if exists "Service role full access on payment_orders" on public.payment_orders;
create policy "Service role full access on payment_orders"
  on public.payment_orders for all to service_role using (true) with check (true);

create index if not exists credit_payments_user_created_idx
  on public.credit_payments(user_id, created_at desc);
create index if not exists billing_transactions_user_account_created_idx
  on public.billing_transactions(user_id, account_type, created_at desc);
create index if not exists subscriptions_status_period_end_idx
  on public.subscriptions(status, current_period_end);

-- Aggregate usage inside Postgres so dashboard reads never download an
-- unbounded transaction history into a serverless function.
create or replace function public.blue_usage_summary(
  user_id_param uuid,
  since_param timestamptz
) returns jsonb as $$
  with per_model as (
    select
      coalesce(nullif(model, ''), 'unknown') as model_name,
      count(*)::bigint as request_count,
      coalesce(sum(blue_credits_cost), 0)::numeric as total_cost
    from public.billing_transactions
    where user_id = user_id_param
      and account_type = 'pro_payg'
      and created_at >= since_param
    group by coalesce(nullif(model, ''), 'unknown')
  ), totals as (
    select
      coalesce(sum(request_count), 0)::bigint as total_requests,
      coalesce(sum(total_cost), 0)::numeric as total_blue_credits_used,
      coalesce(
        jsonb_object_agg(
          model_name,
          jsonb_build_object('requests', request_count, 'totalCost', total_cost)
        ),
        '{}'::jsonb
      ) as model_breakdown
    from per_model
  )
  select jsonb_build_object(
    'total_requests', total_requests,
    'total_blue_credits_used', total_blue_credits_used,
    'model_breakdown', model_breakdown
  )
  from totals;
$$ language sql stable security definer set search_path = public;

revoke all on function public.blue_usage_summary(uuid, timestamptz) from public;
grant execute on function public.blue_usage_summary(uuid, timestamptz) to service_role;

-- These legacy tables may have been created before this repository gained a
-- migration baseline. When present, make their service-only access explicit;
-- every current write goes through a validated server route.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wallets', 'billing_transactions', 'pending_registrations',
    'hackathon_registrations', 'vibe_coding_registrations',
    'course_registrations', 'java_course_registrations', 'interns'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant all on table public.%I to service_role', table_name);
    end if;
  end loop;
end;
$$;

-- One locked, idempotent transaction owns checkout completion, IMR debit and
-- subscription activation. Provider payloads are validated by the callback
-- before this function is called; this function rechecks the stored order.
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
  wallet_balance numeric := 0;
  period_start timestamptz := now();
  period_end timestamptz := now() + interval '30 days';
begin
  select * into checkout_record
    from public.checkout_sessions
   where id = session_id_param
   for update;

  if checkout_record.id is null then raise exception 'Checkout session not found'; end if;
  if checkout_record.status = 'completed' then
    return jsonb_build_object('already_processed', true, 'status', 'completed');
  end if;
  if checkout_record.status <> 'pending' or checkout_record.expires_at <= now() then
    raise exception 'Checkout session is not active';
  end if;
  if checkout_record.plan <> 'blue' or checkout_record.billing_cycle <> 'monthly' then
    raise exception 'Unsupported checkout product';
  end if;

  select * into order_record
    from public.payment_orders
   where checkout_session_id = checkout_record.id
   for update;

  if order_record.id is null
     or order_record.status <> 'pending'
     or order_record.expires_at <= now()
     or order_record.user_id <> checkout_record.user_id
     or order_record.product_sku <> 'blue_monthly'
     or order_record.gateway <> provider_param
     or order_record.provider_order_id <> provider_order_id_param then
    raise exception 'Payment order does not match checkout';
  end if;

  if order_record.redeemed_imr > 0 then
    select balance into wallet_balance
      from public.wallets
     where user_id = checkout_record.user_id
     for update;
    if coalesce(wallet_balance, 0) < order_record.redeemed_imr then
      raise exception 'Insufficient IMR balance';
    end if;
    update public.wallets
       set balance = balance - order_record.redeemed_imr,
           updated_at = now()
     where user_id = checkout_record.user_id;
  end if;

  update public.payment_orders
     set status = 'completed',
         provider_transaction_id = provider_transaction_id_param,
         completed_at = now(),
         updated_at = now()
   where id = order_record.id;

  update public.checkout_sessions
     set status = 'completed', completed_at = now()
   where id = checkout_record.id;

  insert into public.subscriptions (
    user_id, plan, status, current_period_start, current_period_end,
    stripe_subscription_id, stripe_customer_id, metadata, updated_at
  ) values (
    checkout_record.user_id, 'blue', 'active', period_start, period_end,
    provider_param || '_' || provider_order_id_param,
    provider_param || '_' || checkout_record.user_id::text,
    jsonb_build_object(
      'email', left(coalesce(payer_email_param, ''), 254),
      'payment_provider', provider_param,
      'payment_order_id', order_record.id,
      'warning_email_sent', false,
      'expiry_email_sent', false
    ),
    now()
  ) on conflict (user_id) do update
    set plan = 'blue',
        status = 'active',
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_customer_id = excluded.stripe_customer_id,
        metadata = excluded.metadata,
        updated_at = now();

  return jsonb_build_object('already_processed', false, 'status', 'completed');
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.complete_blue_subscription_checkout(uuid, text, text, text, text) from public;
grant execute on function public.complete_blue_subscription_checkout(uuid, text, text, text, text) to service_role;
