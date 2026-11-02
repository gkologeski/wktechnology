-- Immutable configuration snapshots only. No enrollment, scheduling or dispatch.
CREATE TABLE public.prospecting_sequence_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 draft_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 draft_revision integer NOT NULL CHECK(draft_revision>0),
 name text NOT NULL,
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object' AND octet_length(definition::text)<=65536),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(draft_id,draft_revision),
 FOREIGN KEY(draft_id,workspace_id) REFERENCES public.prospecting_sequence_drafts(id,workspace_id),
 FOREIGN KEY(draft_id,draft_revision) REFERENCES public.prospecting_sequence_draft_revisions(draft_id,revision)
);
CREATE INDEX prospecting_sequence_versions_workspace ON public.prospecting_sequence_versions(workspace_id,draft_id,created_at DESC);
ALTER TABLE public.prospecting_sequence_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.prospecting_sequence_versions TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.prospecting_sequence_versions TO service_role;
CREATE POLICY prospecting_sequence_versions_read ON public.prospecting_sequence_versions FOR SELECT TO authenticated
 USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'system.automation.sequences','view',ARRAY[owner_id]));
CREATE FUNCTION public.prospecting_sequence_version_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Versões de configuração são imutáveis.' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_version_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER prospecting_sequence_versions_immutable BEFORE UPDATE ON public.prospecting_sequence_versions FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_version_immutable();
CREATE FUNCTION public.prospecting_sequence_version_create(p_id uuid,p_workspace uuid,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.sales_access_context(); actor uuid:=nullif(c->>'actor','')::uuid; d public.prospecting_sequence_drafts; v public.prospecting_sequence_versions;
BEGIN
 IF actor IS NULL OR c->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((c->>'read_only')::boolean,true) THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.prospecting_sequence_drafts WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND OR NOT public.sales_context_access(c,p_workspace,'system.automation.sequences','view',ARRAY[d.owner_id]) OR NOT public.sales_context_access(c,p_workspace,'system.automation.sequences','manage',ARRAY[d.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para criar uma versão deste rascunho.' USING ERRCODE='42501'; END IF;
 IF p_expected_revision IS NULL OR d.revision<>p_expected_revision THEN RAISE EXCEPTION 'Rascunho alterado. Recarregue antes de criar uma versão.' USING ERRCODE='40001'; END IF;
 -- No caller-supplied definition, owner, readiness flag or version number.
 INSERT INTO public.prospecting_sequence_versions(draft_id,workspace_id,owner_id,draft_revision,name,definition,created_by)
 VALUES(d.id,d.workspace_id,d.owner_id,d.revision,d.name,d.definition,actor)
 ON CONFLICT(draft_id,draft_revision) DO NOTHING;
 SELECT * INTO STRICT v FROM public.prospecting_sequence_versions WHERE draft_id=d.id AND draft_revision=d.revision;
 RETURN jsonb_build_object('id',v.id,'draft_id',v.draft_id,'draft_revision',v.draft_revision,'name',v.name,'created_at',v.created_at);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_version_create(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_version_create(uuid,uuid,integer) TO authenticated;
