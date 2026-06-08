
CREATE TABLE IF NOT EXISTS public.sdr_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  enabled boolean NOT NULL DEFAULT true,
  max_messages int NOT NULL DEFAULT 5,
  business_hours jsonb NOT NULL DEFAULT '{"tz":"America/Sao_Paulo","start":"09:00","end":"18:00","weekdays":[1,2,3,4,5]}'::jsonb,
  opt_out_phrases text[] NOT NULL DEFAULT ARRAY['pare','sair','remover','stop','unsubscribe'],
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_prompt text,
  handoff_score int NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_playbooks TO authenticated;
GRANT ALL ON public.sdr_playbooks TO service_role;
ALTER TABLE public.sdr_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_playbooks owner all" ON public.sdr_playbooks FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.sdr_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  playbook_id uuid NOT NULL REFERENCES public.sdr_playbooks(id) ON DELETE CASCADE,
  lead_id uuid,
  contact_id uuid,
  status text NOT NULL DEFAULT 'active',
  messages_sent int NOT NULL DEFAULT 0,
  last_action_at timestamptz,
  handoff_at timestamptz,
  handoff_reason text,
  qualification_score int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sdr_enrollments_owner_idx ON public.sdr_enrollments(owner_id);
CREATE INDEX IF NOT EXISTS sdr_enrollments_lead_idx ON public.sdr_enrollments(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_enrollments TO authenticated;
GRANT ALL ON public.sdr_enrollments TO service_role;
ALTER TABLE public.sdr_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr_enrollments owner all" ON public.sdr_enrollments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ml_forecast_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  probability numeric(5,4) NOT NULL,
  expected_value numeric(14,2) NOT NULL DEFAULT 0,
  confidence_lo numeric(5,4),
  confidence_hi numeric(5,4),
  top_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_version text NOT NULL DEFAULT 'heuristic-v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id)
);
CREATE INDEX IF NOT EXISTS ml_forecast_owner_idx ON public.ml_forecast_scores(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_forecast_scores TO authenticated;
GRANT ALL ON public.ml_forecast_scores TO service_role;
ALTER TABLE public.ml_forecast_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml_forecast owner all" ON public.ml_forecast_scores FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ml_scoring_models (
  owner_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'untrained',
  last_trained_at timestamptz,
  accuracy numeric(5,4),
  sample_size int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight_ml numeric(3,2) NOT NULL DEFAULT 0.50,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_scoring_models TO authenticated;
GRANT ALL ON public.ml_scoring_models TO service_role;
ALTER TABLE public.ml_scoring_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml_scoring_models owner all" ON public.ml_scoring_models FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.copilot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copilot_sessions_user_idx ON public.copilot_sessions(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_sessions TO authenticated;
GRANT ALL ON public.copilot_sessions TO service_role;
ALTER TABLE public.copilot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_sessions user all" ON public.copilot_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.copilot_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_messages via session" ON public.copilot_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.copilot_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.copilot_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
