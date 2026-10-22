-- Blue Teams prepaid 30-day plans and provider-verified PayU/PayPal settlement.
-- ₹1 / $0.01 is restricted to the Solo plan in an explicitly enabled sandbox.
begin;

create table if not exists public.team_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('solo', 'pro', 'business')),
  status text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  is_test boolean not null default false,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  payment_provider text not null check (payment_provider in ('payu', 'paypal')),
  payment_order_id uuid not null unique references public.payment_orders(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, is_test)
);

create index if not exists team_subscriptions_active_lookup_idx
  on public.team_subscriptions(user_id, is_test, current_period_end desc);
alter table public.team_subscriptions enable row level security;
revoke all on public.team_subscriptions from public, anon;
revoke insert, update, delete on public.team_subscriptions from authenticated;
grant select on public.team_subscriptions to authenticated;
grant all on public.team_subscriptions to service_role;
drop policy if exists team_subscriptions_select_own on public.team_subscriptions;
create policy team_subscriptions_select_own on public.team_subscriptions
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.complete_blue_teams_checkout(
  session_id_param uuid,
  provider_param text,
  provider_order_id_param text,
  provider_transaction_id_param text,
  payer_email_param text
) returns jsonb as $$
declare
  checkout_record public.checkout_sessions%rowtype;
  order_record public.payment_orders%rowtype;
  existing_team_subscription public.team_subscriptions%rowtype;
  wallet_balance numeric := 0;
  tier text;
  is_test_checkout boolean;
  base_inr numeric;
  base_usd numeric;
  expected_amount numeric;
  duration_days integer := 30;
  period_start timestamptz := now();
  period_end timestamptz;
  team_limit integer;
  agent_limit integer;
begin
  if provider_param is null or provider_param not in ('payu', 'paypal')
     or nullif(trim(provider_order_id_param), '') is null
     or nullif(trim(provider_transaction_id_param), '') is null then
    raise exception 'Invalid payment provider identifiers';
  end if;

  select * into checkout_record from public.checkout_sessions
   where id = session_id_param for update;
  if checkout_record.id is null then raise exception 'Checkout session not found'; end if;
  if checkout_record.billing_cycle is distinct from 'monthly' then raise exception 'Unsupported billing cycle'; end if;
  tier := case checkout_record.plan
    when 'blue_teams_solo' then 'solo'
    when 'blue_teams_pro' then 'pro'
    when 'blue_teams_business' then 'business'
    else null end;
  if tier is null then raise exception 'Unsupported checkout product'; end if;

  is_test_checkout := coalesce((checkout_record.metadata->>'blue_teams_test_mode')::boolean, false);
  case tier
    when 'solo' then base_inr := 499; base_usd := 5.27; team_limit := 1; agent_limit := 3;
    when 'pro' then base_inr := 1499; base_usd := 15.83; team_limit := 3; agent_limit := 5;
    when 'business' then base_inr := 4999; base_usd := 52.78; team_limit := 10; agent_limit := 8;
    else raise exception 'Unsupported checkout product';
  end case;

  select * into order_record from public.payment_orders
   where checkout_session_id = checkout_record.id for update;
  if order_record.id is null
     or order_record.user_id is distinct from checkout_record.user_id
     or order_record.product_sku is distinct from 'blue_teams_' || tier || '_monthly'
     or order_record.gateway is distinct from provider_param
     or order_record.provider_order_id is distinct from provider_order_id_param then
    raise exception 'Payment order does not match checkout';
  end if;
  if checkout_record.status = 'completed' and order_record.status = 'completed'
     and order_record.provider_transaction_id = provider_transaction_id_param then
    return jsonb_build_object('already_processed', true, 'status', 'completed');
  end if;
  if checkout_record.status is distinct from 'pending' or order_record.status is distinct from 'pending' then
    raise exception 'Checkout session is not active';
  end if;
  if order_record.redeemed_imr is null or order_record.redeemed_imr < 0
     or order_record.redeemed_imr > 100 or order_record.redeemed_imr::text = 'NaN' then
    raise exception 'Invalid IMR amount';
  end if;
  if is_test_checkout and order_record.redeemed_imr <> 0 then
    raise exception 'Sandbox team checkout cannot use IMR credits';
  end if;

  if provider_param = 'payu' and order_record.currency = 'INR' then
    expected_amount := case
      when is_test_checkout and tier = 'solo' then 1
      else round(greatest(1, base_inr - order_record.redeemed_imr * 0.5), 2)
    end;
  elsif provider_param = 'paypal' and order_record.currency = 'USD' then
    expected_amount := case
      when is_test_checkout and tier = 'solo' then 0.01
      else round(greatest(0.01, base_usd - order_record.redeemed_imr * 0.5 / 100), 2)
    end;
  else
    raise exception 'Unsupported payment currency for this provider';
  end if;
  if order_record.amount is distinct from expected_amount then
    raise exception 'Payment amount does not match the server catalogue';
  end if;

  -- Serialize concurrent checkouts per account and environment so paid access
  -- extends once, while sandbox tests can never overwrite a live entitlement.
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || checkout_record.user_id::text || ':' || is_test_checkout::text, 0));
  select * into existing_team_subscription from public.team_subscriptions
   where user_id = checkout_record.user_id and is_test = is_test_checkout for update;
  if existing_team_subscription.status = 'active'
     and existing_team_subscription.current_period_end > now() then
    period_start := existing_team_subscription.current_period_start;
    period_end := existing_team_subscription.current_period_end + make_interval(days => duration_days);
  else
    period_start := now();
    period_end := now() + make_interval(days => duration_days);
  end if;

  -- Keep the same atomic IMR accounting used by Blue subscription checkout.
  -- This happens only after provider evidence matches the stored order, and a
  -- callback replay exits above before it can deduct again.
  if order_record.redeemed_imr > 0 then
    select balance into wallet_balance from public.wallets
      where user_id = checkout_record.user_id for update;
    if coalesce(wallet_balance, 0) < order_record.redeemed_imr then
      raise exception 'Insufficient IMR balance';
    end if;
    update public.wallets set balance = balance - order_record.redeemed_imr, updated_at = now()
      where user_id = checkout_record.user_id;
  end if;

  update public.payment_orders set status = 'completed', provider_transaction_id = provider_transaction_id_param,
    completed_at = now(), updated_at = now() where id = order_record.id;
  update public.checkout_sessions set status = 'completed', completed_at = now() where id = checkout_record.id;

  insert into public.team_subscriptions (
    user_id, plan, status, is_test, current_period_start, current_period_end,
    payment_provider, payment_order_id, metadata, updated_at
  ) values (
    checkout_record.user_id, tier, 'active', is_test_checkout, period_start, period_end,
    provider_param, order_record.id, jsonb_build_object(
      'email', left(coalesce(payer_email_param, ''), 254),
      'billing_cycle', 'monthly', 'duration_days', duration_days,
      'redeemed_imr', order_record.redeemed_imr,
      'imr_discount', round(order_record.redeemed_imr * 0.5, 2),
      'active_project_teams', team_limit, 'agents_per_team', agent_limit,
      'blue_teams_test_mode', is_test_checkout,
      'payment_provider', provider_param, 'payment_order_id', order_record.id
    ), now()
  ) on conflict (user_id, is_test) do update set
    plan = excluded.plan, status = 'active', current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, payment_provider = excluded.payment_provider,
    payment_order_id = excluded.payment_order_id, metadata = excluded.metadata, updated_at = now();

  return jsonb_build_object('already_processed', false, 'status', 'completed', 'plan', tier,
    'test_mode', is_test_checkout, 'duration_days', duration_days, 'current_period_end', period_end);
end;
$$ language plpgsql security definer set search_path = public;
revoke all on function public.complete_blue_teams_checkout(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_blue_teams_checkout(uuid, text, text, text, text) to service_role;
commit;
