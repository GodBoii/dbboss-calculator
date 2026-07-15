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
end;
$$;

-- One-minute observations keep the two-sample confirmation rule while cutting
-- expected result latency from roughly 2-4 minutes to roughly 1-2 minutes.
-- pg_cron uses UTC; 06:00-19:59 covers 11:30-01:29 IST.
select cron.schedule(
  'lakshmi-boss-result-monitor',
  '* 6-19 * * *',
  'select public.invoke_result_monitor();'
);
