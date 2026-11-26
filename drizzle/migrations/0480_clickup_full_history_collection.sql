-- Jornada única: fontes explícitas por workspace e checkpoint durável. Não concede chaves.
-- A fronteira única de manage também bloqueia Ver Como antes de qualquer GET/efeito externo.
CREATE OR REPLACE FUNCTION public.clickup_import_access(p_ws uuid, p_user uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c jsonb;
BEGIN
  IF p_ws IS NULL OR p_user IS NULL OR p_action NOT IN ('view','manage') THEN RETURN false; END IF;
  IF p_action='manage' AND public.is_read_only_view() THEN RETURN false; END IF;
  c := work_subject_context(p_ws, p_user);
  IF c IS NULL OR c->>'actor' IS NULL THEN RETURN false; END IF;
  IF p_action = 'view' THEN
    RETURN COALESCE(c->'keys' ? 'techprojects.clickup_import.view.workspace'
                 OR c->'keys' ? 'techprojects.clickup_import.manage.workspace', false);
  END IF;
  RETURN COALESCE(c->'keys' ? 'techprojects.clickup_import.manage.workspace', false);
END $$;

-- Per-workspace credentials. The legacy secret is not copied to rows or exposed to another tenant.
CREATE TABLE public.clickup_import_connections(
 workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 key_ciphertext text,key_last4 text,legacy_key boolean NOT NULL DEFAULT false,
 updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(key_ciphertext IS NOT NULL OR legacy_key)
);
ALTER TABLE public.clickup_import_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clickup_import_connections FROM anon,authenticated;
GRANT SELECT(workspace_id,key_last4,legacy_key,updated_at) ON public.clickup_import_connections TO authenticated;
GRANT ALL ON public.clickup_import_connections TO service_role;
CREATE POLICY clickup_connections_read ON public.clickup_import_connections FOR SELECT TO authenticated
 USING((workspace_id,'clickup'::text) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
-- Transitional capability only for tenants with a previously applied import and its actual task link.
-- New tenants cannot create or edit this service-only marker by staging a group or selecting a team.
INSERT INTO public.clickup_import_connections(workspace_id,legacy_key,updated_by)
 SELECT DISTINCT ON(r.workspace_id) r.workspace_id,true,r.requested_by
 FROM public.clickup_import_runs r
 WHERE r.applied_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.clickup_import_links l
   WHERE l.workspace_id=r.workspace_id AND l.created_run_id=r.id AND l.entity_type='task')
 ORDER BY r.workspace_id,r.applied_at DESC
 ON CONFLICT(workspace_id) DO NOTHING;

CREATE TABLE public.clickup_import_source_bindings (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL CHECK (team_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  team_name text NOT NULL,
  configured_by uuid NOT NULL,
  configured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, team_id)
);
ALTER TABLE public.clickup_import_source_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clickup_import_source_bindings FROM PUBLIC,anon,authenticated;
CREATE POLICY clickup_sources_read ON public.clickup_import_source_bindings FOR SELECT TO authenticated
  USING((workspace_id,'clickup'::text) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
GRANT SELECT ON public.clickup_import_source_bindings TO authenticated;
GRANT ALL ON public.clickup_import_source_bindings TO service_role;

ALTER TABLE public.clickup_import_runs
  ADD COLUMN source_team_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN collect_cursor jsonb,
  ADD COLUMN collect_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN collect_error text,
  ADD COLUMN collect_coverage jsonb NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.clickup_import_sources_set(p_ws uuid,p_sources jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE x jsonb;
BEGIN
  PERFORM public.clickup_import_require(p_ws,'manage');
  IF (public.work_access_context()->>'workspace') IS DISTINCT FROM p_ws::text THEN RAISE EXCEPTION 'Workspace ativo obrigatório.' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_sources) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sources) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Escolha pelo menos uma organização autorizada.';
  END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(p_sources) LOOP
    IF coalesce(x->>'id','') !~ '^[A-Za-z0-9_-]{1,40}$' OR nullif(btrim(x->>'name'),'') IS NULL THEN
      RAISE EXCEPTION 'Organização inválida.';
    END IF;
  END LOOP;
  DELETE FROM public.clickup_import_source_bindings WHERE workspace_id=p_ws
    AND NOT team_id IN (SELECT value->>'id' FROM jsonb_array_elements(p_sources));
  INSERT INTO public.clickup_import_source_bindings(workspace_id,team_id,team_name,configured_by)
    SELECT p_ws,value->>'id',left(value->>'name',500),auth.uid() FROM jsonb_array_elements(p_sources)
    ON CONFLICT(workspace_id,team_id) DO UPDATE SET team_name=excluded.team_name,
      configured_by=excluded.configured_by,configured_at=now();
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_sources_set(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clickup_import_sources_set(uuid,jsonb) TO authenticated;

-- Somente o servidor escreve checkpoint após GETs. A sessão do ator é revalidada no banco.
CREATE OR REPLACE FUNCTION public.clickup_import_checkpoint(
  p_actor uuid,p_run uuid,p_expected integer,p_cursor jsonb,p_error text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r public.clickup_import_runs; ids text[]; revision integer;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Ator obrigatório.' USING ERRCODE='42501'; END IF;
  PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_actor,'role','authenticated')::text,true);
  SELECT * INTO r FROM public.clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM public.clickup_import_require(r.workspace_id,'manage');
  IF r.status<>'collecting' THEN RAISE EXCEPTION 'A coleta não está em andamento.'; END IF;
  IF r.collect_revision<>p_expected THEN RAISE EXCEPTION 'A leitura avançou em outra janela. Retome pela versão atual.' USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' OR p_cursor->>'version'<>'2' THEN
    RAISE EXCEPTION 'Checkpoint inválido.';
  END IF;
  SELECT array_agg(value->>'id' ORDER BY value->>'id') INTO ids
    FROM jsonb_array_elements(p_cursor->'teams');
  IF coalesce(cardinality(ids),0)=0 OR EXISTS (
    SELECT 1 FROM unnest(ids) i WHERE NOT EXISTS (
      SELECT 1 FROM public.clickup_import_source_bindings b WHERE b.workspace_id=r.workspace_id AND b.team_id=i
    )
  ) THEN RAISE EXCEPTION 'As origens desta importação não estão autorizadas para o workspace.' USING ERRCODE='42501'; END IF;
  IF cardinality(r.source_team_ids)>0 AND r.source_team_ids<>ids THEN
    RAISE EXCEPTION 'O escopo da execução não pode ser alterado.' USING ERRCODE='42501';
  END IF;
  UPDATE public.clickup_import_runs SET source_team_ids=ids,collect_cursor=p_cursor,
    collect_revision=collect_revision+1,collect_error=left(p_error,500),updated_at=now(),
    collect_coverage=jsonb_build_object('complete',p_cursor->>'phase'='done' AND jsonb_array_length(coalesce(p_cursor->'gaps','[]'))=0,
      'gaps',coalesce(p_cursor->'gaps','[]'),'capabilities',coalesce(p_cursor->'capabilities','{}'))
    WHERE id=p_run RETURNING collect_revision INTO revision;
  RETURN revision;
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_checkpoint(uuid,uuid,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_checkpoint(uuid,uuid,integer,jsonb,text) TO service_role;

CREATE TABLE public.clickup_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.clickup_import_runs(id),
  team_id text NOT NULL,
  attachment_id text NOT NULL,
  file_key text NOT NULL CHECK(file_key ~ '^[a-f0-9]{64}$'),
  title text NOT NULL,
  sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text,
  bytes bigint CHECK(bytes>=0),
  content_type text,
  status text NOT NULL CHECK(status IN ('preserved','pending')),
  issue text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,team_id,file_key)
);
CREATE INDEX clickup_source_files_record ON public.clickup_source_files(workspace_id,team_id,attachment_id,created_at DESC);
CREATE INDEX clickup_source_files_path ON public.clickup_source_files(storage_path) WHERE storage_path IS NOT NULL;
ALTER TABLE public.clickup_source_files ADD CONSTRAINT clickup_source_files_content CHECK(status<>'preserved' OR (storage_path IS NOT NULL AND sha256 IS NOT NULL AND bytes IS NOT NULL AND content_type IS NOT NULL));
CREATE OR REPLACE FUNCTION public.clickup_import_file_authorize(p_workspace uuid,p_source text,p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Somente o serviço de importação.' USING ERRCODE='42501'; END IF;
  PERFORM public.project_import_run_actor(p_workspace,'clickup',p_source,p_run);
  IF NOT EXISTS(SELECT 1 FROM public.clickup_import_source_bindings b WHERE b.workspace_id=p_workspace AND b.team_id=p_source)
    OR NOT EXISTS(SELECT 1 FROM public.clickup_import_runs r WHERE r.id=p_run AND r.workspace_id=p_workspace AND p_source=ANY(r.source_team_ids)) THEN
    RAISE EXCEPTION 'Arquivo fora das origens autorizadas.' USING ERRCODE='42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_file_authorize(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_file_authorize(uuid,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.clickup_source_file_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.clickup_import_file_authorize(NEW.workspace_id,NEW.team_id,NEW.run_id);
  IF NEW.storage_path IS NOT NULL AND NEW.storage_path IS DISTINCT FROM NEW.workspace_id::text||'/'||NEW.team_id||'/'||NEW.sha256 THEN
    RAISE EXCEPTION 'Caminho de armazenamento fora da origem.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.clickup_source_file_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_source_file_guard() TO service_role;
CREATE TRIGGER clickup_source_file_guard BEFORE INSERT OR UPDATE ON public.clickup_source_files FOR EACH ROW EXECUTE FUNCTION public.clickup_source_file_guard();
ALTER TABLE public.clickup_source_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clickup_source_files FROM PUBLIC,anon,authenticated;
CREATE POLICY clickup_source_files_read ON public.clickup_source_files FOR SELECT TO authenticated
  USING((workspace_id,'clickup'::text) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
GRANT SELECT ON public.clickup_source_files TO authenticated;
GRANT ALL ON public.clickup_source_files TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('clickup-source-files','clickup-source-files',false,67108864)
  ON CONFLICT(id) DO NOTHING;
CREATE POLICY clickup_source_files_download ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='clickup-source-files' AND EXISTS (
    SELECT 1 FROM public.clickup_source_files f WHERE f.storage_path=name
      AND public.project_import_access(f.workspace_id,'clickup','view')
  ));

-- Finalizar processamento não transforma lacunas de cobertura em sucesso integral.
CREATE OR REPLACE FUNCTION public.clickup_import_finish_collect(p_run uuid, p_counts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs;
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status IN ('planned','applying','applied') THEN RETURN jsonb_build_object('status',r.status); END IF;
  IF r.status <> 'collecting' THEN RAISE EXCEPTION 'A leitura desta importação já terminou.'; END IF;
  IF r.collect_cursor->>'phase' IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'A coleta está incompleta. Retome a leitura antes de finalizar.';
  END IF;

  WITH m AS (
    SELECT wm.user_id, lower(u.email) em FROM workspace_members wm JOIN auth.users u ON u.id=wm.user_id
     WHERE wm.workspace_id=r.workspace_id
  )
  UPDATE clickup_import_people cp SET user_id=m.user_id, status='confirmed', match_reason='email', updated_at=now()
    FROM m WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status<>'confirmed'
     AND cp.email IS NOT NULL AND cp.email=m.em;

  WITH pe AS (
    SELECT lower(pp.email) em, min(pp.profile_id::text)::uuid uid, count(DISTINCT pp.profile_id) n
      FROM people pp JOIN workspace_members wm ON wm.workspace_id=pp.workspace_id AND wm.user_id=pp.profile_id
     WHERE pp.workspace_id=r.workspace_id AND pp.email IS NOT NULL AND pp.profile_id IS NOT NULL
     GROUP BY lower(pp.email)
  )
  UPDATE clickup_import_people cp SET user_id=pe.uid, status='confirmed', match_reason='techpeople_email', updated_at=now()
    FROM pe WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status<>'confirmed'
     AND pe.n=1 AND cp.email=pe.em;

  WITH lp AS (
    SELECT split_part(lower(u.email),'@',1) lp, min(wm.user_id::text)::uuid uid, count(*) n
      FROM workspace_members wm JOIN auth.users u ON u.id=wm.user_id
     WHERE wm.workspace_id=r.workspace_id GROUP BY 1
  )
  UPDATE clickup_import_people cp SET user_id=lp.uid, status='suggested', match_reason='local_part', updated_at=now()
    FROM lp WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status='unmatched'
     AND cp.email IS NOT NULL AND lp.n=1 AND split_part(cp.email,'@',1)=lp.lp;

  UPDATE clickup_import_runs SET status='planned', counts=coalesce(p_counts,'{}'::jsonb), updated_at=now() WHERE id=p_run;
  RETURN jsonb_build_object('status','planned');
END $$;
