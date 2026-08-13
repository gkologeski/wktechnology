-- Questionários: leitura compartilhada no workspace
DROP POLICY IF EXISTS "prospecting_questionnaires select own" ON public.prospecting_questionnaires;
CREATE POLICY "prospecting_questionnaires select workspace"
ON public.prospecting_questionnaires FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR is_template = true
  OR public.shares_workspace_with(owner_id)
);

DROP POLICY IF EXISTS "prospecting_questions select own" ON public.prospecting_questions;
CREATE POLICY "prospecting_questions select workspace"
ON public.prospecting_questions FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.shares_workspace_with(owner_id)
  OR EXISTS (
    SELECT 1 FROM public.prospecting_questionnaires q
     WHERE q.id = prospecting_questions.questionnaire_id
       AND q.is_template = true
  )
);

-- Escrita: dono, ou membro do workspace com permissão explícita
DROP POLICY IF EXISTS "prospecting_questionnaires update own non-template" ON public.prospecting_questionnaires;
CREATE POLICY "prospecting_questionnaires update workspace"
ON public.prospecting_questionnaires FOR UPDATE TO authenticated
USING (
  is_template = false
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.update.workspace')
    )
  )
)
WITH CHECK (
  is_template = false
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.update.workspace')
    )
  )
);

DROP POLICY IF EXISTS "prospecting_questionnaires delete own non-template" ON public.prospecting_questionnaires;
CREATE POLICY "prospecting_questionnaires delete workspace"
ON public.prospecting_questionnaires FOR DELETE TO authenticated
USING (
  is_template = false
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.delete.workspace')
    )
  )
);

DROP POLICY IF EXISTS "prospecting_questions update own non-template" ON public.prospecting_questions;
CREATE POLICY "prospecting_questions update workspace"
ON public.prospecting_questions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospecting_questionnaires q
     WHERE q.id = prospecting_questions.questionnaire_id
       AND q.is_template = false
  )
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.update.workspace')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prospecting_questionnaires q
     WHERE q.id = prospecting_questions.questionnaire_id
       AND q.is_template = false
  )
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.update.workspace')
    )
  )
);

DROP POLICY IF EXISTS "prospecting_questions delete own non-template" ON public.prospecting_questions;
CREATE POLICY "prospecting_questions delete workspace"
ON public.prospecting_questions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.prospecting_questionnaires q
     WHERE q.id = prospecting_questions.questionnaire_id
       AND q.is_template = false
  )
  AND (
    owner_id = auth.uid()
    OR (
      public.shares_workspace_with(owner_id)
      AND public.user_has_permission(auth.uid(), 'techsales.prospecting.questionnaires.delete.workspace')
    )
  )
);