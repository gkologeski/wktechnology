-- Resolve operational reconciliation visibility once per statement. Keep the
-- dashboard SECURITY INVOKER and its original RLS; do not cache authorization
-- in a caller-controlled GUC or evaluate effective permissions for every issue.
CREATE OR REPLACE FUNCTION public.work_reconciliation_reference_workspace()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_time_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;
BEGIN
 IF w IS NULL OR u IS NULL THEN RETURN NULL;END IF;
 IF coalesce(c->'time_grants'?'view.workspace',false)
    OR (is_active_workspace_admin(w,u) AND coalesce(c->'keys'?'techprojects.reconciliation.view.workspace',false)) THEN RETURN w;END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.work_reconciliation_reference_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.work_reconciliation_reference_workspace() TO authenticated;
DROP POLICY project_recon_issues_read ON public.project_reconciliation_issues;
CREATE POLICY project_recon_issues_read ON public.project_reconciliation_issues FOR SELECT TO authenticated
USING(workspace_id=(SELECT public.work_reconciliation_reference_workspace()));
DROP POLICY project_recon_refreshes_read ON public.project_reconciliation_refreshes;
CREATE POLICY project_recon_refreshes_read ON public.project_reconciliation_refreshes FOR SELECT TO authenticated
USING(workspace_id=(SELECT public.work_reconciliation_reference_workspace()));
