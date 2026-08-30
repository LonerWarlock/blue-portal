-- Release interrupted legacy reservations exactly once and preserve the full
-- numeric(18,10) precision used by Blue PAYG wallets.
create or replace function public.release_expired_blue_credit_reservations(
  user_id_param uuid
) returns numeric as $$
declare
  refund numeric(18, 10) := 0;
  new_balance numeric(18, 10) := 0;
begin
  perform pg_advisory_xact_lock(hashtext(user_id_param::text));

  with released as (
    update public.billing_reservations
      set status = 'released', settled_at = now()
      where user_id = user_id_param
        and status = 'pending'
        and expires_at <= now()
        and not exists (
          select 1
          from public.blue_runtime_tasks task
          where task.request_id = billing_reservations.request_id
            and task.state in ('provisioning', 'active', 'stopping')
        )
      returning reserved_blue_credits
  )
  select coalesce(sum(reserved_blue_credits), 0)
    into refund
    from released;

  if refund > 0 then
    update public.wallets
      set blue_credits = round(coalesce(blue_credits, 0) + refund, 10),
          updated_at = now()
      where user_id = user_id_param
      returning blue_credits into new_balance;
  else
    select coalesce(blue_credits, 0)
      into new_balance
      from public.wallets
      where user_id = user_id_param;
  end if;

  return coalesce(new_balance, 0);
end;
$$ language plpgsql security definer set search_path = public;
