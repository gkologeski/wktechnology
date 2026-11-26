-- Evidence is paginated independently of the current original. User/RLS reads only.
CREATE OR REPLACE FUNCTION public.project_import_evidence_page(p_workspace uuid,p_record uuid,p_kind text,p_cursor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r project_import_records;v_cursor integer;e_time timestamptz;e_id uuid;rows jsonb;next_id uuid;total integer;
BEGIN
 SELECT * INTO r FROM project_import_records WHERE id=p_record AND workspace_id=p_workspace;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Registro indisponível ou sem permissão.' USING ERRCODE='42501';END IF;
 IF p_kind NOT IN('versions','history') OR p_kind IS NULL THEN RAISE EXCEPTION 'Tipo de evidência inválido.';END IF;
 IF p_kind='versions' THEN
   IF p_cursor IS NOT NULL THEN
     SELECT version_number INTO v_cursor FROM project_import_record_versions WHERE id=p_cursor AND record_id=p_record AND workspace_id=p_workspace;
     IF v_cursor IS NULL THEN RAISE EXCEPTION 'Cursor de evidência indisponível.' USING ERRCODE='42501';END IF;
   END IF;
   WITH candidates AS MATERIALIZED(
     SELECT id,received_at,payload_hash,version_number FROM project_import_record_versions
     WHERE workspace_id=p_workspace AND record_id=p_record AND(p_cursor IS NULL OR version_number<v_cursor)
     ORDER BY version_number DESC LIMIT 51
   ), page AS(SELECT * FROM candidates ORDER BY version_number DESC LIMIT 50)
   SELECT coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.version_number DESC) FROM page p),'[]'),
     (SELECT count(*) FROM candidates),(SELECT id FROM page ORDER BY version_number ASC LIMIT 1)
   INTO rows,total,next_id;
   RETURN jsonb_build_object('versions',rows,'history','[]'::jsonb,'nextCursor',CASE WHEN total>50 THEN next_id ELSE NULL END);
 END IF;
 IF p_cursor IS NOT NULL THEN
   SELECT created_at,id INTO e_time,e_id FROM project_import_record_events WHERE id=p_cursor AND record_id=p_record AND workspace_id=p_workspace;
   IF e_id IS NULL THEN RAISE EXCEPTION 'Cursor de evidência indisponível.' USING ERRCODE='42501';END IF;
 END IF;
 WITH candidates AS MATERIALIZED(
   SELECT id,created_at,actor_id,note,assignee_id FROM project_import_record_events
   WHERE workspace_id=p_workspace AND record_id=p_record AND(p_cursor IS NULL OR(created_at,id)<(e_time,e_id))
   ORDER BY created_at DESC,id DESC LIMIT 51
 ), page AS(SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC) FROM page p),'[]'),
   (SELECT count(*) FROM candidates),(SELECT id FROM page ORDER BY created_at ASC,id ASC LIMIT 1)
 INTO rows,total,next_id;
 RETURN jsonb_build_object('versions','[]'::jsonb,'history',rows,'nextCursor',CASE WHEN total>50 THEN next_id ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.project_import_evidence_page(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_import_evidence_page(uuid,uuid,text,uuid) TO authenticated;
CREATE INDEX project_import_events_cursor ON public.project_import_record_events(record_id,created_at DESC,id DESC);
