-- 0126 — Fecha o bypass multi-workspace do overload legado user_has_permission(_user,_perm)
-- e prende pacotes/atribuições de cargo ao workspace avaliado. Aditiva e idempotente.

CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user IS NULL OR _perm IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
        FROM public.profiles p
        JOIN public.workspace_members wm
          ON wm.workspace_id = p.active_workspace_id AND wm.user_id = _user AND wm.status = 'active'
       WHERE p.id = _user
         AND p.active_workspace_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.user_effective_permissions(_user, p.active_workspace_id) k WHERE k = _perm)
    )
  END;
$function$;

COMMENT ON FUNCTION public.user_has_permission(uuid, text) IS
  'DEPRECADO: use user_has_permission(_user,_workspace,_key). Avalia apenas o workspace ativo canonico (profiles.active_workspace_id + membership ativa); falha fechado sem workspace ativo.';
COMMENT ON FUNCTION public.techhire_rbac_gate(uuid, text) IS
  'DEPRECADO: use techhire_rbac_gate(_user,_owner,_key). Herda o fechamento do overload de 2 argumentos.';

DROP POLICY IF EXISTS "prospecting_questionnaires update workspace" ON public.prospecting_questionnaires;
CREATE POLICY "prospecting_questionnaires update workspace" ON public.prospecting_questionnaires
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_template = false AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.update.workspace'))))
  WITH CHECK (is_template = false AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.update.workspace'))));

DROP POLICY IF EXISTS "prospecting_questionnaires delete workspace" ON public.prospecting_questionnaires;
CREATE POLICY "prospecting_questionnaires delete workspace" ON public.prospecting_questionnaires
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_template = false AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.delete.workspace'))));

DROP POLICY IF EXISTS "prospecting_questions update workspace" ON public.prospecting_questions;
CREATE POLICY "prospecting_questions update workspace" ON public.prospecting_questions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospecting_questionnaires q WHERE q.id = prospecting_questions.questionnaire_id AND q.is_template = false)
     AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.update.workspace'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospecting_questionnaires q WHERE q.id = prospecting_questions.questionnaire_id AND q.is_template = false)
     AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.update.workspace'))));

DROP POLICY IF EXISTS "prospecting_questions delete workspace" ON public.prospecting_questions;
CREATE POLICY "prospecting_questions delete workspace" ON public.prospecting_questions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospecting_questionnaires q WHERE q.id = prospecting_questions.questionnaire_id AND q.is_template = false)
     AND (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND shares_workspace_with(owner_id)
     AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.prospecting.questionnaires.delete.workspace'))));

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), my_roles AS (
    SELECT ujr.role_id
      FROM public.user_job_roles ujr
      LEFT JOIN public.job_roles jr ON jr.id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.workspace_id = _workspace_id OR ujr.owner_id = _workspace_id)
       AND (jr.id IS NULL OR jr.workspace_id IS NULL OR jr.workspace_id = _workspace_id)
  ), my_sets AS (
    SELECT ps.id AS set_id
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.workspace_id = _workspace_id OR ups.owner_id = _workspace_id)
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      JOIN public.permission_sets ps ON ps.id = jrs.set_id
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
  ), base_permissions AS (
    SELECT p.key FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key FROM my_sets s JOIN public.permission_set_items psi ON psi.set_id = s.set_id
  ), role_grants AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;