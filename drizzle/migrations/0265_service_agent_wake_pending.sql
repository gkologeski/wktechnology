-- A newer inbound queued during inference wakes again as soon as the stale run releases.
-- Reuse the existing authenticated cron command; never return its credentials.
CREATE OR REPLACE FUNCTION public.service_agent_wake_next() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cmd text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.service_agent_jobs WHERE session_id=NEW.session_id AND status='queued') THEN RETURN NULL;END IF;
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'sdr-tick';
  IF v_cmd IS NOT NULL THEN
    IF position('timeout_milliseconds' in v_cmd) = 0 THEN
      v_cmd := replace(v_cmd, 'body:=''{}''::jsonb)', 'body:=''{}''::jsonb, timeout_milliseconds:=75000)');
    END IF;
    EXECUTE v_cmd;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'service_agent_wake_next: %', SQLERRM;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_wake_next() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER service_agent_running_finished AFTER UPDATE OF status ON public.service_agent_jobs
FOR EACH ROW WHEN(OLD.status='running' AND NEW.status<>'running') EXECUTE FUNCTION public.service_agent_wake_next();
