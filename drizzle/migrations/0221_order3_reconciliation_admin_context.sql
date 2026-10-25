-- Preserve the administrative source gate introduced by 0219 while resolving
-- the active actor, selected workspace and explicit denies once per statement.
CREATE OR REPLACE FUNCTION public.work_reconciliation_admin_workspace()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;
BEGIN
 IF w IS NOT NULL AND u IS NOT NULL
    AND work_context_access(c,w,'techprojects.reconciliation','view','{}')
    AND is_active_workspace_admin(w,u) THEN RETURN w;END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.work_reconciliation_admin_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.work_reconciliation_admin_workspace() TO authenticated;
DROP POLICY work_recon_view ON public.project_reconciliation_issues;
CREATE POLICY work_recon_view ON public.project_reconciliation_issues AS RESTRICTIVE FOR SELECT TO authenticated
USING(workspace_id=(SELECT public.work_reconciliation_admin_workspace()));
DROP POLICY work_recon_view ON public.project_reconciliation_issue_events;
CREATE POLICY work_recon_view ON public.project_reconciliation_issue_events AS RESTRICTIVE FOR SELECT TO authenticated
USING(workspace_id=(SELECT public.work_reconciliation_admin_workspace()));
DROP POLICY work_recon_view ON public.project_reconciliation_refreshes;
CREATE POLICY work_recon_view ON public.project_reconciliation_refreshes AS RESTRICTIVE FOR SELECT TO authenticated
USING(workspace_id=(SELECT public.work_reconciliation_admin_workspace()));
