
-- 1. Tabela de análises de IA dos bug reports
CREATE TABLE public.bug_report_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok', -- ok | error
  error TEXT,
  summary TEXT,
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  suspected_area TEXT,
  suspected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  root_cause TEXT,
  proposed_fix TEXT,
  reproduction_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(3,2),
  lovable_prompt TEXT
);

CREATE INDEX bug_report_analyses_report_idx
  ON public.bug_report_analyses (bug_report_id, created_at DESC);

-- Grants (REST/PostgREST default deny)
GRANT SELECT ON public.bug_report_analyses TO authenticated;
GRANT ALL ON public.bug_report_analyses TO service_role;

-- RLS: somente platform admins leem; escrita via service_role
ALTER TABLE public.bug_report_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read bug_report_analyses"
  ON public.bug_report_analyses FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 2. Trigger: ao inserir um novo chamado, dispara análise via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_bug_report_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/bug-report-analyze';
BEGIN
  -- O segredo é lido de uma GUC em runtime; se não estiver presente,
  -- a análise pode ser disparada manualmente pelo botão "Reanalisar".
  BEGIN
    v_secret := current_setting('app.cron_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL OR length(v_secret) < 8 THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('bug_report_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca falhar o insert do chamado por causa da análise
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bug_reports_ai_analyze_aft_ins ON public.bug_reports;
CREATE TRIGGER bug_reports_ai_analyze_aft_ins
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.trigger_bug_report_analysis();
