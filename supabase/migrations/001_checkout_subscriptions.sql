-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Creates tables for the checkout + subscription flow

-- 1. Checkout sessions (short-lived, for redirect to core2cover.in)
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  plan text not null default 'blue',
  billing_cycle text not null default 'monthly',
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb default '{}'
);

-- Index for fast lookup by session id
create index if not exists idx_checkout_sessions_id on public.checkout_sessions(id);

-- Index for user lookups
create index if not exists idx_checkout_sessions_user on public.checkout_sessions(user_id);

-- 2. Subscriptions (persistent, one per user)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null unique,
  plan text not null default 'blue',
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'expired')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb default '{}'
);

-- Index for subscription lookups
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

-- Enable RLS (row-level security) for both tables
alter table public.checkout_sessions enable row level security;
alter table public.subscriptions enable row level security;

-- Allow admin service role full access (core2cover.in uses service key)
create policy "Admin full access on checkout_sessions"
  on public.checkout_sessions
  for all
  using (true)
  with check (true);

create policy "Admin full access on subscriptions"
  on public.subscriptions
  for all
  using (true)
  with check (true);

-- Users can view their own checkout sessions (read-only)
create policy "Users view own checkout_sessions"
  on public.checkout_sessions
  for select
  using (auth.uid() = user_id);

-- Users can view their own subscription
create policy "Users view own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);
