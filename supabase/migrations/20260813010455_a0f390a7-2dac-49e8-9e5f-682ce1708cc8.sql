-- 1) Novo tipo de atividade
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'survey';

-- 2) survey_templates: descrição + escopo
ALTER TABLE public.survey_templates
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'ticket';

-- 3) Perguntas dos modelos de pesquisa
CREATE TABLE IF NOT EXISTS public.survey_template_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_template_id uuid NOT NULL REFERENCES public.survey_templates(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  workspace_id uuid,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  help_text text,
  type text NOT NULL DEFAULT 'short_text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS survey_template_questions_template_idx
  ON public.survey_template_questions(survey_template_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_template_questions TO authenticated;
GRANT ALL ON public.survey_template_questions TO service_role;
ALTER TABLE public.survey_template_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stq_select" ON public.survey_template_questions
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR workspace_id IN (SELECT public.current_user_workspaces())
  );
CREATE POLICY "stq_insert" ON public.survey_template_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (workspace_id IS NULL OR workspace_id IN (SELECT public.current_user_workspaces()))
  );
CREATE POLICY "stq_update" ON public.survey_template_questions
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "stq_delete" ON public.survey_template_questions
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE TRIGGER survey_template_questions_touch
  BEFORE UPDATE ON public.survey_template_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Respostas de pesquisa vinculadas a uma atividade
CREATE TABLE IF NOT EXISTS public.activity_survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  workspace_id uuid,
  source text NOT NULL,
  source_id uuid NOT NULL,
  source_name text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  max_score integer,
  responded_by uuid,
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_survey_responses_source_chk
    CHECK (source IN ('survey_template', 'prospecting_questionnaire')),
  CONSTRAINT activity_survey_responses_activity_uniq UNIQUE (activity_id)
);
CREATE INDEX IF NOT EXISTS activity_survey_responses_ws_idx
  ON public.activity_survey_responses(workspace_id, responded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_survey_responses TO authenticated;
GRANT ALL ON public.activity_survey_responses TO service_role;
ALTER TABLE public.activity_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asr_select" ON public.activity_survey_responses
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR workspace_id IN (SELECT public.current_user_workspaces())
  );
CREATE POLICY "asr_insert" ON public.activity_survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (workspace_id IS NULL OR workspace_id IN (SELECT public.current_user_workspaces()))
  );
CREATE POLICY "asr_update" ON public.activity_survey_responses
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "asr_delete" ON public.activity_survey_responses
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE TRIGGER activity_survey_responses_touch
  BEFORE UPDATE ON public.activity_survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Backfill: pergunta única dos modelos existentes
INSERT INTO public.survey_template_questions
  (survey_template_id, owner_id, workspace_id, position, label, type, required)
SELECT t.id, t.owner_id, t.workspace_id, 0, t.question,
       CASE WHEN t.kind = 'nps' THEN 'nps' ELSE 'rating' END,
       true
FROM public.survey_templates t
WHERE t.question IS NOT NULL
  AND btrim(t.question) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.survey_template_questions q WHERE q.survey_template_id = t.id
  );
