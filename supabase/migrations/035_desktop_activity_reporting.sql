-- Operational metadata only. These client reports are never billing evidence.
-- No message/task text, paths, URLs, raw errors, device IDs, or credentials are stored.
begin;

create table if not exists public.desktop_app_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  app_version text not null check (app_version ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz,
  closed_at timestamptz,
  primary key (user_id, session_id)
);
create index if not exists desktop_app_sessions_last_seen_idx on public.desktop_app_sessions(last_seen_at desc) where closed_at is null;
create index if not exists desktop_app_sessions_seen_users_idx on public.desktop_app_sessions(last_seen_at desc,user_id);

create table if not exists public.desktop_task_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  session_id uuid not null,
  revision smallint not null check (revision in (1,2)),
  kind text not null check (kind in ('chat','team','coordinator','diagnostic')),
  status text not null check (status in ('started','completed','failed','stopped','interrupted')),
  provider text not null check (provider in ('blue','openrouter','opencode','unknown')),
  model text,
  engine text check (engine in ('codex','opencode')),
  duration_ms integer check (duration_ms >= 0),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cache_read_tokens integer check (cache_read_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens >= 0),
  error_code text check (error_code in ('timeout','connection','authentication','rate_limit','credits','permission','workspace','provider','internal','cancelled','unknown')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id,run_id),
  foreign key (user_id,session_id) references public.desktop_app_sessions(user_id,session_id) on delete cascade,
  check ((revision = 1) = (status = 'started')),
  check (revision <> 1 or (duration_ms is null and error_code is null)),
  check (status <> 'completed' or error_code is null),
  check (model is null or (length(model) <= 128 and model ~* '^[a-z0-9][a-z0-9._:-]*(/[a-z0-9][a-z0-9._:-]*)?$'
    and model !~* '(^|/)(sk[-_]|gsk[-_]|github_pat_|sb[-_]|eyJ|AIza|gh[pousr]_|xox[baprs]-|bearer|token[-_:])'
    and model !~* '^[a-z][a-z0-9+.-]*:/' and position('..' in model) = 0))
);
create index if not exists desktop_task_runs_started_idx on public.desktop_task_runs(started_at desc);
create index if not exists desktop_task_runs_user_started_idx on public.desktop_task_runs(user_id,started_at desc);
create index if not exists desktop_task_runs_updated_users_idx on public.desktop_task_runs(updated_at desc,user_id);
create index if not exists desktop_task_runs_error_idx on public.desktop_task_runs(updated_at desc) where status in ('failed','interrupted');

alter table public.desktop_app_sessions enable row level security;
alter table public.desktop_task_runs enable row level security;
revoke all on public.desktop_app_sessions, public.desktop_task_runs from public,anon,authenticated,service_role;
grant select on public.desktop_app_sessions, public.desktop_task_runs to service_role;
comment on table public.desktop_task_runs is 'Untrusted client-reported operational counters. Never use for credits, invoices, cost, or wallet settlement.';

create or replace function public.record_desktop_activity(
  user_id_param uuid, session_id_param uuid, app_version_param text,
  presence_param text, runs_param jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  report jsonb;
  prior public.desktop_task_runs%rowtype;
  session_row public.desktop_app_sessions%rowtype;
  effective_provider text;
  effective_model text;
  effective_engine text;
  incoming_revision integer;
  inserted_count integer := 0;
  updated_count integer := 0;
  already_count integer := 0;
  ignored_count integer := 0;
  reported_at timestamptz := now();
  numeric_key text;
begin
  if user_id_param is null or session_id_param is null or app_version_param is null
    or app_version_param !~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'
    or (presence_param is not null and presence_param not in ('active','closed'))
    or jsonb_typeof(runs_param) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid activity batch';
  end if;
  if jsonb_array_length(runs_param) > 32 or octet_length(runs_param::text) > 65536
    or (presence_param is null and jsonb_array_length(runs_param) = 0) then
    raise exception using errcode = '22023', message = 'Invalid activity batch';
  end if;
  if (select count(*) from jsonb_array_elements(runs_param)) <>
    (select count(distinct lower(value->>'run_id')) from jsonb_array_elements(runs_param)) then
    raise exception using errcode = '22023', message = 'Duplicate activity run';
  end if;
  -- Validate the complete batch before changing even presence. Service callers must
  -- meet the same privacy boundary as the HTTP route.
  for report in select value from jsonb_array_elements(runs_param) loop
    if jsonb_typeof(report) is distinct from 'object' or
      (select array_agg(key order by key) from jsonb_object_keys(report) key) is distinct from
      array['cache_read_tokens','cache_write_tokens','duration_ms','engine','error_code','input_tokens','kind','model','output_tokens','provider','revision','run_id','status']::text[]
      or jsonb_typeof(report->'run_id') is distinct from 'string'
      or report->>'run_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(report->'revision') is distinct from 'number' or report->>'revision' not in ('1','2')
      or jsonb_typeof(report->'kind') is distinct from 'string' or report->>'kind' not in ('chat','team','coordinator','diagnostic')
      or jsonb_typeof(report->'status') is distinct from 'string' or report->>'status' not in ('started','completed','failed','stopped','interrupted')
      or ((report->>'revision' = '1') <> (report->>'status' = 'started'))
      or jsonb_typeof(report->'provider') is distinct from 'string' or report->>'provider' not in ('blue','openrouter','opencode','unknown')
      or (report->'engine' <> 'null'::jsonb and (jsonb_typeof(report->'engine') is distinct from 'string' or report->>'engine' not in ('codex','opencode')))
      or (report->'error_code' <> 'null'::jsonb and (jsonb_typeof(report->'error_code') is distinct from 'string'
        or report->>'error_code' not in ('timeout','connection','authentication','rate_limit','credits','permission','workspace','provider','internal','cancelled','unknown')))
      or (report->'model' <> 'null'::jsonb and (jsonb_typeof(report->'model') is distinct from 'string'
        or length(report->>'model') > 128 or report->>'model' !~* '^[a-z0-9][a-z0-9._:-]*(/[a-z0-9][a-z0-9._:-]*)?$'
        or report->>'model' ~* '(^|/)(sk[-_]|gsk[-_]|github_pat_|sb[-_]|eyJ|AIza|gh[pousr]_|xox[baprs]-|bearer|token[-_:])'
        or report->>'model' ~* '^[a-z][a-z0-9+.-]*:/'
        or position('..' in report->>'model') > 0))
      or (report->>'revision' = '1' and (report->'duration_ms' <> 'null'::jsonb or report->'error_code' <> 'null'::jsonb))
      or (report->>'status' = 'completed' and report->'error_code' <> 'null'::jsonb) then
      raise exception using errcode = '22023', message = 'Invalid activity run';
    end if;
    foreach numeric_key in array array['duration_ms','input_tokens','output_tokens','cache_read_tokens','cache_write_tokens'] loop
      if report->numeric_key <> 'null'::jsonb and (jsonb_typeof(report->numeric_key) is distinct from 'number'
        or report->>numeric_key !~ '^[0-9]{1,10}$' or (report->>numeric_key)::numeric > 2147483647) then
        raise exception using errcode = '22023', message = 'Invalid activity counter';
      end if;
    end loop;
  end loop;

  insert into public.desktop_app_sessions(user_id,session_id,app_version,started_at,last_seen_at,closed_at)
    values(user_id_param,session_id_param,app_version_param,reported_at,
      case when presence_param = 'active' then reported_at else null end,
      case when presence_param = 'closed' then reported_at else null end)
    on conflict (user_id,session_id) do nothing;
  select * into session_row from public.desktop_app_sessions
    where user_id = user_id_param and session_id = session_id_param for update;
  if session_row.app_version <> app_version_param then
    raise exception using errcode = '22023', message = 'Activity session version conflicts';
  end if;
  if presence_param is not null and session_row.closed_at is null then
    update public.desktop_app_sessions set
      last_seen_at = case when presence_param = 'active' then reported_at else last_seen_at end,
      closed_at = case when presence_param = 'closed' then reported_at else null end
      where user_id = user_id_param and session_id = session_id_param;
  end if;

  -- Stable lock ordering keeps concurrent batches from deadlocking on run rows.
  for report in select value from jsonb_array_elements(runs_param) order by lower(value->>'run_id') loop
    incoming_revision := (report->>'revision')::integer;
    insert into public.desktop_task_runs(user_id,run_id,session_id,revision,kind,status,provider,model,engine,
      duration_ms,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,error_code,started_at,updated_at,finished_at)
      values(user_id_param,(report->>'run_id')::uuid,session_id_param,incoming_revision,report->>'kind',report->>'status',
        report->>'provider',report->>'model',report->>'engine',(report->>'duration_ms')::integer,
        (report->>'input_tokens')::integer,(report->>'output_tokens')::integer,(report->>'cache_read_tokens')::integer,
        (report->>'cache_write_tokens')::integer,report->>'error_code',reported_at,reported_at,
        case when incoming_revision = 2 then reported_at else null end)
      on conflict (user_id,run_id) do nothing;
    if found then inserted_count := inserted_count + 1; continue; end if;
    select * into prior from public.desktop_task_runs where user_id = user_id_param
      and run_id = (report->>'run_id')::uuid for update;
    if prior.session_id <> session_id_param or prior.kind <> report->>'kind' then
      raise exception using errcode = '22023', message = 'Activity run identity conflicts';
    end if;
    if prior.revision = 2 and incoming_revision = 1 then
      ignored_count := ignored_count + 1; continue;
    end if;
    if (prior.provider <> 'unknown' and report->>'provider' <> 'unknown' and prior.provider <> report->>'provider')
      or (prior.model is not null and report->>'model' is not null and prior.model <> report->>'model')
      or (prior.engine is not null and report->>'engine' is not null and prior.engine <> report->>'engine') then
      raise exception using errcode = '22023', message = 'Activity run metadata conflicts';
    end if;
    effective_provider := case when prior.provider = 'unknown' then report->>'provider' else prior.provider end;
    effective_model := coalesce(prior.model,report->>'model');
    effective_engine := coalesce(prior.engine,report->>'engine');
    if prior.revision = 2 then
      if prior.status <> report->>'status' or prior.provider <> effective_provider
        or prior.model is distinct from effective_model or prior.engine is distinct from effective_engine
        or prior.duration_ms is distinct from (report->>'duration_ms')::integer
        or prior.input_tokens is distinct from (report->>'input_tokens')::integer
        or prior.output_tokens is distinct from (report->>'output_tokens')::integer
        or prior.cache_read_tokens is distinct from (report->>'cache_read_tokens')::integer
        or prior.cache_write_tokens is distinct from (report->>'cache_write_tokens')::integer
        or prior.error_code is distinct from report->>'error_code' then
        raise exception using errcode = '22023', message = 'Terminal activity report conflicts';
      end if;
      already_count := already_count + 1; continue;
    end if;
    if incoming_revision = 1 then already_count := already_count + 1; continue; end if;
    update public.desktop_task_runs set revision = 2,status = report->>'status',provider = effective_provider,
      model = effective_model,engine = effective_engine,duration_ms = (report->>'duration_ms')::integer,
      input_tokens = (report->>'input_tokens')::integer,output_tokens = (report->>'output_tokens')::integer,
      cache_read_tokens = (report->>'cache_read_tokens')::integer,cache_write_tokens = (report->>'cache_write_tokens')::integer,
      error_code = report->>'error_code',updated_at = reported_at,finished_at = reported_at
      where user_id = user_id_param and run_id = (report->>'run_id')::uuid;
    updated_count := updated_count + 1;
  end loop;
  return jsonb_build_object('accepted',true,'inserted',inserted_count,'updated',updated_count,
    'already_recorded',already_count,'ignored_older',ignored_count);
end;
$$;
revoke all on function public.record_desktop_activity(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_desktop_activity(uuid,uuid,text,text,jsonb) to service_role;
commit;
