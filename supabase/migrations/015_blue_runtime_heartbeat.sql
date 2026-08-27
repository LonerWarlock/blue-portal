-- A direct model stream is local to the extension, so persist a tiny
-- content-free activity signal. This distinguishes a healthy long task from
-- a crashed extension without keeping an abandoned task active for an hour.

alter table public.blue_runtime_tasks
  add column if not exists last_heartbeat_at timestamptz;

update public.blue_runtime_tasks
  set last_heartbeat_at = coalesce(last_heartbeat_at, updated_at, created_at)
  where last_heartbeat_at is null;

create index if not exists blue_runtime_tasks_active_heartbeat_idx
  on public.blue_runtime_tasks (user_id, last_heartbeat_at)
  where state in ('provisioning', 'active');
