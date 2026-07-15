create or replace function public.invoke_result_monitor()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  monitor_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into monitor_secret
  from vault.decrypted_secrets
  where name = 'result_monitor_secret'
  limit 1;

  if monitor_secret is null or length(monitor_secret) < 32 then
    raise exception 'Result monitor secret is not configured in Vault';
  end if;

  select net.http_post(
    url := 'https://dbboss-calculator.vercel.app/api/monitor-results',
    body := jsonb_build_object('scheduled_at', now()),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || monitor_secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 20000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_result_monitor() from public, anon, authenticated;
grant execute on function public.invoke_result_monitor() to postgres;

create or replace function public.cleanup_result_monitor_history()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.monitor_runs
  where started_at < now() - interval '30 days';

  delete from public.monitor_candidates
  where last_seen_at < now() - interval '2 days';
$$;

revoke all on function public.cleanup_result_monitor_history() from public, anon, authenticated;
grant execute on function public.cleanup_result_monitor_history() to postgres;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'lakshmi-boss-result-monitor';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select jobid into existing_job_id
  from cron.job
  where jobname = 'lakshmi-boss-monitor-cleanup';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

-- pg_cron uses UTC. This runs every two minutes from 11:30 through 01:28 IST,
-- covering all configured open/close monitoring windows with two-observation
-- confirmation while avoiding needless overnight invocations.
select cron.schedule(
  'lakshmi-boss-result-monitor',
  '*/2 6-19 * * *',
  'select public.invoke_result_monitor();'
);

select cron.schedule(
  'lakshmi-boss-monitor-cleanup',
  '30 1 * * *',
  'select public.cleanup_result_monitor_history();'
);

comment on function public.invoke_result_monitor() is
  'Calls the protected production result monitor using a bearer token from Supabase Vault.';

comment on function public.cleanup_result_monitor_history() is
  'Retains 30 days of monitor audit runs and removes stale confirmation candidates.';
