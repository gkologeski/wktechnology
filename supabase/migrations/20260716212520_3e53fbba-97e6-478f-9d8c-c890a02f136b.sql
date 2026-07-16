DROP POLICY IF EXISTS "audit read owner/admin" ON public.access_audit_log;
CREATE POLICY "audit read owner/admin" ON public.access_audit_log
FOR SELECT USING (
  (workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = access_audit_log.workspace_id AND w.created_by = auth.uid()
  ))
  OR (workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = access_audit_log.workspace_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['owner','admin'])
  ))
  OR EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
  )
);