-- Consolidação das políticas de ats_candidates: remove o conjunto legado ws_*
-- (que concedia gravação via can_write_owner e criação sem checagem de permissão)
-- e mantém um único conjunto permissivo canônico por operação, preservando as
-- políticas RESTRICTIVE existentes (perm_* / rbac_*) como travas.

DROP POLICY IF EXISTS ats_candidates_ws_select ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_ws_insert ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_ws_update ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_ws_delete ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_perm_insert ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_rbac_insert ON public.ats_candidates;

DROP POLICY IF EXISTS ats_candidates_select ON public.ats_candidates;
CREATE POLICY ats_candidates_select
ON public.ats_candidates
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR is_workspace_admin_of(owner_id, auth.uid())
  OR user_has_permission(
       auth.uid(),
       resolve_workspace_id(owner_id),
       'techhire.candidates.view.workspace'
     )
  OR EXISTS (
       SELECT 1
       FROM public.ats_applications a
       WHERE a.candidate_id = ats_candidates.id
         AND can_access_ats_job(a.job_id)
     )
);

DROP POLICY IF EXISTS ats_candidates_insert ON public.ats_candidates;
CREATE POLICY ats_candidates_insert
ON public.ats_candidates
FOR INSERT
TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (
    owner_id = auth.uid()
    AND (
      user_has_permission(
        auth.uid(),
        resolve_workspace_id(owner_id),
        'techhire.candidates.create.own'
      )
      OR techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.create.own')
    )
  )
);

DROP POLICY IF EXISTS ats_candidates_update ON public.ats_candidates;
CREATE POLICY ats_candidates_update
ON public.ats_candidates
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR is_workspace_admin_of(owner_id, auth.uid())
  OR user_has_permission(
       auth.uid(),
       resolve_workspace_id(owner_id),
       'techhire.candidates.update.workspace'
     )
)
WITH CHECK (
  owner_id = auth.uid()
  OR is_workspace_admin_of(owner_id, auth.uid())
  OR user_has_permission(
       auth.uid(),
       resolve_workspace_id(owner_id),
       'techhire.candidates.update.workspace'
     )
);

DROP POLICY IF EXISTS ats_candidates_delete ON public.ats_candidates;
CREATE POLICY ats_candidates_delete
ON public.ats_candidates
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR is_workspace_admin_of(owner_id, auth.uid())
  OR user_has_permission(
       auth.uid(),
       resolve_workspace_id(owner_id),
       'techhire.candidates.delete.workspace'
     )
);