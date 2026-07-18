-- Fix 1: access_audit_log — impedir injeção de logs em workspaces alheios
DROP POLICY IF EXISTS "audit insert self" ON public.access_audit_log;
CREATE POLICY "audit insert self"
ON public.access_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND workspace_id IS NOT NULL
  AND public.is_workspace_member(workspace_id, auth.uid())
);

-- Fix 2: custom_reports — remover SELECT permissivo amplo que anula o escopo admin/time
DROP POLICY IF EXISTS ws_select_custom_reports ON public.custom_reports;