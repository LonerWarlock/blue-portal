-- Complimentary Teams Pro access, independent of payment settlement.
-- No payment/order/wallet/ordinary Blue subscription is created or changed.
begin;

create table if not exists public.blue_teams_admin_grants (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan = 'pro'),
  duration_days integer not null check (duration_days = 30),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  source text not null default 'owner_authorized_complimentary'
    check (source = 'owner_authorized_complimentary'),
  requested_by text not null default session_user,
  created_at timestamptz not null default now(),
  before_subscription jsonb,
  after_subscription jsonb not null,
  result jsonb not null,
  unique (id, user_id)
);
alter table public.blue_teams_admin_grants enable row level security;
revoke all on public.blue_teams_admin_grants from public, anon, authenticated, service_role;
grant select on public.blue_teams_admin_grants to service_role;

alter table public.team_subscriptions
  add column if not exists last_admin_grant_id uuid;
alter table public.team_subscriptions
  drop constraint if exists team_subscriptions_admin_grant_owner_fkey;
alter table public.team_subscriptions
  add constraint team_subscriptions_admin_grant_owner_fkey
    foreign key (last_admin_grant_id, user_id)
    references public.blue_teams_admin_grants(id, user_id) deferrable initially deferred;
alter table public.team_subscriptions alter column payment_order_id drop not null;
alter table public.team_subscriptions
  drop constraint if exists team_subscriptions_payment_provider_check;
alter table public.team_subscriptions
  add constraint team_subscriptions_payment_provider_check
    check (payment_provider in ('payu', 'paypal', 'admin_grant'));
alter table public.team_subscriptions
  drop constraint if exists team_subscriptions_provenance_check;
alter table public.team_subscriptions
  add constraint team_subscriptions_provenance_check check (
    (payment_provider in ('payu', 'paypal') and payment_order_id is not null)
    or (payment_provider = 'admin_grant' and payment_order_id is null
      and is_test = false and plan = 'pro' and last_admin_grant_id is not null)
  );

create or replace function public.grant_blue_teams_pro(
  email_param text,
  grant_id_param uuid,
  reason_param text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  match_count integer;
  previous_grant public.blue_teams_admin_grants%rowtype;
  previous_subscription public.team_subscriptions%rowtype;
  effective_subscription public.team_subscriptions%rowtype;
  grant_end timestamptz := now() + interval '30 days';
  period_start timestamptz := now();
  period_end timestamptz := grant_end;
  result_json jsonb;
  outcome text := 'granted';
begin
  if grant_id_param is null or email_param is null
     or length(trim(email_param)) not between 3 and 254
     or reason_param is null or length(trim(reason_param)) not between 1 and 1000 then
    raise exception 'A grant ID, exact account email and reason are required';
  end if;

  -- Exact account lookup only; never create an account or select an arbitrary match.
  select count(*)::integer, min(id::text)::uuid into match_count, target_id
    from auth.users where lower(email) = lower(trim(email_param));
  if match_count <> 1 then
    raise exception 'Expected exactly one existing account for the supplied email';
  end if;

  -- The request lock prevents the same UUID being reused concurrently for another
  -- account. The account lock is identical to verified Teams checkout's lock.
  perform pg_advisory_xact_lock(hashtextextended('blue_teams_admin_grant:' || grant_id_param::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('blue_teams:' || target_id::text || ':false', 0));
  select * into previous_grant from public.blue_teams_admin_grants where id = grant_id_param;
  if previous_grant.id is not null then
    if previous_grant.user_id is distinct from target_id
       or previous_grant.reason is distinct from trim(reason_param) then
      raise exception 'Grant ID already belongs to a different request';
    end if;
    -- A retry must not extend or reactivate a previously applied grant.
    return previous_grant.result || jsonb_build_object('already_processed', true);
  end if;

  select * into previous_subscription from public.team_subscriptions
    where user_id = target_id and is_test = false for update;

  if previous_subscription.status = 'active' and previous_subscription.current_period_end > now() then
    period_start := previous_subscription.current_period_start;
    period_end := greatest(grant_end, previous_subscription.current_period_end);
    if previous_subscription.plan = 'business' then
      outcome := 'higher_plan_preserved';
    elsif previous_subscription.plan = 'pro' and previous_subscription.current_period_end >= grant_end then
      outcome := 'already_active';
    end if;
  end if;

  if outcome = 'granted' then
    insert into public.team_subscriptions (
      user_id, plan, status, is_test, current_period_start, current_period_end,
      payment_provider, payment_order_id, last_admin_grant_id, metadata, updated_at
    ) values (
      target_id, 'pro', 'active', false, period_start, period_end,
      coalesce(previous_subscription.payment_provider, 'admin_grant'),
      previous_subscription.payment_order_id, grant_id_param,
      coalesce(previous_subscription.metadata, '{}'::jsonb) || jsonb_build_object(
        'active_project_teams', 3, 'agents_per_team', 5,
        'admin_grant', jsonb_build_object('id', grant_id_param, 'plan', 'pro',
          'duration_days', 30, 'granted_at', now(), 'reason', trim(reason_param),
          'source', 'owner_authorized_complimentary')
      ), now()
    ) on conflict (user_id, is_test) do update set
      plan = excluded.plan, status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      payment_provider = excluded.payment_provider, payment_order_id = excluded.payment_order_id,
      last_admin_grant_id = excluded.last_admin_grant_id,
      metadata = excluded.metadata, updated_at = excluded.updated_at
    returning * into effective_subscription;
  else
    effective_subscription := previous_subscription;
  end if;

  result_json := jsonb_build_object('already_processed', false, 'outcome', outcome,
    'plan', effective_subscription.plan, 'status', effective_subscription.status,
    'current_period_end', effective_subscription.current_period_end,
    'duration_days', 30, 'grant_id', grant_id_param);
  insert into public.blue_teams_admin_grants (
    id, user_id, plan, duration_days, reason, before_subscription, after_subscription, result
  ) values (
    grant_id_param, target_id, 'pro', 30, trim(reason_param),
    case when previous_subscription.id is null then null else to_jsonb(previous_subscription) end,
    to_jsonb(effective_subscription), result_json
  );
  return result_json;
end;
$$;
revoke all on function public.grant_blue_teams_pro(text, uuid, text) from public, anon, authenticated;
grant execute on function public.grant_blue_teams_pro(text, uuid, text) to service_role;

-- Existing authenticated self-read policies and verified PayU/PayPal checkout
-- remain unchanged. Only the trusted service role may execute a grant.
notify pgrst, 'reload schema';
commit;
