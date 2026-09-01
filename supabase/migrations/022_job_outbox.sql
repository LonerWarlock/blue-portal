create table if not exists public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'retry', 'completed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_outbox_claim_idx
  on public.job_outbox (available_at, created_at)
  where status in ('queued', 'retry');

create index if not exists job_outbox_processing_idx
  on public.job_outbox (locked_at)
  where status = 'processing';

alter table public.job_outbox enable row level security;
revoke all on table public.job_outbox from anon, authenticated;
grant all on table public.job_outbox to service_role;

create or replace function public.claim_job_outbox(
  worker_id_param text,
  batch_size_param integer default 50,
  stale_after_seconds_param integer default 300
)
returns setof public.job_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(worker_id_param, '') = '' then
    raise exception 'worker_id is required';
  end if;

  return query
  with candidates as (
    select id
    from public.job_outbox
    where (
      status in ('queued', 'retry')
      and available_at <= now()
    ) or (
      status = 'processing'
      and locked_at < now() - make_interval(secs => greatest(30, stale_after_seconds_param))
    )
    order by available_at asc, created_at asc
    for update skip locked
    limit least(100, greatest(1, batch_size_param))
  )
  update public.job_outbox jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      locked_at = now(),
      locked_by = worker_id_param,
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_job_outbox(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_job_outbox(text, integer, integer) to service_role;
