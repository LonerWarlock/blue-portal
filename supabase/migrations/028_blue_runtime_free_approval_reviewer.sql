-- Add the exact zero-priced reviewer while preserving GPT reviewer bindings
-- on installed clients and persisted tasks. Free coding + free review uses
-- one zero-credit reservation; paid coding and GPT review keep positive holds.
alter table public.blue_runtime_tasks
  drop constraint if exists blue_runtime_tasks_reviewer_model_check;
alter table public.blue_runtime_tasks
  add constraint blue_runtime_tasks_reviewer_model_check
    check (reviewer_model is null or reviewer_model in
      ('openai/gpt-5.4-mini', 'qwen/qwen3.8-27b:free'));

create or replace function public.admit_blue_runtime_task_v3(
  user_id_param uuid, request_id_param text, device_hash_param text,
  payload_hash_param text, model_param text, mode_param text,
  is_free_param boolean, access_tier_param text, amount_param numeric,
  global_limit_param integer, queue_limit_param integer,
  queue_expires_at_param timestamptz, active_expires_at_param timestamptz,
  reviewer_model_param text
) returns jsonb as $$
declare
  existing_task public.blue_runtime_tasks%rowtype;
  admission jsonb;
  free_review_task boolean;
begin
  if reviewer_model_param is null or reviewer_model_param not in
    ('openai/gpt-5.4-mini', 'qwen/qwen3.8-27b:free') then
    raise exception 'Invalid approval reviewer model';
  end if;
  free_review_task := coalesce(is_free_param, false)
    and reviewer_model_param = 'qwen/qwen3.8-27b:free';
  if amount_param is null or amount_param < 0
    or (free_review_task and amount_param <> 0)
    or (not free_review_task and amount_param <= 0) then
    raise exception 'Invalid runtime allowance for approval reviewer';
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
  -- Retain v2's existing queue, concurrency limits and reservation accounting.
  -- It independently rejects changes to the coding model or payload identity.
  admission := public.admit_blue_runtime_task_v2(
    user_id_param, request_id_param, device_hash_param, payload_hash_param,
    model_param, mode_param, is_free_param, access_tier_param, amount_param,
    global_limit_param, queue_limit_param, queue_expires_at_param, active_expires_at_param
  );
  if coalesce((admission->>'conflict')::boolean, false) then return admission; end if;
  -- Commit the immutable reviewer binding with the same task transaction.
  update public.blue_runtime_tasks set reviewer_model = reviewer_model_param
    where request_id = request_id_param and user_id = user_id_param;
  return admission;
end;
$$ language plpgsql security definer set search_path = public;

-- Remove direct default grants as well as PUBLIC's implicit EXECUTE grant.
revoke all on function public.admit_blue_runtime_task_v3(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admit_blue_runtime_task_v3(uuid, text, text, text, text, text, boolean, text, numeric, integer, integer, timestamptz, timestamptz, text) to service_role;
