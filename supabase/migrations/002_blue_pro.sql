-- Blue Pro: Pay-As-You-Go Credits System
-- Run in Supabase SQL Editor

-- 1. Add account_type and blue_credits to wallets
alter table public.wallets
  add column if not exists account_type text not null default 'standard'
    check (account_type in ('standard', 'pro_payg')),
  add column if not exists blue_credits numeric(12, 4) not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- 2. Blue Pro profiles (extended info for PAYG users)
create table if not exists public.blue_profiles (
  user_id uuid references auth.users(id) primary key,
  status text not null default 'active' check (status in ('active', 'suspended')),
  total_credits_purchased numeric(12, 4) not null default 0,
  total_credits_used numeric(12, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Credit payments (track every Blue Credits purchase)
create table if not exists public.credit_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  amount_paid numeric(10, 2) not null,
  currency text not null default 'USD',
  credits_purchased numeric(12, 4) not null,
  payment_provider text not null default 'payu',
  provider_txnid text,
  provider_order_id text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'refunded')),
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_credit_payments_user on public.credit_payments(user_id);

-- 4. Update billing_transactions with Blue Credit support
alter table public.billing_transactions
  add column if not exists rate_card_version text,
  add column if not exists blue_credits_cost numeric(12, 6),
  add column if not exists account_type text not null default 'standard'
    check (account_type in ('standard', 'pro_payg'));

-- 5. Atomic blue_credits deduction RPC (same pattern as deduct_wallet_balance)
create or replace function public.deduct_blue_credits(
  user_id_param uuid,
  cost_param numeric
) returns numeric as $$
declare
  current_credits numeric;
  new_credits numeric;
begin
  update public.wallets
    set blue_credits = blue_credits - cost_param,
        updated_at = now()
    where user_id = user_id_param and blue_credits >= cost_param
    returning blue_credits into new_credits;

  if new_credits is null then
    raise exception 'Insufficient Blue Credits';
  end if;

  return new_credits;
end;
$$ language plpgsql;

-- 6. Atomic blue_credits add RPC
create or replace function public.add_blue_credits(
  user_id_param uuid,
  amount_param numeric
) returns numeric as $$
declare
  new_credits numeric;
begin
  update public.wallets
    set blue_credits = blue_credits + amount_param,
        updated_at = now()
    where user_id = user_id_param
    returning blue_credits into new_credits;

  return new_credits;
end;
$$ language plpgsql;

-- 7. Increment total credits purchased on blue_profiles
create or replace function public.increment_blue_credits_purchased(
  user_id_param uuid,
  amount_param numeric
) returns void as $$
begin
  insert into public.blue_profiles (user_id, total_credits_purchased, total_credits_used)
    values (user_id_param, amount_param, 0)
    on conflict (user_id)
    do update set total_credits_purchased = blue_profiles.total_credits_purchased + amount_param,
                  updated_at = now();
end;
$$ language plpgsql;

-- 8. Increment total credits used on blue_profiles
create or replace function public.increment_blue_credits_used(
  user_id_param uuid,
  amount_param numeric
) returns void as $$
begin
  insert into public.blue_profiles (user_id, total_credits_purchased, total_credits_used)
    values (user_id_param, 0, amount_param)
    on conflict (user_id)
    do update set total_credits_used = blue_profiles.total_credits_used + amount_param,
                  updated_at = now();
end;
$$ language plpgsql;

-- RLS policies
alter table public.blue_profiles enable row level security;
alter table public.credit_payments enable row level security;

create policy "Admin full access on blue_profiles"
  on public.blue_profiles for all using (true) with check (true);

create policy "Users view own blue_profile"
  on public.blue_profiles for select using (auth.uid() = user_id);

create policy "Admin full access on credit_payments"
  on public.credit_payments for all using (true) with check (true);

create policy "Users view own credit_payments"
  on public.credit_payments for select using (auth.uid() = user_id);
