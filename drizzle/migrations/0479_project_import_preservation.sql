-- Unified import journey. Additive: source evidence is separate from operational hours/tasks.
-- No business records, roles, grants to job roles or historical import rows are rewritten.
-- Keep every existing canonical type and allow the newly collected time-off requests.
-- Originals with malformed identifiers remain in the separate evidence ledger.
ALTER TABLE public.clockify_staging_records
 DROP CONSTRAINT IF EXISTS clockify_staging_records_entity_type_check,
 ADD CONSTRAINT clockify_staging_records_entity_type_check CHECK(entity_type IN(
  'workspace','user','group','client','project','task','tag','custom_field','approval_request',
  'time_entry','expense','invoice','holiday','time_off_policy','time_off_request'
 ));
CREATE OR REPLACE FUNCTION public.project_import_access(p_ws uuid,p_provider text,p_action text,p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb; prefix text;
BEGIN
 IF p_ws IS NULL OR p_user IS NULL OR p_provider NOT IN('clockify','jibble','clickup') OR p_action NOT IN('view','manage') THEN RETURN false;END IF;
 IF p_user=auth.uid() THEN
   c:=work_access_context();
   IF c->>'workspace' IS DISTINCT FROM p_ws::text THEN RETURN false;END IF;
 ELSIF auth.role()='service_role' THEN c:=work_subject_context(p_ws,p_user);
 ELSE RETURN false;END IF;
 IF c->>'actor' IS DISTINCT FROM p_user::text OR c->>'workspace' IS DISTINCT FROM p_ws::text THEN RETURN false;END IF;
 IF p_provider IN('clockify','jibble') AND NOT is_active_workspace_admin(p_ws,p_user) THEN RETURN false;END IF;
 IF p_action='manage' AND coalesce((c->>'read_only')::boolean,false) THEN RETURN false;END IF;
 prefix:='techprojects.'||p_provider||'_import.';
 IF p_provider='clickup' AND p_action='manage' THEN RETURN coalesce(c->'keys' ? (prefix||'manage.workspace'),false);END IF;
 IF p_provider='clickup' AND p_action='view' THEN RETURN coalesce(c->'keys' ? (prefix||'view.workspace') OR c->'keys' ? (prefix||'manage.workspace'),false);END IF;
 RETURN coalesce(c->'keys' ? (prefix||'view.workspace'),false) AND (p_action='view' OR coalesce(c->'keys' ? (prefix||'manage.workspace'),false));
END $$;
REVOKE ALL ON FUNCTION public.project_import_access(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_access(uuid,text,text,uuid) TO authenticated,service_role;

-- An uncorrelated set is hashed once by each RLS query, rather than resolving RBAC per imported row.
CREATE OR REPLACE FUNCTION public.project_import_visible_scopes()
RETURNS TABLE(workspace_id uuid,provider text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(work_access_context()->>'workspace')::uuid;p text;
BEGIN
 IF w IS NULL THEN RETURN;END IF;
 FOREACH p IN ARRAY ARRAY['clockify','jibble','clickup'] LOOP IF project_import_access(w,p,'view') THEN workspace_id:=w;provider:=p;RETURN NEXT;END IF;END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.project_import_visible_scopes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_visible_scopes() TO authenticated;

CREATE TABLE public.project_import_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN('clockify','jibble','clickup')),
 source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 200),
 entity_type text NOT NULL CHECK(entity_type ~ '^[a-z][a-z0-9_]{0,79}$'),
 external_id text NOT NULL CHECK(length(external_id) BETWEEN 1 AND 1024),
 payload jsonb NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 label text NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK(status IN('received','pending','ready')),
 issues text[] NOT NULL DEFAULT '{}',
 source_issues text[] NOT NULL DEFAULT '{}',
 source_person_id text,
 target_id uuid,
 review_assignee_id uuid,
 target_type text CHECK(target_type IN('person','project','member')),
 version_count integer NOT NULL DEFAULT 1 CHECK(version_count>0),
 current_version_number integer NOT NULL DEFAULT 1 CHECK(current_version_number>0 AND current_version_number<=version_count),
 current_from_legacy boolean NOT NULL DEFAULT false,
 source_observed_at timestamptz NOT NULL DEFAULT now(),
 last_run_id uuid NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,provider,source_id,entity_type,external_id)
);
CREATE INDEX project_import_records_page ON public.project_import_records(workspace_id,provider,last_seen_at DESC,id DESC);
CREATE INDEX project_import_records_pending ON public.project_import_records(workspace_id,provider,status,last_seen_at DESC,id DESC);
CREATE TABLE public.project_import_record_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),record_id uuid NOT NULL REFERENCES public.project_import_records(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN('clockify','jibble','clickup')),
 version_number integer NOT NULL,payload jsonb NOT NULL,payload_hash text NOT NULL,run_id uuid NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 source_observed_at timestamptz NOT NULL DEFAULT now(),from_legacy boolean NOT NULL DEFAULT false,
 UNIQUE(record_id,version_number)
);
CREATE INDEX project_import_versions_record ON public.project_import_record_versions(record_id,version_number DESC);
CREATE TABLE public.project_import_record_receipts(
 record_id uuid NOT NULL REFERENCES public.project_import_records(id) ON DELETE CASCADE,run_id uuid NOT NULL,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,provider text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(record_id,run_id)
);
CREATE INDEX project_import_receipts_run ON public.project_import_record_receipts(workspace_id,provider,run_id,record_id);
ALTER TABLE public.project_import_record_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_import_record_receipts FROM anon,authenticated;
GRANT SELECT ON public.project_import_record_receipts TO authenticated;
GRANT ALL ON public.project_import_record_receipts TO service_role;
CREATE POLICY project_import_receipts_read ON public.project_import_record_receipts FOR SELECT TO authenticated USING((workspace_id,provider) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
CREATE TABLE public.project_import_record_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),record_id uuid NOT NULL REFERENCES public.project_import_records(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN('clockify','jibble','clickup')),
 actor_id uuid NOT NULL,action text NOT NULL CHECK(action IN('review','link')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 8 AND 4000),target_id uuid,target_type text,assignee_id uuid,version_id uuid NOT NULL REFERENCES public.project_import_record_versions(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_import_events_record ON public.project_import_record_events(record_id,created_at DESC);
ALTER TABLE public.project_import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_import_record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_import_record_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_import_records,public.project_import_record_versions,public.project_import_record_events FROM anon,authenticated;
GRANT SELECT ON public.project_import_records,public.project_import_record_versions,public.project_import_record_events TO authenticated;
GRANT ALL ON public.project_import_records,public.project_import_record_versions,public.project_import_record_events TO service_role;
CREATE POLICY project_import_records_read ON public.project_import_records FOR SELECT TO authenticated USING((workspace_id,provider) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
CREATE POLICY project_import_versions_read ON public.project_import_record_versions FOR SELECT TO authenticated USING((workspace_id,provider) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
CREATE POLICY project_import_events_read ON public.project_import_record_events FOR SELECT TO authenticated USING((workspace_id,provider) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));

-- Derive the service actor from the native run, never from a caller-supplied user UUID.
CREATE OR REPLACE FUNCTION public.project_import_run_actor(p_ws uuid,p_provider text,p_source text,p_run uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid;r jsonb;
BEGIN
 IF p_provider='clockify' THEN SELECT to_jsonb(t) INTO r FROM clockify_import_runs t WHERE t.id=p_run AND t.workspace_id=p_ws AND t.source_workspace_id=p_source;
 ELSIF p_provider='jibble' THEN SELECT to_jsonb(t) INTO r FROM time_import_runs t WHERE t.id=p_run AND t.workspace_id=p_ws AND t.provider='jibble' AND t.source_org_id=p_source;
 ELSIF p_provider='clickup' THEN
   SELECT to_jsonb(t) INTO r FROM clickup_import_runs t WHERE t.id=p_run AND t.workspace_id=p_ws;
   IF NOT coalesce(r->'source_team_ids' ? p_source,false) AND NOT EXISTS(SELECT 1 FROM clickup_import_groups g WHERE g.run_id=p_run AND g.workspace_id=p_ws AND g.team_id=p_source) THEN r:=NULL;END IF;
 END IF;
 u:=coalesce(r->>'delegation_authorized_by',r->>'requested_by')::uuid;
 IF u IS NULL OR NOT project_import_access(p_ws,p_provider,'manage',CASE WHEN auth.role()='service_role' THEN u ELSE auth.uid() END) THEN RAISE EXCEPTION 'Execução indisponível ou sem permissão.' USING ERRCODE='42501';END IF;
 RETURN u;
END $$;
REVOKE ALL ON FUNCTION public.project_import_run_actor(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_run_actor(uuid,text,text,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.project_import_preserve_records(p_workspace uuid,p_provider text,p_source text,p_run uuid,p_records jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb;oldrow project_import_records;rid uuid;v integer;changed boolean;expanding boolean;counted integer:=0;newissues text[];intrinsic text[];newstatus text;labeltext text;
BEGIN
 PERFORM project_import_run_actor(p_workspace,p_provider,p_source,p_run);
 IF jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records)>500 THEN RAISE EXCEPTION 'Lote de preservação inválido.';END IF;
 -- One lock per source serializes concurrent pages without relying on a missing-row lock.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||p_provider||':'||p_source,479));
 FOR item IN SELECT value FROM jsonb_array_elements(p_records) LOOP
   IF project_import_sanitize(item->'payload') IS DISTINCT FROM item->'payload' THEN item:=jsonb_set(item,'{payload}',project_import_sanitize(item->'payload'));item:=jsonb_set(item,'{payload_hash}',to_jsonb(encode(sha256(convert_to((item->'payload')::text,'utf8')),'hex')));END IF;
   newissues:=ARRAY(SELECT DISTINCT unnest(ARRAY(SELECT value FROM jsonb_array_elements_text(coalesce(item->'issues','[]')))||project_import_source_issues(p_provider,item->>'entity',item->'payload')));
   intrinsic:=newissues;
   newstatus:=coalesce(item->>'status','received');
   SELECT * INTO oldrow FROM project_import_records WHERE workspace_id=p_workspace AND provider=p_provider AND source_id=p_source AND entity_type=item->>'entity' AND external_id=item->>'external_id' FOR UPDATE;
   changed:=oldrow.id IS NOT NULL AND oldrow.payload IS DISTINCT FROM coalesce(item->'payload','null'::jsonb);
   expanding:=changed AND p_provider='clickup' AND item->>'entity'='task' AND oldrow.last_run_id=p_run AND oldrow.status='received' AND oldrow.payload#>'{_source_observations,detail}' IS NULL;
   IF changed AND NOT expanding THEN newstatus:='pending';newissues:=array_append(newissues,'source_changed');intrinsic:=array_append(intrinsic,'source_changed');
   ELSIF oldrow.status='pending' AND newstatus='received' THEN newstatus:='pending';newissues:=oldrow.issues||newissues;END IF;
   IF cardinality(newissues)>0 THEN newstatus:='pending';END IF;
   labeltext:=left(coalesce(nullif(item->'payload'->>'name',''),nullif(item->'payload'->>'title',''),nullif(item->'payload'->>'description',''),item->>'external_id'),300);
   IF oldrow.id IS NULL THEN
     INSERT INTO project_import_records(workspace_id,provider,source_id,entity_type,external_id,payload,payload_hash,label,status,issues,source_issues,source_person_id,last_run_id)
     VALUES(p_workspace,p_provider,p_source,item->>'entity',item->>'external_id',coalesce(item->'payload','null'::jsonb),item->>'payload_hash',labeltext,newstatus,newissues,intrinsic,item->>'source_person_id',p_run) RETURNING id,version_count INTO rid,v;
   ELSE
     rid:=oldrow.id;v:=oldrow.version_count+CASE WHEN changed THEN 1 ELSE 0 END;
     UPDATE project_import_records SET payload=coalesce(item->'payload','null'::jsonb),payload_hash=item->>'payload_hash',label=labeltext,status=newstatus,issues=ARRAY(SELECT DISTINCT unnest(newissues)),source_issues=CASE WHEN NOT changed AND 'source_changed'=ANY(oldrow.source_issues) THEN ARRAY(SELECT DISTINCT unnest(intrinsic||ARRAY['source_changed'])) ELSE intrinsic END,source_person_id=coalesce(item->>'source_person_id',source_person_id),last_run_id=p_run,last_seen_at=now(),version_count=v,current_version_number=CASE WHEN changed THEN v ELSE current_version_number END,current_from_legacy=false,source_observed_at=now() WHERE id=rid;
   END IF;
   IF oldrow.id IS NULL OR changed THEN INSERT INTO project_import_record_versions(record_id,workspace_id,provider,version_number,payload,payload_hash,run_id) VALUES(rid,p_workspace,p_provider,v,coalesce(item->'payload','null'::jsonb),item->>'payload_hash',p_run);END IF;
   INSERT INTO project_import_record_receipts(record_id,run_id,workspace_id,provider) VALUES(rid,p_run,p_workspace,p_provider) ON CONFLICT DO NOTHING;
   counted:=counted+1;
 END LOOP;
 RETURN counted;
END $$;
REVOKE ALL ON FUNCTION public.project_import_preserve_records(uuid,text,text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_preserve_records(uuid,text,text,uuid,jsonb) TO authenticated,service_role;

-- Source status changes never overwrite the original or any previous version.
CREATE OR REPLACE FUNCTION public.project_import_sync_staging_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p text;s text;statusvalue text;issuevalues text[];
BEGIN
 p:=CASE WHEN TG_TABLE_NAME='clockify_staging_records' THEN 'clockify' ELSE to_jsonb(NEW)->>'provider' END;
 s:=CASE WHEN TG_TABLE_NAME='clockify_staging_records' THEN to_jsonb(NEW)->>'source_workspace_id' ELSE to_jsonb(NEW)->>'source_org_id' END;
 statusvalue:=CASE WHEN NEW.status IN('ready','imported') THEN 'ready' WHEN NEW.status IN('pending_review','unsupported','rejected','skipped') THEN 'pending' ELSE 'received' END;
 issuevalues:=CASE WHEN statusvalue='pending' THEN ARRAY[coalesce(NEW.reason_code,'awaiting_review')] ELSE '{}'::text[] END;
 UPDATE project_import_records SET status=CASE WHEN cardinality(source_issues)>0 THEN 'pending' ELSE statusvalue END,
 issues=ARRAY(SELECT DISTINCT unnest(source_issues||issuevalues))
 WHERE workspace_id=NEW.workspace_id AND provider=p AND source_id=s AND entity_type=NEW.entity_type AND external_id=NEW.external_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.project_import_sync_staging_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER project_import_clockify_status AFTER INSERT OR UPDATE OF status,reason_code ON public.clockify_staging_records FOR EACH ROW EXECUTE FUNCTION project_import_sync_staging_status();
CREATE TRIGGER project_import_jibble_status AFTER INSERT OR UPDATE OF status,reason_code ON public.time_import_staging FOR EACH ROW EXECUTE FUNCTION project_import_sync_staging_status();

CREATE OR REPLACE FUNCTION public.project_import_record_review(p_workspace uuid,p_id uuid,p_note text,p_action text DEFAULT 'review',p_target uuid DEFAULT NULL,p_target_type text DEFAULT NULL,p_assignee uuid DEFAULT NULL,p_version uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r project_import_records;src_entity text;src_ext text;
BEGIN
 SELECT * INTO r FROM project_import_records WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
 IF r.id IS NULL OR NOT project_import_access(p_workspace,r.provider,'manage') THEN RAISE EXCEPTION 'Registro indisponível ou sem permissão.' USING ERRCODE='42501';END IF;
 IF p_version IS NULL OR p_version IS DISTINCT FROM(SELECT id FROM project_import_record_versions WHERE record_id=r.id AND version_number=r.current_version_number) THEN RAISE EXCEPTION 'O registro de origem mudou. Recarregue e confira a versão atual antes de salvar.' USING ERRCODE='40001';END IF;
 IF length(btrim(p_note)) NOT BETWEEN 8 AND 4000 OR p_action NOT IN('review','link') THEN RAISE EXCEPTION 'Informe o motivo da conferência.';END IF;
 IF p_action='link' THEN
   IF p_target_type='project' THEN
     IF NOT EXISTS(SELECT 1 FROM projects WHERE id=p_target AND workspace_id=p_workspace AND public.work_record_access('techprojects.projects',id,'view')) THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF;
   ELSIF p_target_type='member' THEN
     IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_workspace AND user_id=p_target) THEN RAISE EXCEPTION 'Pessoa indisponível.' USING ERRCODE='42501';END IF;
   ELSE RAISE EXCEPTION 'Tipo de vínculo não permitido.';END IF;
   IF r.provider='clockify' THEN
     src_entity:=CASE WHEN p_target_type='member' THEN 'user' ELSE 'project' END;
     src_ext:=CASE WHEN r.entity_type=src_entity THEN r.external_id WHEN src_entity='user' THEN r.payload->>'userId' ELSE r.payload->>'projectId' END;
     IF src_ext IS NULL OR NOT EXISTS(SELECT 1 FROM clockify_staging_records WHERE workspace_id=p_workspace AND source_workspace_id=r.source_id AND entity_type=src_entity AND external_id=src_ext) THEN RAISE EXCEPTION 'Referência de origem indisponível para este vínculo.';END IF;
     INSERT INTO clockify_mappings(workspace_id,source_workspace_id,entity_type,external_id,label,target_id,method,decision,note,decided_by,decided_at)
     VALUES(p_workspace,r.source_id,src_entity,src_ext,r.label,p_target,'manual','confirmed',btrim(p_note),auth.uid(),now())
     ON CONFLICT(workspace_id,source_workspace_id,entity_type,external_id) DO UPDATE SET target_id=excluded.target_id,method='manual',decision='confirmed',note=excluded.note,decided_by=auth.uid(),decided_at=now(),updated_at=now();
   ELSIF r.provider='jibble' THEN
     src_entity:=CASE WHEN p_target_type='member' THEN 'person' ELSE 'project' END;
     src_ext:=CASE WHEN r.entity_type=src_entity THEN r.external_id WHEN src_entity='person' THEN r.payload->>'personId' ELSE r.payload->>'projectId' END;
     IF src_ext IS NULL OR NOT EXISTS(SELECT 1 FROM time_import_staging WHERE workspace_id=p_workspace AND provider='jibble' AND source_org_id=r.source_id AND entity_type=src_entity AND external_id=src_ext) THEN RAISE EXCEPTION 'Referência de origem indisponível para este vínculo.';END IF;
     INSERT INTO time_import_mappings(workspace_id,provider,source_org_id,entity_type,external_id,label,target_id,method,decision,note,decided_by,decided_at)
     VALUES(p_workspace,'jibble',r.source_id,src_entity,src_ext,r.label,p_target,'manual','confirmed',btrim(p_note),auth.uid(),now())
     ON CONFLICT(workspace_id,provider,source_org_id,entity_type,external_id) DO UPDATE SET target_id=excluded.target_id,method='manual',decision='confirmed',note=excluded.note,decided_by=auth.uid(),decided_at=now(),updated_at=now();
   ELSIF r.provider='clickup' AND p_target_type='member' THEN
     IF r.entity_type NOT IN('person','user') OR r.external_id !~ '^[0-9]{1,18}$' THEN RAISE EXCEPTION 'Pessoa de origem inválida.';END IF;
     INSERT INTO clickup_import_people(workspace_id,clickup_user_id,username,task_count,user_id,status,match_reason,decided_by,decided_at)
     VALUES(p_workspace,r.external_id::bigint,r.label,0,p_target,'confirmed','manual',auth.uid(),now()) ON CONFLICT(workspace_id,clickup_user_id) DO UPDATE SET user_id=excluded.user_id,status='confirmed',match_reason='manual',decided_by=auth.uid(),decided_at=now(),updated_at=now();
   ELSIF r.provider='clickup' AND p_target_type='project' THEN
     src_ext:=CASE WHEN r.entity_type='list' THEN r.external_id ELSE coalesce(r.payload->'list'->>'id',(SELECT t.list_ext_id FROM clickup_import_tasks t JOIN clickup_import_groups g ON g.run_id=t.run_id AND g.list_ext_id=t.list_ext_id WHERE t.workspace_id=p_workspace AND t.run_id=r.last_run_id AND t.external_id=r.external_id AND g.team_id=r.source_id LIMIT 1)) END;
     IF src_ext IS NULL OR NOT EXISTS(SELECT 1 FROM project_import_records WHERE workspace_id=p_workspace AND provider='clickup' AND source_id=r.source_id AND entity_type='list' AND external_id=src_ext) THEN RAISE EXCEPTION 'Lista de origem ainda não recebida. Retome a coleta antes de vincular.';END IF;
     INSERT INTO clickup_import_list_targets(workspace_id,team_id,list_id,target_project_id,decided_by,note) VALUES(p_workspace,r.source_id,src_ext,p_target,auth.uid(),btrim(p_note)) ON CONFLICT(workspace_id,team_id,list_id) DO UPDATE SET target_project_id=excluded.target_project_id,decided_by=auth.uid(),note=excluded.note,updated_at=now();
   END IF;
   UPDATE project_import_records SET target_id=p_target,target_type=p_target_type,status='pending',issues=ARRAY(SELECT DISTINCT unnest(issues||ARRAY['reprocess_required'])) WHERE id=r.id;
 END IF;
 IF p_assignee IS NOT NULL THEN
   IF NOT project_import_review_recipient(p_workspace,r.provider,p_assignee) THEN RAISE EXCEPTION 'Responsável inativo ou sem acesso a esta origem.' USING ERRCODE='42501';END IF;
   UPDATE project_import_records SET review_assignee_id=p_assignee WHERE id=r.id;
 END IF;
 INSERT INTO project_import_record_events(record_id,workspace_id,provider,actor_id,action,note,target_id,target_type,assignee_id,version_id) VALUES(r.id,p_workspace,r.provider,auth.uid(),p_action,btrim(p_note),p_target,p_target_type,p_assignee,p_version);
END $$;
REVOKE ALL ON FUNCTION public.project_import_record_review(uuid,uuid,text,text,uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_record_review(uuid,uuid,text,text,uuid,text,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_import_record_counts(p_workspace uuid,p_provider text DEFAULT NULL,p_run uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('received',count(*),'ready',count(*) FILTER(WHERE status='ready'),'pending',count(*) FILTER(WHERE status='pending'),'unclassified',count(*) FILTER(WHERE status='received')) INTO result FROM project_import_records r WHERE r.workspace_id=p_workspace AND(p_provider IS NULL OR r.provider=p_provider) AND(p_run IS NULL OR EXISTS(SELECT 1 FROM project_import_record_receipts rc WHERE rc.record_id=r.id AND rc.workspace_id=p_workspace AND rc.run_id IN(SELECT p_run UNION SELECT j.native_run_id FROM project_import_journeys j WHERE j.id=p_run AND j.workspace_id=p_workspace UNION SELECT j.preview_run_id FROM project_import_journeys j WHERE j.id=p_run AND j.workspace_id=p_workspace)));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.project_import_record_counts(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_record_counts(uuid,text,uuid) TO authenticated;

CREATE TABLE public.project_import_journeys(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN('clockify','jibble','clickup')),source_id text NOT NULL,source_name text NOT NULL,
 requested_by uuid NOT NULL,delegation_authorized_by uuid,stage text NOT NULL DEFAULT 'collect' CHECK(stage IN('collect','apply','done')),
 backfill_done boolean NOT NULL DEFAULT false,backfill_cursor uuid,
 status text NOT NULL DEFAULT 'running' CHECK(status IN('running','paused','failed','complete','partial')),
 native_run_id uuid,preview_run_id uuid,coverage jsonb NOT NULL DEFAULT '{}',counts jsonb NOT NULL DEFAULT '{"received":0,"ready":0,"pending":0,"unclassified":0}',error text,
 lease_token uuid,lease_until timestamptz,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_import_journeys_page ON public.project_import_journeys(workspace_id,created_at DESC);
CREATE UNIQUE INDEX project_import_journeys_active ON public.project_import_journeys(workspace_id,provider) WHERE stage<>'done' AND status IN('running','paused');
ALTER TABLE public.project_import_journeys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_import_journeys FROM anon,authenticated;
GRANT SELECT ON public.project_import_journeys TO authenticated;
GRANT ALL ON public.project_import_journeys TO service_role;
CREATE POLICY project_import_journeys_read ON public.project_import_journeys FOR SELECT TO authenticated USING((workspace_id,provider) IN(SELECT s.workspace_id,s.provider FROM public.project_import_visible_scopes() s));
CREATE OR REPLACE FUNCTION public.project_import_journey_begin(p_workspace uuid,p_provider text,p_source text,p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r project_import_journeys;
BEGIN
 IF NOT project_import_access(p_workspace,p_provider,'manage') THEN RAISE EXCEPTION 'Sem permissão para iniciar a importação.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||p_provider,480));
 SELECT * INTO r FROM project_import_journeys WHERE workspace_id=p_workspace AND provider=p_provider AND stage<>'done' AND status IN('running','paused') ORDER BY created_at DESC LIMIT 1;
 IF r.id IS NULL THEN INSERT INTO project_import_journeys(workspace_id,provider,source_id,source_name,requested_by) VALUES(p_workspace,p_provider,p_source,p_name,auth.uid()) RETURNING * INTO r;END IF;
 RETURN to_jsonb(r)-'lease_token';
END $$;
REVOKE ALL ON FUNCTION public.project_import_journey_begin(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_journey_begin(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.project_import_journey_claim(p_workspace uuid,p_id uuid,p_provider text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r project_import_journeys;
BEGIN
 SELECT * INTO r FROM project_import_journeys WHERE id=p_id AND workspace_id=p_workspace FOR UPDATE;
 IF r.id IS NULL OR NOT project_import_access(p_workspace,r.provider,'manage') THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='42501';END IF;
 IF p_provider IS NOT NULL AND r.provider<>p_provider THEN RAISE EXCEPTION 'Origem da execução divergente.' USING ERRCODE='42501';END IF;
 IF (r.stage='done' AND r.status<>'partial') OR r.lease_until>now() THEN RETURN NULL;END IF;
 IF r.stage='done' AND r.status='partial' THEN UPDATE project_import_journeys SET stage='collect',native_run_id=NULL,preview_run_id=NULL WHERE id=r.id;END IF;
 UPDATE project_import_journeys SET delegation_authorized_by=auth.uid(),lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',status='running',error=NULL,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.project_import_journey_claim(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_journey_claim(uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.project_import_journey_checkpoint(p_workspace uuid,p_id uuid,p_lease uuid,p_patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r project_import_journeys;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Acesso de serviço necessário.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM project_import_journeys WHERE id=p_id AND workspace_id=p_workspace AND lease_token=p_lease FOR UPDATE;
 IF r.id IS NULL THEN RETURN false;END IF;
 IF NOT project_import_access(p_workspace,r.provider,'manage',coalesce(r.delegation_authorized_by,r.requested_by)) THEN RAISE EXCEPTION 'A autorização da execução foi revogada.' USING ERRCODE='42501';END IF;
 IF p_patch->>'stage'='done' THEN
   IF r.stage<>'apply' OR coalesce(p_patch->>'status','') NOT IN('complete','partial') THEN RAISE EXCEPTION 'A aplicação precisa terminar antes de encerrar a jornada.';END IF;
   IF r.provider='clockify' AND NOT EXISTS(SELECT 1 FROM clockify_import_runs WHERE id=r.native_run_id AND workspace_id=p_workspace AND kind='import' AND status='completed') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';
   ELSIF r.provider='jibble' AND NOT EXISTS(SELECT 1 FROM time_import_runs WHERE id=r.native_run_id AND workspace_id=p_workspace AND provider='jibble' AND kind='import' AND status='completed') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';
   ELSIF r.provider='clickup' AND NOT EXISTS(SELECT 1 FROM clickup_import_runs WHERE id=r.native_run_id AND workspace_id=p_workspace AND status='applied') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';END IF;
   IF EXISTS(SELECT 1 FROM project_import_records record WHERE record.workspace_id=p_workspace AND record.provider=r.provider AND record.status='received' AND EXISTS(SELECT 1 FROM project_import_record_receipts rc WHERE rc.record_id=record.id AND rc.run_id=ANY(ARRAY[r.id,r.preview_run_id,r.native_run_id]))) THEN RAISE EXCEPTION 'A classificação dos registros recebidos ainda não terminou.';END IF;
   IF p_patch->>'status'='complete' AND NOT coalesce((p_patch->'coverage'->>'complete')::boolean,(r.coverage->>'complete')::boolean,false) THEN RAISE EXCEPTION 'A cobertura integral da origem não foi comprovada.';END IF;
 END IF;
 UPDATE project_import_journeys SET stage=coalesce(p_patch->>'stage',stage),status=coalesce(p_patch->>'status',status),native_run_id=CASE WHEN p_patch?'native_run_id' THEN(p_patch->>'native_run_id')::uuid ELSE native_run_id END,preview_run_id=CASE WHEN p_patch?'preview_run_id' THEN(p_patch->>'preview_run_id')::uuid ELSE preview_run_id END,coverage=coalesce(p_patch->'coverage',coverage),counts=coalesce(p_patch->'counts',counts),backfill_done=coalesce((p_patch->>'backfill_done')::boolean,backfill_done),backfill_cursor=CASE WHEN p_patch?'backfill_cursor' THEN(p_patch->>'backfill_cursor')::uuid ELSE backfill_cursor END,error=p_patch->>'error',finished_at=CASE WHEN p_patch->>'stage'='done' THEN now() ELSE finished_at END,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.project_import_journey_checkpoint(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.project_import_journey_checkpoint(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.project_import_member_targets(p_workspace uuid,p_provider text,p_query text DEFAULT '',p_review boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF NOT project_import_access(p_workspace,p_provider,'view') THEN RAISE EXCEPTION 'Sem permissão para consultar vínculos.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label)),'[]') INTO result FROM(
 SELECT DISTINCT m.user_id id,coalesce(p.full_name,'Identidade histórica')||CASE WHEN m.status='active' THEN '' ELSE ' (histórico, sem acesso)' END label
 FROM workspace_members m LEFT JOIN profiles p ON p.id=m.user_id WHERE m.workspace_id=p_workspace AND(NOT p_review OR project_import_review_recipient(p_workspace,p_provider,m.user_id)) AND coalesce(p.full_name,'') ILIKE '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%'
 ORDER BY label,id LIMIT 50) t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.project_import_member_targets(uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_member_targets(uuid,text,text,boolean) TO authenticated;

-- Sanitize existing snapshots before making them visible in the new history.
CREATE OR REPLACE FUNCTION public.project_import_sanitize(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE result jsonb;item record;value text;
BEGIN
 IF jsonb_typeof(p)='object' THEN
   result:='{}';FOR item IN SELECT * FROM jsonb_each(p) LOOP
   IF item.key !~* '^(authorization|proxy.?authorization|cookie|set.?cookie|password|passwd|api.?key|access.?token|refresh.?token|id.?token|client.?secret|signing.?secret|private.?key|key.?ciphertext|credentials.?ciphertext)$' THEN result:=result||jsonb_build_object(item.key,project_import_sanitize(item.value));END IF;END LOOP;RETURN result;
 ELSIF jsonb_typeof(p)='array' THEN SELECT coalesce(jsonb_agg(project_import_sanitize(v)),'[]') INTO result FROM jsonb_array_elements(p) v;RETURN result;
 ELSIF jsonb_typeof(p)='string' THEN
   value:=p#>>'{}';
   value:=regexp_replace(value,'(https?://)[^/@[:space:]<>"'')\]]+:[^/@[:space:]<>"'')\]]+@','\1','gi');
   -- Strip temporary query capabilities also in Markdown/HTML, retaining the document text and URL path.
   value:=regexp_replace(value,'(https?://[^?[:space:]<>"'')\]]+)[?][^[:space:]<>"'')\]]*(token|signature|x-amz-|x-goog-|api_key|apikey|jwt|sig=|key=|expires=)[^[:space:]<>"'')\]]*','\1','gi');
   value:=regexp_replace(value,'(https?://[^#[:space:]<>"'')\]]+)#[^[:space:]<>"'')\]]*(access_token|refresh_token|id_token|token|api_key|signature|jwt)=[^[:space:]<>"'')\]]*','\1','gi');
   RETURN to_jsonb(value);
 END IF;RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.project_import_sanitize(jsonb) FROM PUBLIC,anon,authenticated;

-- Bounded, resumable adoption of previously imported evidence. Never overwrites newer collected originals.
CREATE OR REPLACE FUNCTION public.project_import_preserve_legacy_step(p_workspace uuid,p_provider text,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 500,p_journey uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record;cursor_id uuid:=p_after;seen integer:=0;rid uuid;clean jsonb;h text;
 oldrow project_import_records;issuesvalue text[];intrinsic text[];statusvalue text;
 observed_version integer;total_versions integer;adopt_current boolean;
BEGIN
 IF NOT project_import_access(p_workspace,p_provider,'manage') THEN RAISE EXCEPTION 'Sem permissão para preservar o histórico.' USING ERRCODE='42501';END IF;
 IF p_journey IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_import_journeys WHERE id=p_journey AND workspace_id=p_workspace AND provider=p_provider) THEN RAISE EXCEPTION 'Jornada indisponível.' USING ERRCODE='42501';END IF;
 IF p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Tamanho de lote inválido.';END IF;
 -- Serialize adoption batches, then share each source lock with live preservation.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||p_provider,481));
 FOR r IN
 SELECT id,source_id,entity_type,external_id,payload,last_run_id,status,reason_code,observed_at FROM(
 SELECT s.id,s.source_workspace_id source_id,s.entity_type,s.external_id,s.payload,s.last_run_id,s.status,s.reason_code,coalesce(s.last_seen_at,s.first_seen_at,now()) observed_at FROM clockify_staging_records s WHERE p_provider='clockify' AND s.workspace_id=p_workspace
 UNION ALL SELECT s.id,s.source_org_id,s.entity_type,s.external_id,s.payload,s.last_run_id,s.status,s.reason_code,coalesce(s.last_seen_at,s.first_seen_at,now()) FROM time_import_staging s WHERE p_provider='jibble' AND s.workspace_id=p_workspace AND s.provider='jibble'
 UNION ALL SELECT md5(s.run_id::text||':'||s.external_id)::uuid,g.team_id,'task',s.external_id,s.payload,s.run_id,'pending_review','legacy_snapshot_only',coalesce(n.created_at,now()) FROM clickup_import_tasks s JOIN clickup_import_groups g ON g.run_id=s.run_id AND g.list_ext_id=s.list_ext_id AND g.workspace_id=p_workspace JOIN clickup_import_runs n ON n.id=s.run_id AND n.workspace_id=s.workspace_id WHERE p_provider='clickup' AND s.workspace_id=p_workspace
 ) snapshots WHERE (p_after IS NULL OR id>p_after) ORDER BY id LIMIT p_limit
 LOOP
   seen:=seen+1;cursor_id:=r.id;clean:=project_import_sanitize(r.payload);h:=encode(sha256(convert_to(clean::text,'utf8')),'hex');
   intrinsic:=project_import_source_issues(p_provider,r.entity_type,clean);
   issuesvalue:=CASE WHEN r.reason_code IS NOT NULL THEN ARRAY[r.reason_code] ELSE '{}'::text[] END||intrinsic;
   IF r.reason_code='legacy_snapshot_only' THEN intrinsic:=issuesvalue;END IF;
   statusvalue:=CASE WHEN cardinality(issuesvalue)>0 THEN 'pending' WHEN r.status IN('ready','imported') THEN 'ready' WHEN r.status='staged' THEN 'received' ELSE 'pending' END;
   PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||p_provider||':'||r.source_id,479));
   SELECT * INTO oldrow FROM project_import_records WHERE workspace_id=p_workspace AND provider=p_provider AND source_id=r.source_id AND entity_type=r.entity_type AND external_id=r.external_id FOR UPDATE;
   IF oldrow.id IS NULL THEN
     INSERT INTO project_import_records(workspace_id,provider,source_id,entity_type,external_id,payload,payload_hash,label,status,issues,source_issues,last_run_id,current_from_legacy,source_observed_at)
     VALUES(p_workspace,p_provider,r.source_id,r.entity_type,r.external_id,clean,h,left(coalesce(nullif(clean->>'name',''),nullif(clean->>'title',''),nullif(clean->>'description',''),r.external_id),300),statusvalue,issuesvalue,intrinsic,coalesce(r.last_run_id,r.id),true,r.observed_at) RETURNING id INTO rid;
     observed_version:=1;
     INSERT INTO project_import_record_versions(record_id,workspace_id,provider,version_number,payload,payload_hash,run_id,source_observed_at,from_legacy)
     VALUES(rid,p_workspace,p_provider,1,clean,h,coalesce(r.last_run_id,r.id),r.observed_at,true);
   ELSE
     rid:=oldrow.id;total_versions:=oldrow.version_count;
     -- JSON equality, not a transport/hash representation, identifies a distinct source snapshot.
     SELECT version_number INTO observed_version FROM project_import_record_versions WHERE record_id=rid AND payload=clean ORDER BY version_number LIMIT 1;
     IF observed_version IS NULL THEN
       total_versions:=total_versions+1;observed_version:=total_versions;
       INSERT INTO project_import_record_versions(record_id,workspace_id,provider,version_number,payload,payload_hash,run_id,source_observed_at,from_legacy)
       VALUES(rid,p_workspace,p_provider,observed_version,clean,h,coalesce(r.last_run_id,r.id),r.observed_at,true);
     END IF;
     -- UUID pagination is not chronology. Only a legacy current value may move, to the newest snapshot.
     adopt_current:=oldrow.current_from_legacy AND (r.observed_at>oldrow.source_observed_at OR(r.observed_at=oldrow.source_observed_at AND coalesce(r.last_run_id,r.id)::text>oldrow.last_run_id::text));
     IF adopt_current THEN
       UPDATE project_import_records SET payload=clean,payload_hash=h,label=left(coalesce(nullif(clean->>'name',''),nullif(clean->>'title',''),nullif(clean->>'description',''),r.external_id),300),status=statusvalue,issues=issuesvalue,source_issues=intrinsic,last_run_id=coalesce(r.last_run_id,r.id),last_seen_at=now(),version_count=total_versions,current_version_number=observed_version,source_observed_at=r.observed_at WHERE id=rid;
     ELSE
       UPDATE project_import_records SET version_count=total_versions WHERE id=rid;
     END IF;
   END IF;
   INSERT INTO project_import_record_receipts(record_id,run_id,workspace_id,provider) VALUES(rid,coalesce(r.last_run_id,r.id),p_workspace,p_provider) ON CONFLICT DO NOTHING;
   IF p_journey IS NOT NULL THEN INSERT INTO project_import_record_receipts(record_id,run_id,workspace_id,provider) VALUES(rid,p_journey,p_workspace,p_provider) ON CONFLICT DO NOTHING;END IF;
 END LOOP;
 RETURN jsonb_build_object('cursor',cursor_id,'done',seen<p_limit,'count',seen);
END $$;
REVOKE ALL ON FUNCTION public.project_import_preserve_legacy_step(uuid,text,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_preserve_legacy_step(uuid,text,uuid,integer,uuid) TO authenticated;

CREATE TABLE public.clickup_import_list_targets(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,team_id text NOT NULL,list_id text NOT NULL,
 target_project_id uuid NOT NULL REFERENCES public.projects(id),decided_by uuid NOT NULL,note text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,team_id,list_id)
);
ALTER TABLE public.clickup_import_list_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clickup_import_list_targets FROM anon,authenticated;
GRANT SELECT ON public.clickup_import_list_targets TO authenticated;
GRANT ALL ON public.clickup_import_list_targets TO service_role;
CREATE POLICY clickup_import_list_targets_read ON public.clickup_import_list_targets FOR SELECT TO authenticated USING((workspace_id,'clickup'::text) IN(SELECT s.workspace_id,s.provider FROM project_import_visible_scopes() s));

CREATE OR REPLACE FUNCTION public.project_import_records_page(p_workspace uuid,p_provider text DEFAULT NULL,p_status text DEFAULT NULL,p_query text DEFAULT '',p_page integer DEFAULT 0,p_assignee uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE pattern text:='%'||replace(replace(replace(btrim(p_query),'\','\\'),'%','\%'),'_','\_')||'%';result jsonb;
BEGIN
 IF p_page<0 OR p_page>1000000 OR length(p_query)>200 OR(p_provider IS NOT NULL AND p_provider NOT IN('clockify','jibble','clickup')) OR(p_status IS NOT NULL AND p_status NOT IN('ready','received','pending')) THEN RAISE EXCEPTION 'Filtro de importação inválido.';END IF;
 WITH matching_people AS MATERIALIZED(
 SELECT provider,source_id,external_id FROM project_import_records WHERE workspace_id=p_workspace AND entity_type IN('person','user') AND label ILIKE pattern
 ),filtered AS MATERIALIZED(
 SELECT r.id,r.workspace_id,r.provider,r.source_id,r.entity_type,r.external_id,r.label,r.status,r.issues,r.last_seen_at,r.version_count,r.current_version_number,r.current_from_legacy,r.source_observed_at,r.target_id,r.target_type,r.review_assignee_id
 FROM project_import_records r WHERE r.workspace_id=p_workspace AND(p_provider IS NULL OR r.provider=p_provider) AND(p_status IS NULL OR r.status=p_status) AND(p_assignee IS NULL OR r.review_assignee_id=p_assignee)
 AND(btrim(p_query)='' OR r.label ILIKE pattern OR r.external_id ILIKE pattern OR r.source_id ILIKE pattern OR r.source_person_id ILIKE pattern OR (r.provider,r.source_id,r.source_person_id) IN(SELECT provider,source_id,external_id FROM matching_people))
 ),page_rows AS(SELECT * FROM filtered ORDER BY last_seen_at DESC,id DESC LIMIT 50 OFFSET p_page*50)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'rows',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_rows p),'[]')) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.project_import_records_page(uuid,text,text,text,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_records_page(uuid,text,text,text,integer,uuid) TO authenticated;

CREATE INDEX project_import_records_assignee ON public.project_import_records(workspace_id,provider,review_assignee_id,status,last_seen_at DESC);
CREATE OR REPLACE FUNCTION public.project_import_review_recipient(p_ws uuid,p_provider text,p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;prefix text;
BEGIN
 IF p_user IS NULL OR p_provider NOT IN('clockify','jibble','clickup') THEN RETURN false;END IF;
 c:=work_subject_context(p_ws,p_user);prefix:='techprojects.'||p_provider||'_import.';
 IF c->>'actor' IS DISTINCT FROM p_user::text THEN RETURN false;END IF;
 IF p_provider IN('clockify','jibble') AND NOT is_active_workspace_admin(p_ws,p_user) THEN RETURN false;END IF;
 RETURN coalesce(c->'keys' ? (prefix||'view.workspace'),false) OR(p_provider='clickup' AND coalesce(c->'keys' ? (prefix||'manage.workspace'),false));
END $$;
REVOKE ALL ON FUNCTION public.project_import_review_recipient(uuid,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.project_import_source_issues(p_provider text,p_entity text,p jsonb)
RETURNS text[] LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE a timestamptz;b timestamptz;
BEGIN
 IF p_provider='clockify' AND p_entity='time_entry' THEN
   IF nullif(p->'timeInterval'->>'start','') IS NULL OR (p->'timeInterval'->>'start') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN RETURN ARRAY['invalid_source_date'];END IF;
   BEGIN a:=(p->'timeInterval'->>'start')::timestamptz;EXCEPTION WHEN OTHERS THEN RETURN ARRAY['invalid_source_date'];END;
   IF nullif(p->'timeInterval'->>'end','') IS NULL THEN RETURN ARRAY['open_interval'];END IF;
   BEGIN b:=(p->'timeInterval'->>'end')::timestamptz;EXCEPTION WHEN OTHERS THEN RETURN ARRAY['invalid_source_date'];END;
   IF NOT isfinite(a) OR NOT isfinite(b) THEN RETURN ARRAY['invalid_source_date'];END IF;
   IF b=a THEN RETURN ARRAY['zero_duration'];ELSIF b<a THEN RETURN ARRAY['negative_duration'];END IF;
 END IF;
 RETURN '{}'::text[];
END $$;
REVOKE ALL ON FUNCTION public.project_import_source_issues(text,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Classify reference-only observations after native normalization. No task/hour or financial write.
CREATE OR REPLACE FUNCTION public.project_import_ready_step(p_workspace uuid,p_journey uuid,p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j project_import_journeys;n integer;
BEGIN
 SELECT * INTO j FROM project_import_journeys WHERE id=p_journey AND workspace_id=p_workspace;
 IF j.id IS NULL OR NOT project_import_access(p_workspace,j.provider,'manage') THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='42501';END IF;
 IF p_limit NOT BETWEEN 1 AND 500 OR j.stage<>'apply' THEN RAISE EXCEPTION 'Etapa de classificação inválida.';END IF;
 IF j.provider='clockify' AND NOT EXISTS(SELECT 1 FROM clockify_import_runs WHERE id=j.native_run_id AND workspace_id=p_workspace AND kind='import' AND status='completed') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';
 ELSIF j.provider='jibble' AND NOT EXISTS(SELECT 1 FROM time_import_runs WHERE id=j.native_run_id AND workspace_id=p_workspace AND provider='jibble' AND kind='import' AND status='completed') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';
 ELSIF j.provider='clickup' AND NOT EXISTS(SELECT 1 FROM clickup_import_runs WHERE id=j.native_run_id AND workspace_id=p_workspace AND status='applied') THEN RAISE EXCEPTION 'A aplicação da origem ainda não terminou.';END IF;
 WITH todo AS(SELECT r.id FROM project_import_records r WHERE r.workspace_id=p_workspace AND r.provider=j.provider AND r.status='received' AND cardinality(r.source_issues)=0 AND cardinality(r.issues)=0 AND EXISTS(SELECT 1 FROM project_import_record_receipts rc WHERE rc.record_id=r.id AND rc.run_id=ANY(ARRAY[j.id,j.preview_run_id,j.native_run_id])) ORDER BY r.id LIMIT p_limit FOR UPDATE)
 UPDATE project_import_records r SET status='ready' FROM todo WHERE r.id=todo.id;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('classified',n,'done',n<p_limit);
END $$;
REVOKE ALL ON FUNCTION public.project_import_ready_step(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_ready_step(uuid,uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_import_entity_counts(p_workspace uuid,p_provider text,p_run uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('entity',entity_type,'count',n)),'[]') FROM(
 SELECT r.entity_type,count(*) n FROM project_import_records r WHERE r.workspace_id=p_workspace AND r.provider=p_provider AND EXISTS(SELECT 1 FROM project_import_record_receipts rc WHERE rc.record_id=r.id AND rc.workspace_id=p_workspace AND rc.run_id=p_run) GROUP BY r.entity_type)t
$$;
REVOKE ALL ON FUNCTION public.project_import_entity_counts(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_entity_counts(uuid,text,uuid) TO authenticated;
