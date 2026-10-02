-- Optional native approval reviewer. One task/slot/reservation/managed key.
-- No prompt, transcript, assessment or workspace content is stored here.
alter table public.blue_runtime_tasks
  add column if not exists reviewer_model text;

alter table public.blue_runtime_tasks
  drop constraint if exists blue_runtime_tasks_reviewer_model_check;
alter table public.blue_runtime_tasks
  add constraint blue_runtime_tasks_reviewer_model_check
    check (reviewer_model is null or reviewer_model = 'openai/gpt-5.4-mini');

-- v2 is unchanged for installed clients. The v3 wrapper shares v2's global
-- lock and queue scheduler, so a trial user's reviewer never needs a second
-- task slot. Reviewer identity is also included in the application's payload
-- hash; this independent check protects against incorrectly reused hashes.
create or replace function public.admit_blue_runtime_task_v3(
  user_id_param uuid,
  request_id_param text,
  device_hash_param text,
  payload_hash_param text,
  model_param text,
  mode_param text,
  is_free_param boolean,
  access_tier_param text,
  amount_param numeric,
  global_limit_param integer,
  queue_limit_param integer,
  queue_expires_at_param timestamptz,
  active_expires_at_param timestamptz,
  reviewer_model_param text
) returns jsonb as $$
declare
  existing_task public.blue_runtime_tasks%rowtype;
  admission jsonb;
begin
  if reviewer_model_param is distinct from 'openai/gpt-5.4-mini' then
    raise exception 'Invalid approval reviewer model';
  end if;
  if amount_param is null or amount_param <= 0 then
    raise exception 'Approval reviewer requires a positive runtime allowance';
  end if;
  perform pg_advisory_xact_lock(hashtext('blue-runtime-global-admission-v1'));
  select * into existing_task from public.blue_runtime_tasks
    where request_id = request_id_param for update;
  if existing_task.request_id is not null then
    if existing_task.user_id <> user_id_param then
      raise exception 'Request ID already belongs to another user';
    end if;
    if existing_task.reviewer_model is distinct from reviewer_model_param then
      return jsonb_build_object('accepted', false, 'conflict', true, 'state', existing_task.state);
    end if;
  end if;
  admission := public.admit_blue_runtime_task_v2(
    user_id_param, request_id_param, device_hash_param, payload_hash_param,
    model_param, mode_param, is_free_param, access_tier_param, amount_param,
    global_limit_param, queue_limit_param, queue_expires_at_param, active_expires_at_param
  );
  if coalesce((admission->>'conflict')::boolean, false) then return admission; end if;
  -- A brand-new row can be promoted inside v2. It is not observable to another
  -- transaction until this immutable reviewer binding is committed with it.
  update public.blue_runtime_tasks set reviewer_model = reviewer_model_param
    where request_id = request_id_param and user_id = user_id_param;
  return admission;
end;
$$ language plpgsql security definer set search_path = public;

-- Supabase may grant these roles EXECUTE through default privileges; revoking
-- PUBLIC alone does not remove their direct grants.
revoke all on function public.admit_blue_runtime_task_v3(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admit_blue_runtime_task_v3(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz, text) to service_role;
