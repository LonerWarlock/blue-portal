-- Allow genuinely free upstream models to create an idempotency record without
-- deducting Blue Credits. Settlement still verifies provider_cost >= 0 and the
-- existing multiplier, so a zero reservation can only settle at zero cost.
alter table public.billing_reservations
  drop constraint if exists billing_reservations_reserved_blue_credits_check;

alter table public.billing_reservations
  add constraint billing_reservations_reserved_blue_credits_check
    check (reserved_blue_credits >= 0);

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

revoke all on function public.reserve_blue_credits(uuid, text, text, numeric) from public;
grant execute on function public.reserve_blue_credits(uuid, text, text, numeric) to service_role;
