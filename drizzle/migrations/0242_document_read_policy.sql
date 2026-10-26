-- Preserve canonical HR authorization while avoiding its repetition per document
-- when both person and document workspace-wide read have already been verified.
CREATE OR REPLACE FUNCTION public.shared_document_workspace_read()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;BEGIN
 IF c->>'actor' IS NOT NULL AND c->'keys'?'techpeople.people.view.workspace'
 AND c->'keys'?'techpeople.documents.view.workspace'
 AND public.hr_scope_permission(w,'techpeople.people','view',false,false)
 AND public.hr_scope_permission(w,'techpeople.documents','view',false,false) THEN RETURN w;END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.shared_document_workspace_read() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_document_workspace_read() TO authenticated;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='people_documents' AND policyname='hr_child_view' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual LIKE 'hr_person_resource_access(%') THEN RAISE EXCEPTION 'Unexpected document read policy';END IF;
END$$;
DROP POLICY hr_child_view ON public.people_documents;
CREATE POLICY hr_child_view ON public.people_documents FOR SELECT TO authenticated USING(
 CASE WHEN workspace_id=(SELECT public.shared_document_workspace_read()) THEN
 person_id IN(SELECT p.id FROM public.people p WHERE p.workspace_id=(SELECT public.shared_document_workspace_read()))
 ELSE public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','view',created_by,assigned_to) END
);
-- Parent SELECT still passes through the canonical People RLS. Own/team/mixed
-- cases retain the original predicate, and no write policies or grants change.
