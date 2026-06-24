
-- ============================================================
-- ATS Fase 1: auditoria de movimentações + fila de e-mails
-- para o candidato (confirmação de candidatura, etc.)
-- ============================================================

-- 1) Tabela de eventos da candidatura (auditoria/timeline)
CREATE TABLE public.ats_application_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  application_id UUID NOT NULL REFERENCES public.ats_applications(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  -- ex: stage_moved | application_created | scorecard_submitted | email_queued | email_sent
  from_stage TEXT,
  to_stage TEXT,
  actor_id UUID,
  -- usuário que realizou (null = sistema / candidato público)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ats_application_events_app_idx
  ON public.ats_application_events (application_id, created_at DESC);
CREATE INDEX ats_application_events_owner_idx
  ON public.ats_application_events (owner_id, created_at DESC);

GRANT SELECT, INSERT ON public.ats_application_events TO authenticated;
GRANT ALL ON public.ats_application_events TO service_role;

ALTER TABLE public.ats_application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_application_events_owner_select"
  ON public.ats_application_events
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "ats_application_events_owner_insert"
  ON public.ats_application_events
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 2) Fila de e-mails para o CANDIDATO (confirmação da candidatura
-- e outras notificações). Separado de ats_stage_email_log que é o
-- log dos e-mails do RECRUTADOR para o candidato por stage.
CREATE TABLE public.ats_candidate_email_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  application_id UUID REFERENCES public.ats_applications(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  job_id UUID,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | sent | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ats_candidate_email_queue_pending_idx
  ON public.ats_candidate_email_queue (status, scheduled_for)
  WHERE status = 'pending';

GRANT SELECT ON public.ats_candidate_email_queue TO authenticated;
GRANT ALL ON public.ats_candidate_email_queue TO service_role;

ALTER TABLE public.ats_candidate_email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_candidate_email_queue_owner_select"
  ON public.ats_candidate_email_queue
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());
