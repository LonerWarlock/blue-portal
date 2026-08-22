-- Update complete_blue_credit_payment to grant 'full' access for custom packs
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

  next_tier := case when payment_record.pack_id in ('standard', 'custom') then 'full' else 'trial' end;

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
