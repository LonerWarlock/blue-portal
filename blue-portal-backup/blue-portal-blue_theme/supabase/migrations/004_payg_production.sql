-- Production hardening for Blue Pro PAYG.
-- Run this migration in Supabase before deploying the matching portal build.

alter table public.blue_profiles
  drop constraint if exists blue_profiles_status_check;

alter table public.blue_profiles
  add constraint blue_profiles_status_check
    check (status in ('active', 'pending', 'suspended')),
  add column if not exists access_tier text not null default 'trial'
    check (access_tier in ('trial', 'full')),
  add column if not exists last_top_up_credits numeric(12, 6) not null default 0,
  add column if not exists activated_at timestamptz;

alter table public.wallets
  alter column blue_credits type numeric(18, 10) using blue_credits::numeric;

alter table public.blue_profiles
  alter column total_credits_purchased type numeric(18, 10) using total_credits_purchased::numeric,
  alter column total_credits_used type numeric(18, 10) using total_credits_used::numeric;

alter table public.credit_payments
  add column if not exists pack_id text not null default 'standard';

create unique index if not exists idx_credit_payments_provider_txnid
  on public.credit_payments(provider_txnid)
  where provider_txnid is not null;

alter table public.billing_transactions
  add column if not exists request_id text,
  add column if not exists provider_cost numeric(18, 10),
  add column if not exists balance_after numeric(18, 10);

alter table public.billing_transactions
  alter column blue_credits_cost type numeric(18, 10) using blue_credits_cost::numeric;

create unique index if not exists idx_billing_transactions_request_id
  on public.billing_transactions(request_id);

create table if not exists public.billing_reservations (
  request_id text primary key,
  user_id uuid references auth.users(id) not null,
  model text not null,
  reserved_blue_credits numeric(18, 10) not null check (reserved_blue_credits > 0),
  charged_blue_credits numeric(18, 10),
  provider_cost numeric(18, 10),
  prompt_tokens bigint,
  completion_tokens bigint,
  status text not null default 'pending'
    check (status in ('pending', 'settled', 'released')),
  balance_after numeric(18, 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  settled_at timestamptz
);

create index if not exists idx_billing_reservations_user_status
  on public.billing_reservations(user_id, status);

alter table public.billing_reservations enable row level security;

drop policy if exists "Admin full access on billing_reservations" on public.billing_reservations;
drop policy if exists "Admin full access on blue_profiles" on public.blue_profiles;
drop policy if exists "Admin full access on credit_payments" on public.credit_payments;

create or replace function public.release_expired_blue_credit_reservations(
  user_id_param uuid
) returns numeric as $$
declare
  refund numeric := 0;
  new_balance numeric := 0;
begin
  with released as (
    update public.billing_reservations
      set status = 'released', settled_at = now()
      where user_id = user_id_param
        and status = 'pending'
        and expires_at <= now()
      returning reserved_blue_credits
  )
  select coalesce(sum(reserved_blue_credits), 0) into refund from released;

  if refund > 0 then
    update public.wallets
      set blue_credits = coalesce(blue_credits, 0) + refund, updated_at = now()
      where user_id = user_id_param
      returning blue_credits into new_balance;
  else
    select coalesce(blue_credits, 0) into new_balance
      from public.wallets where user_id = user_id_param;
  end if;

  return coalesce(new_balance, 0);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.reserve_blue_credits(
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
  if amount_param is null or amount_param <= 0 then
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
    where request_id = request_id_param;

  if existing_record.request_id is not null then
    if existing_record.user_id <> user_id_param then
      raise exception 'Request ID already belongs to another user';
    end if;
    select blue_credits into new_balance from public.wallets where user_id = user_id_param;
    return jsonb_build_object(
      'request_id', existing_record.request_id,
      'reserved', existing_record.reserved_blue_credits,
      'remaining', coalesce(new_balance, 0),
      'status', existing_record.status
    );
  end if;

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

  insert into public.billing_reservations (
    request_id, user_id, model, reserved_blue_credits
  ) values (
    request_id_param, user_id_param, model_param, amount_param
  );

  return jsonb_build_object(
    'request_id', request_id_param,
    'reserved', amount_param,
    'remaining', new_balance,
    'status', 'pending'
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.settle_blue_credit_reservation(
  user_id_param uuid,
  request_id_param text,
  provider_cost_param numeric,
  blue_credit_multiplier_param numeric,
  prompt_tokens_param bigint,
  completion_tokens_param bigint
) returns jsonb as $$
declare
  reservation_record public.billing_reservations%rowtype;
  charge numeric;
  adjustment numeric;
  new_balance numeric;
begin
  if provider_cost_param is null or provider_cost_param < 0 then
    raise exception 'Invalid provider cost';
  end if;
  if blue_credit_multiplier_param is null or blue_credit_multiplier_param < 1 then
    raise exception 'Invalid Blue Credit multiplier';
  end if;

  select * into reservation_record
    from public.billing_reservations
    where request_id = request_id_param
      and user_id = user_id_param
    for update;

  if reservation_record.request_id is null then
    raise exception 'Billing reservation not found';
  end if;

  if reservation_record.status = 'settled' then
    return jsonb_build_object(
      'request_id', request_id_param,
      'charged', reservation_record.charged_blue_credits,
      'provider_cost', reservation_record.provider_cost,
      'remaining', reservation_record.balance_after,
      'status', 'settled'
    );
  end if;
  if reservation_record.status <> 'pending' then
    raise exception 'Billing reservation is not pending';
  end if;

  charge := round(provider_cost_param * blue_credit_multiplier_param, 10);
  adjustment := reservation_record.reserved_blue_credits - charge;

  if adjustment >= 0 then
    update public.wallets
      set blue_credits = coalesce(blue_credits, 0) + adjustment, updated_at = now()
      where user_id = user_id_param
      returning blue_credits into new_balance;
  else
    update public.wallets
      set blue_credits = coalesce(blue_credits, 0) + adjustment, updated_at = now()
      where user_id = user_id_param
        and blue_credits >= abs(adjustment)
      returning blue_credits into new_balance;
  end if;

  if new_balance is null then
    raise exception 'Reservation was lower than the final charge';
  end if;

  update public.billing_reservations
    set status = 'settled',
        charged_blue_credits = charge,
        provider_cost = provider_cost_param,
        prompt_tokens = greatest(prompt_tokens_param, 0),
        completion_tokens = greatest(completion_tokens_param, 0),
        balance_after = new_balance,
        settled_at = now()
    where request_id = request_id_param;

  update public.blue_profiles
    set total_credits_used = total_credits_used + charge,
        updated_at = now()
    where user_id = user_id_param;

  insert into public.billing_transactions (
    user_id, model, prompt_tokens, completion_tokens, cost,
    provider_cost, blue_credits_cost, account_type, rate_card_version,
    request_id, balance_after
  ) values (
    user_id_param, reservation_record.model,
    greatest(prompt_tokens_param, 0), greatest(completion_tokens_param, 0),
    provider_cost_param, provider_cost_param, charge, 'pro_payg',
    'openrouter-usage-cost-x' || blue_credit_multiplier_param::text,
    request_id_param, new_balance
  ) on conflict (request_id) do nothing;

  return jsonb_build_object(
    'request_id', request_id_param,
    'charged', charge,
    'provider_cost', provider_cost_param,
    'remaining', new_balance,
    'status', 'settled'
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.release_blue_credit_reservation(
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

create or replace function public.complete_blue_credit_payment(
  payment_id_param uuid,
  provider_txnid_param text
) returns jsonb as $$
declare
  payment_record public.credit_payments%rowtype;
  new_balance numeric;
  next_tier text;
begin
  select * into payment_record
    from public.credit_payments
    where id = payment_id_param and provider_txnid = provider_txnid_param
    for update;

  if payment_record.id is null then
    raise exception 'Payment not found';
  end if;

  if payment_record.status = 'completed' then
    select blue_credits into new_balance from public.wallets where user_id = payment_record.user_id;
    return jsonb_build_object('already_processed', true, 'remaining', coalesce(new_balance, 0), 'credits', payment_record.credits_purchased);
  end if;
  if payment_record.status <> 'pending' then
    raise exception 'Payment is not pending';
  end if;

  update public.credit_payments
    set status = 'completed', completed_at = now(), provider_order_id = provider_txnid_param
    where id = payment_record.id;

  insert into public.wallets (user_id, balance, account_type, blue_credits, updated_at)
    values (payment_record.user_id, 0, 'pro_payg', payment_record.credits_purchased, now())
    on conflict (user_id)
    do update set account_type = 'pro_payg',
                  blue_credits = coalesce(wallets.blue_credits, 0) + excluded.blue_credits,
                  updated_at = now()
    returning blue_credits into new_balance;

  next_tier := case when payment_record.pack_id = 'standard' then 'full' else 'trial' end;

  insert into public.blue_profiles (
    user_id, status, access_tier, total_credits_purchased,
    total_credits_used, last_top_up_credits, activated_at, updated_at
  ) values (
    payment_record.user_id, 'active', next_tier,
    payment_record.credits_purchased, 0, payment_record.credits_purchased, now(), now()
  ) on conflict (user_id)
  do update set status = 'active',
                access_tier = case when blue_profiles.access_tier = 'full' then 'full' else excluded.access_tier end,
                total_credits_purchased = blue_profiles.total_credits_purchased + excluded.total_credits_purchased,
                last_top_up_credits = excluded.last_top_up_credits,
                activated_at = coalesce(blue_profiles.activated_at, now()),
                updated_at = now();

  return jsonb_build_object(
    'already_processed', false,
    'remaining', new_balance,
    'credits', payment_record.credits_purchased,
    'access_tier', next_tier
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.reserve_blue_credits(uuid, text, text, numeric) from public;
revoke all on function public.settle_blue_credit_reservation(uuid, text, numeric, numeric, bigint, bigint) from public;
revoke all on function public.release_blue_credit_reservation(uuid, text) from public;
revoke all on function public.release_expired_blue_credit_reservations(uuid) from public;
revoke all on function public.complete_blue_credit_payment(uuid, text) from public;

grant execute on function public.reserve_blue_credits(uuid, text, text, numeric) to service_role;
grant execute on function public.settle_blue_credit_reservation(uuid, text, numeric, numeric, bigint, bigint) to service_role;
grant execute on function public.release_blue_credit_reservation(uuid, text) to service_role;
grant execute on function public.release_expired_blue_credit_reservations(uuid) to service_role;
grant execute on function public.complete_blue_credit_payment(uuid, text) to service_role;

revoke all on function public.deduct_blue_credits(uuid, numeric) from public;
revoke all on function public.add_blue_credits(uuid, numeric) from public;
revoke all on function public.increment_blue_credits_purchased(uuid, numeric) from public;
revoke all on function public.increment_blue_credits_used(uuid, numeric) from public;

grant execute on function public.deduct_blue_credits(uuid, numeric) to service_role;
grant execute on function public.add_blue_credits(uuid, numeric) to service_role;
grant execute on function public.increment_blue_credits_purchased(uuid, numeric) to service_role;
grant execute on function public.increment_blue_credits_used(uuid, numeric) to service_role;

-- Existing paid Blue Pro customers keep full access after this migration.
update public.blue_profiles
  set access_tier = 'full',
      activated_at = coalesce(activated_at, created_at)
  where total_credits_purchased > 1;
