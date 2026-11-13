-- Preserve INR amount / 115 at the same precision as the usage wallet.
-- Applies only to Blue Credit purchase quantities. No price, balance or subscription rewrite.
begin;
alter table public.credit_payments
  alter column credits_purchased type numeric(18,10) using credits_purchased::numeric;
alter table public.blue_profiles
  alter column last_top_up_credits type numeric(18,10) using last_top_up_credits::numeric;
commit;
