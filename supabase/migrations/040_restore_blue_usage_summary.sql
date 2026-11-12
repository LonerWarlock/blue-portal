-- Repair the optional dashboard RPC without rerunning unrelated migration 021.
begin;
create or replace function public.blue_usage_summary(user_id_param uuid, since_param timestamptz)
returns jsonb as $$
  with per_model as (
    select coalesce(nullif(model,''),'unknown') model_name, count(*)::bigint request_count,
      coalesce(sum(blue_credits_cost),0)::numeric total_cost
    from public.billing_transactions
    where user_id=user_id_param and account_type='pro_payg' and created_at>=since_param
    group by coalesce(nullif(model,''),'unknown')
  )
  select jsonb_build_object('total_requests',coalesce(sum(request_count),0),
    'total_blue_credits_used',coalesce(sum(total_cost),0),
    'model_breakdown',coalesce(jsonb_object_agg(model_name,
      jsonb_build_object('requests',request_count,'totalCost',total_cost)),'{}'::jsonb)) from per_model;
$$ language sql stable security definer set search_path=public;
revoke all on function public.blue_usage_summary(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.blue_usage_summary(uuid,timestamptz) to service_role;
notify pgrst, 'reload schema';
commit;
