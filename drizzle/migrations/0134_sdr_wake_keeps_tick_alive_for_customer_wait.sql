-- Tempo de aguardo do cliente: o despertar mantém a chamada aberta (até 75 s)
-- para o tick poder esperar a resposta adiada vencer sem ser cancelado.
CREATE OR REPLACE FUNCTION public.sdr_wake_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cmd text;
BEGIN
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'sdr-tick';
  IF v_cmd IS NOT NULL THEN
    IF position('timeout_milliseconds' in v_cmd) = 0 THEN
      v_cmd := replace(v_cmd, 'body:=''{}''::jsonb)', 'body:=''{}''::jsonb, timeout_milliseconds:=75000)');
    END IF;
    EXECUTE v_cmd;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sdr_wake_worker: %', SQLERRM;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.sdr_wake_worker() FROM PUBLIC, anon, authenticated;