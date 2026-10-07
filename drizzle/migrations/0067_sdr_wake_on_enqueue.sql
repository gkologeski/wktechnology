CREATE OR REPLACE FUNCTION public.sdr_wake_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cmd text;
BEGIN
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'sdr-tick';
  IF v_cmd IS NOT NULL THEN
    EXECUTE v_cmd;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sdr_wake_worker: %', SQLERRM;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sdr_wake_worker() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sdr_turn_jobs_wake ON public.sdr_turn_jobs;
CREATE TRIGGER sdr_turn_jobs_wake AFTER INSERT ON public.sdr_turn_jobs
  FOR EACH ROW WHEN (NEW.status = 'queued') EXECUTE FUNCTION public.sdr_wake_worker();
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='sdr-tick'), active := true);