-- Remove all cron jobs related to Supabase-managed follow-up
DO $$
DECLARE
  job RECORD;
BEGIN
  FOR job IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname ILIKE '%followup%' OR jobname ILIKE '%follow-up%' OR jobname ILIKE '%follow_up%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
    RAISE NOTICE 'Unscheduled cron job: %', job.jobname;
  END LOOP;
END $$;