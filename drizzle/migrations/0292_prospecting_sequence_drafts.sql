-- New multichannel drafts never enroll or dispatch. Legacy sequences are untouched.
CREATE TABLE public.prospecting_sequence_drafts(
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 revision integer NOT NULL CHECK(revision>0),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object' AND octet_length(definition::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES auth.users(id),
 UNIQUE(id,workspace_id)
);
CREATE INDEX prospecting_sequence_drafts_workspace ON public.prospecting_sequence_drafts(workspace_id,updated_at DESC,id);
CREATE TABLE public.prospecting_sequence_draft_revisions(
 draft_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 revision integer NOT NULL,
 name text NOT NULL,
 definition jsonb NOT NULL,
 author_id uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(draft_id,revision),
 FOREIGN KEY(draft_id,workspace_id) REFERENCES public.prospecting_sequence_drafts(id,workspace_id)
);
ALTER TABLE public.prospecting_sequence_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sequence_draft_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_drafts,public.prospecting_sequence_draft_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.prospecting_sequence_drafts,public.prospecting_sequence_draft_revisions TO authenticated;
GRANT ALL ON public.prospecting_sequence_drafts,public.prospecting_sequence_draft_revisions TO service_role;
CREATE POLICY prospecting_drafts_read ON public.prospecting_sequence_drafts FOR SELECT TO authenticated
 USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'system.automation.sequences','view',ARRAY[owner_id]));
CREATE POLICY prospecting_draft_revisions_read ON public.prospecting_sequence_draft_revisions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_drafts d WHERE d.id=draft_id AND d.workspace_id=prospecting_sequence_draft_revisions.workspace_id));
CREATE FUNCTION public.prospecting_sequence_draft_list(p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.sales_access_context(); out jsonb; BEGIN
 IF c->>'actor' IS NULL OR c->>'workspace' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC,x.id),'[]'::jsonb) INTO out FROM(
 SELECT d.id,d.workspace_id,d.owner_id,d.name,d.revision,d.definition,d.updated_at,
 public.sales_context_access(c,d.workspace_id,'system.automation.sequences','update',ARRAY[d.owner_id]) AS can_edit
 FROM public.prospecting_sequence_drafts d WHERE d.workspace_id=p_workspace
 AND public.sales_context_access(c,d.workspace_id,'system.automation.sequences','view',ARRAY[d.owner_id])
 ORDER BY d.updated_at DESC,d.id LIMIT 100) x;
 RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_draft_list(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_draft_list(uuid) TO authenticated;
CREATE FUNCTION public.prospecting_sequence_draft_save(p_id uuid,p_workspace uuid,p_expected_revision integer,p_name text,p_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.sales_access_context(); actor uuid:=nullif(c->>'actor','')::uuid; d public.prospecting_sequence_drafts; exists_row boolean; act text; x jsonb; g jsonb; f jsonb; col text;
BEGIN
 IF actor IS NULL OR c->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((c->>'read_only')::boolean,true) THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 OR p_definition IS NULL OR jsonb_typeof(p_definition)<>'object' OR octet_length(p_definition::text)>65536 THEN RAISE EXCEPTION 'Rascunho inválido.' USING ERRCODE='22023';END IF;
 IF p_definition->>'schemaVersion' IS DISTINCT FROM '1' OR p_definition#>>'{audience,base}' IS NULL OR p_definition#>>'{audience,base}' NOT IN('leads','contacts') OR jsonb_typeof(p_definition#>'{audience,groups}') IS DISTINCT FROM 'array' OR jsonb_typeof(p_definition->'steps') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Definição inválida.' USING ERRCODE='22023';END IF;
 IF jsonb_array_length(p_definition->'steps') NOT BETWEEN 1 AND 50 OR jsonb_array_length(p_definition#>'{audience,groups}')>10 THEN RAISE EXCEPTION 'Limite de etapas ou grupos excedido.' USING ERRCODE='22023';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_definition->'steps') LOOP
  IF x->>'type' IS NULL OR x->>'type' NOT IN('email','whatsapp','wait','call','condition','task','agent','end') OR nullif(x->>'id','') IS NULL OR length(coalesce(x->>'title','')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Etapa inválida.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR g IN SELECT value FROM jsonb_array_elements(p_definition#>'{audience,groups}') LOOP
  IF jsonb_typeof(g->'filters') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'filters')>20 THEN RAISE EXCEPTION 'Grupo inválido.' USING ERRCODE='22023';END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(g->'filters') LOOP
   col:=coalesce(f->>'column','');
   IF f->>'entity' IS NULL OR f->>'entity' NOT IN('leads','contacts','companies','deals') OR col='' OR col~*'(token|secret|password|hash)' OR col~'^(id|owner_id|workspace_id|deleted_at|portal_token|hs_raw|external_ids|custom_fields|import_batch_id|sync_state_id)$' OR col~'(_digits$|^(hs_|hubspot_))' THEN RAISE EXCEPTION 'Campo não permitido.' USING ERRCODE='22023'; END IF;
  END LOOP;
 END LOOP;
 -- Serialize same-id create/retry and updates without trusting a caller-supplied owner.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,292));
 SELECT * INTO d FROM public.prospecting_sequence_drafts WHERE id=p_id FOR UPDATE;exists_row:=FOUND;
 IF exists_row AND d.workspace_id<>p_workspace THEN RAISE EXCEPTION 'Rascunho indisponível.' USING ERRCODE='42501'; END IF;
 act:=CASE WHEN exists_row THEN 'update' ELSE 'create' END;
 IF NOT public.sales_context_access(c,p_workspace,'system.automation.sequences','view',ARRAY[CASE WHEN exists_row THEN d.owner_id ELSE actor END]) OR NOT public.sales_context_access(c,p_workspace,'system.automation.sequences',act,ARRAY[CASE WHEN exists_row THEN d.owner_id ELSE actor END]) THEN RAISE EXCEPTION 'Sem permissão para salvar rascunhos.' USING ERRCODE='42501';END IF;
 IF exists_row THEN
  IF d.revision<>p_expected_revision THEN RAISE EXCEPTION 'Rascunho alterado em outra sessão. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  UPDATE public.prospecting_sequence_drafts SET name=btrim(p_name),definition=p_definition,revision=revision+1,updated_at=now(),updated_by=actor WHERE id=p_id RETURNING * INTO d;
 ELSE
  IF p_expected_revision<>0 THEN RAISE EXCEPTION 'Rascunho indisponível.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.prospecting_sequence_drafts(id,workspace_id,owner_id,name,revision,definition,updated_by) VALUES(p_id,p_workspace,actor,btrim(p_name),1,p_definition,actor) RETURNING * INTO d;
 END IF;
 INSERT INTO public.prospecting_sequence_draft_revisions(draft_id,workspace_id,revision,name,definition,author_id) VALUES(d.id,d.workspace_id,d.revision,d.name,d.definition,actor);
 RETURN to_jsonb(d)||jsonb_build_object('can_edit',public.sales_context_access(c,d.workspace_id,'system.automation.sequences','update',ARRAY[d.owner_id]));
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_draft_save(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_draft_save(uuid,uuid,integer,text,jsonb) TO authenticated;
