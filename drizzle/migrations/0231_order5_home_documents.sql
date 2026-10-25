-- A finite aggregate for the Home KPI. The ordinary document RLS is unchanged.
-- Canonical workspace-wide people AND document read permissions imply the same
-- per-row decision once the actual parent exists in the selected workspace.
-- Own/team/mixed scopes keep the canonical record predicate, without role bypass.
CREATE OR REPLACE FUNCTION public.shared_home_expiring_documents()
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_area_authorize('system.home','view');w uuid:=(c->>'workspace')::uuid;BEGIN
 IF NOT(c->'keys'?|ARRAY['techpeople.people.view.own','techpeople.people.view.team','techpeople.people.view.workspace']) OR NOT(c->'keys'?|ARRAY['techpeople.documents.view.own','techpeople.documents.view.team','techpeople.documents.view.workspace']) THEN RETURN NULL;END IF;
 IF c->'keys'?'techpeople.people.view.workspace' AND c->'keys'?'techpeople.documents.view.workspace'
   AND public.hr_scope_permission(w,'techpeople.people','view',false,false)
   AND public.hr_scope_permission(w,'techpeople.documents','view',false,false) THEN
  RETURN (SELECT count(*) FROM public.people_documents d JOIN public.people p ON p.id=d.person_id AND p.workspace_id=d.workspace_id WHERE d.workspace_id=w AND d.status='expiring');
 END IF;
 RETURN (SELECT count(*) FROM public.people_documents d WHERE d.workspace_id=w AND d.status='expiring' AND public.hr_person_resource_access(d.workspace_id,d.person_id,'techpeople.documents','view',d.created_by,d.assigned_to));
END $$;
REVOKE ALL ON FUNCTION public.shared_home_expiring_documents() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_home_expiring_documents() TO authenticated;
CREATE INDEX IF NOT EXISTS idx_people_documents_workspace_status_person ON public.people_documents(workspace_id,status,person_id);
