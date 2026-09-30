-- Display-only account-wide credit snapshot and atomic initial-provision release.
-- Apply before deploying the matching Portal runtime. No pricing changes.
alter table public.blue_runtime_tasks
  add column if not exists unprovisioned_release_pending boolean not null default false;

create index if not exists blue_runtime_tasks_unprovisioned_release_idx
  on public.blue_runtime_tasks (updated_at)
  where state = 'provisioning' and unprovisioned_release_pending = true;

-- Recover old initial failures whose terminal transition preceded a failed
-- refund. Completed/charged tasks and any credential with observed usage or a
-- live/previously admitted state are excluded from this conservative backfill.
update public.blue_runtime_tasks task
   set state = 'provisioning', unprovisioned_release_pending = true,
       updated_at = now()
 where task.state = 'failed' and task.balance_after is null
   and task.charged_blue_credits = 0 and task.provider_cost = 0
   and exists (
     select 1 from public.billing_reservations reservation
      where reservation.request_id = task.request_id
        and reservation.user_id = task.user_id and reservation.status = 'pending'
   )
   and not exists (
     select 1 from public.blue_runtime_credentials credential
      where credential.request_id = task.request_id
        and (credential.state <> 'failed'
          or coalesce(credential.provider_usage_final, 0) > credential.provider_usage_start)
   );

-- One statement uses one database snapshot for available funds and all pending
-- holds, including other devices and legacy gateway requests. Runtime terminal
-- rows retain historical allowances and are not the source of current holds.
create or replace function public.blue_credit_snapshot(user_id_param uuid)
returns jsonb as $$
  with wallet as (
    select greatest(coalesce(blue_credits, 0), 0) as available
      from public.wallets where user_id = user_id_param
  ), holds as (
    select
      coalesce(sum(reservation.reserved_blue_credits), 0) as held,
      count(*) filter (where reservation.reserved_blue_credits > 0) as hold_count,
      coalesce(sum(reservation.reserved_blue_credits) filter (
        where task.state = 'stopping'
      ), 0) as pending_settlement,
      count(*) filter (
        where task.state = 'stopping' and reservation.reserved_blue_credits > 0
      ) as pending_settlement_count
      from public.billing_reservations reservation
      left join public.blue_runtime_tasks task
        on task.request_id = reservation.request_id
       and task.user_id = reservation.user_id
     where reservation.user_id = user_id_param and reservation.status = 'pending'
  )
  select jsonb_build_object(
    'available_blue_credits', coalesce((select available from wallet), 0),
    'temporarily_held_blue_credits', held,
    'total_blue_credits', coalesce((select available from wallet), 0) + held,
    'hold_count', hold_count,
    'pending_settlement_blue_credits', pending_settlement,
    'pending_settlement_count', pending_settlement_count,
    'as_of', statement_timestamp()
  ) from holds;
$$ language sql stable security definer set search_path = public;

-- The application flags only a still-provisioning task after credential setup
-- failed. It never flags an active task or a failed rotation of an admitted
-- task. Release and terminal transition share a transaction: a failed release
-- leaves the flagged nonterminal task available for retry/reconciliation.
create or replace function public.release_unprovisioned_blue_runtime_task(
  user_id_param uuid,
  request_id_param text
) returns jsonb as $$
declare
  task_record public.blue_runtime_tasks%rowtype;
  reservation_record public.billing_reservations%rowtype;
  receipt jsonb;
begin
  select * into task_record from public.blue_runtime_tasks
   where user_id = user_id_param and request_id = request_id_param for update;
  if task_record.request_id is null then raise exception 'Blue runtime task not found'; end if;
  if task_record.state <> 'provisioning' or not task_record.unprovisioned_release_pending then
    return jsonb_build_object('released', false, 'state', task_record.state);
  end if;
  if exists (
    select 1 from public.blue_runtime_credentials
     where request_id = request_id_param and state in ('active', 'provisioning')
  ) then
    raise exception 'Initial Blue release still has a live credential';
  end if;
  select * into reservation_record from public.billing_reservations
   where user_id = user_id_param and request_id = request_id_param for update;
  if reservation_record.request_id is null
     or reservation_record.status not in ('pending', 'released') then
    raise exception 'Initial Blue reservation cannot be safely released';
  end if;

  receipt := public.release_blue_credit_reservation(user_id_param, request_id_param);
  update public.blue_runtime_tasks
     set state = 'failed', unprovisioned_release_pending = false,
         charged_blue_credits = 0, provider_cost = 0,
         balance_after = (receipt->>'remaining')::numeric,
         execution_released_at = now(), updated_at = now(), finished_at = now()
   where user_id = user_id_param and request_id = request_id_param;
  return jsonb_build_object('released', true, 'state', 'failed', 'remaining', receipt->'remaining');
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.blue_credit_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.release_unprovisioned_blue_runtime_task(uuid, text) from public, anon, authenticated;
grant execute on function public.blue_credit_snapshot(uuid) to service_role;
grant execute on function public.release_unprovisioned_blue_runtime_task(uuid, text) to service_role;
