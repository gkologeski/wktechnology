-- Pesquisas: construtor com rascunho/versões, pontuação opcional e importação. Aditiva.
ALTER TABLE public.survey_templates
  ADD COLUMN IF NOT EXISTS draft_schema jsonb,
  ADD COLUMN IF NOT EXISTS draft_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_version integer,
  ADD COLUMN IF NOT EXISTS scoring_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.survey_template_questions
  ADD COLUMN IF NOT EXISTS scored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS field_key text,
  ADD COLUMN IF NOT EXISTS page integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions jsonb;

ALTER TABLE public.activity_survey_responses
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS schema_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS activity_survey_responses_idem
  ON public.activity_survey_responses (workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Questionários existentes continuam pontuados (comportamento preservado).
ALTER TABLE public.prospecting_questionnaires
  ADD COLUMN IF NOT EXISTS scoring_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.prospecting_questions
  ADD COLUMN IF NOT EXISTS scored boolean NOT NULL DEFAULT true;

CREATE TABLE public.survey_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.survey_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  schema jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
GRANT SELECT, INSERT ON public.survey_template_versions TO authenticated;
GRANT ALL ON public.survey_template_versions TO service_role;
ALTER TABLE public.survey_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY stv_select ON public.survey_template_versions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY stv_insert ON public.survey_template_versions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_ins ON public.survey_template_versions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_read_only_view());

CREATE TABLE public.survey_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  created_by uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('url','pdf','docx','image')),
  source_name text NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed','cancelled')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, content_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_imports TO authenticated;
GRANT ALL ON public.survey_imports TO service_role;
ALTER TABLE public.survey_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY si_all ON public.survey_imports FOR ALL TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (created_by = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_si ON public.survey_imports AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_read_only_view()) WITH CHECK (NOT is_read_only_view());

-- Backfill verificável: chave estável por pergunta = id existente.
UPDATE public.survey_template_questions SET field_key = id::text WHERE field_key IS NULL;