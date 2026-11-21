-- Keep ambiguous model charges pending while OpenRouter finalizes its usage.
begin;

alter table public.blue_proxy_calls add column if not exists reconcile_after timestamptz;

create or replace function public.claim_blue_proxy_reconciliation(limit_param integer, request_id_param text default null, user_id_param uuid default null)
returns table(id uuid, state text, provider_generation_id text, updated_at timestamptz) language sql security definer set search_path=public as $$
  with candidates as (
    select c.id
    from public.blue_proxy_calls c
    join public.blue_runtime_tasks t on t.request_id=c.request_id and t.user_id=c.user_id
    where c.state in ('reserved','dispatching','pending')
      and (request_id_param is null or (c.request_id=request_id_param and c.user_id=user_id_param))
      and (c.reconcile_after is null or c.reconcile_after<=now())
      and (
        (c.state='reserved' and c.updated_at<=now()-interval '6 minutes')
        or (c.state in ('dispatching','pending')
          and ((t.state='stopping' and c.updated_at<=now()-interval '30 seconds') or t.expires_at<=now())
          and (c.provider_generation_id is not null or c.updated_at<=now()-interval '24 hours'))
      )
    order by c.updated_at
    limit greatest(0,least(250,limit_param))
    for update of c skip locked
  )
  update public.blue_proxy_calls c set reconcile_after=now()+interval '1 minute'
  from candidates where c.id=candidates.id
  returning c.id,c.state,c.provider_generation_id,c.updated_at;
$$;

create or replace function public.expire_blue_unverified_proxy_call(call_id_param uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare c public.blue_proxy_calls%rowtype; t public.blue_runtime_tasks%rowtype;
begin
  select * into c from public.blue_proxy_calls where id=call_id_param;
  if not found then return false; end if;
  select * into t from public.blue_runtime_tasks where request_id=c.request_id for update;
  select * into c from public.blue_proxy_calls where id=call_id_param for update;
  if c.state not in ('dispatching','pending') or c.updated_at>now()-interval '24 hours'
      or (t.state<>'stopping' and t.expires_at>now()) then return false; end if;

  -- Release only the unverified call. Preserve confirmed spend, and record
  -- that Blue absorbed a possible provider charge rather than assuming zero.
  update public.blue_proxy_calls set state='released',updated_at=now(),reconcile_after=null
    where id=c.id;
  update public.blue_runtime_tasks set
    proxy_committed_cost=greatest(0,proxy_committed_cost-c.hold_cost),updated_at=now()
    where request_id=c.request_id;
  insert into public.blue_credit_events(user_id,request_id,call_id,kind)
    values(c.user_id,c.request_id,c.id,'call_expired_unverified');
  return true;
end;
$$;

revoke all on function public.claim_blue_proxy_reconciliation(integer,text,uuid),
  public.expire_blue_unverified_proxy_call(uuid) from public,anon,authenticated;
grant execute on function public.claim_blue_proxy_reconciliation(integer,text,uuid),
  public.expire_blue_unverified_proxy_call(uuid) to service_role;

commit;
