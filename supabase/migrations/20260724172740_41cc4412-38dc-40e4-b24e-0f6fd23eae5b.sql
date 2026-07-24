
ALTER TABLE public.prospecting_questionnaires
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- Marcar os seeds atuais como modelos (nomes exatos, framework != custom)
UPDATE public.prospecting_questionnaires
SET is_template = true, enabled = false
WHERE framework IN ('bant','meddic','champ','gpct')
  AND name IN ('BANT','MEDDIC','CHAMP','GPCT');

-- Recriar policies para questionários bloqueando write/delete em templates
DROP POLICY IF EXISTS "prospecting_questionnaires owner all" ON public.prospecting_questionnaires;

CREATE POLICY "prospecting_questionnaires select own"
  ON public.prospecting_questionnaires
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "prospecting_questionnaires insert own"
  ON public.prospecting_questionnaires
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_template = false);

CREATE POLICY "prospecting_questionnaires update own non-template"
  ON public.prospecting_questionnaires
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND is_template = false)
  WITH CHECK (owner_id = auth.uid() AND is_template = false);

CREATE POLICY "prospecting_questionnaires delete own non-template"
  ON public.prospecting_questionnaires
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND is_template = false);

-- Perguntas: bloquear write/delete quando o questionário pai é modelo
DROP POLICY IF EXISTS "prospecting_questions owner all" ON public.prospecting_questions;

CREATE POLICY "prospecting_questions select own"
  ON public.prospecting_questions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "prospecting_questions insert own"
  ON public.prospecting_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prospecting_questionnaires q
      WHERE q.id = questionnaire_id
        AND q.owner_id = auth.uid()
        AND q.is_template = false
    )
  );

CREATE POLICY "prospecting_questions update own non-template"
  ON public.prospecting_questions
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prospecting_questionnaires q
      WHERE q.id = questionnaire_id AND q.is_template = false
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prospecting_questionnaires q
      WHERE q.id = questionnaire_id AND q.is_template = false
    )
  );

CREATE POLICY "prospecting_questions delete own non-template"
  ON public.prospecting_questions
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prospecting_questionnaires q
      WHERE q.id = questionnaire_id AND q.is_template = false
    )
  );
