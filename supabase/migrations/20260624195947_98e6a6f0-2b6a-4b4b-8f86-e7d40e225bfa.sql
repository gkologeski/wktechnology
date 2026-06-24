
-- Tabela de entrevistas do ATS
CREATE TABLE public.ats_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES public.ats_applications(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.ats_jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  interviewer_id uuid,
  stage_value text,
  kind text NOT NULL DEFAULT 'video' CHECK (kind IN ('phone','video','onsite','async')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','done','no_show','canceled','rescheduled','pending_candidate')),
  scheduled_at timestamptz,
  duration_min integer NOT NULL DEFAULT 45,
  meet_url text,
  location text,
  notes text,
  self_schedule_token text UNIQUE,
  self_schedule_expires_at timestamptz,
  slots jsonb,
  reminder_d1_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_interviews TO authenticated;
GRANT ALL ON public.ats_interviews TO service_role;
GRANT SELECT, UPDATE ON public.ats_interviews TO anon; -- leitura/escrita via token de auto-agendamento (controlada por policy)

ALTER TABLE public.ats_interviews ENABLE ROW LEVEL SECURITY;

-- Acesso da equipe via helper já existente
CREATE POLICY "ats_interviews_team_select"
  ON public.ats_interviews FOR SELECT
  TO authenticated
  USING (public.can_access_ats_job(job_id));

CREATE POLICY "ats_interviews_team_insert"
  ON public.ats_interviews FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_ats_job(job_id) AND owner_id = auth.uid());

CREATE POLICY "ats_interviews_team_update"
  ON public.ats_interviews FOR UPDATE
  TO authenticated
  USING (public.can_access_ats_job(job_id))
  WITH CHECK (public.can_access_ats_job(job_id));

CREATE POLICY "ats_interviews_team_delete"
  ON public.ats_interviews FOR DELETE
  TO authenticated
  USING (public.can_access_ats_job(job_id));

-- Acesso público restrito via token de auto-agendamento (candidato escolhe horário)
CREATE POLICY "ats_interviews_public_token_select"
  ON public.ats_interviews FOR SELECT
  TO anon
  USING (self_schedule_token IS NOT NULL AND (self_schedule_expires_at IS NULL OR self_schedule_expires_at > now()));

-- Updates via token são feitos por server function pública usando service_role; sem policy anon de UPDATE direto.

-- Trigger updated_at (reutiliza função padrão se existir)
CREATE OR REPLACE FUNCTION public.touch_ats_interviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_touch_ats_interviews
  BEFORE UPDATE ON public.ats_interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_ats_interviews_updated_at();

CREATE INDEX idx_ats_interviews_application ON public.ats_interviews(application_id);
CREATE INDEX idx_ats_interviews_job ON public.ats_interviews(job_id);
CREATE INDEX idx_ats_interviews_owner ON public.ats_interviews(owner_id);
CREATE INDEX idx_ats_interviews_scheduled ON public.ats_interviews(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_ats_interviews_token ON public.ats_interviews(self_schedule_token) WHERE self_schedule_token IS NOT NULL;
