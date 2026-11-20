-- NOTIFICA-CENTRAL package 5: complete the personal center/bell contract.
-- Additive read-only surfaces. No historical backfill, grants to roles, producers,
-- notification emission, external sends, or workspace configuration changes.

-- The request kind is the canonical discriminator. Never infer its module from
-- the notification title/link, and never inspect it before source authorization.
CREATE FUNCTION techerp_api.notification_center_source_module(
 p_workspace uuid,p_user uuid,p_table text,p_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE request_kind text;BEGIN
 IF p_table='hiring_preparation_requests' THEN
  IF NOT techerp_api.notification_center_source_visible(p_workspace,p_user,p_table,p_id) THEN RETURN NULL;END IF;
  SELECT kind INTO request_kind FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_workspace;
  RETURN CASE request_kind WHEN 'professional' THEN 'people' WHEN 'supplier' THEN 'contracts' END;
 END IF;
 RETURN techerp_api.notification_center_module(p_table);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_source_module(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_center_badge(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);unread_count integer;BEGIN
 SELECT count(*)::integer INTO unread_count FROM(
  SELECT 1 FROM public.notifications n
  JOIN public.notification_workspace_context c ON c.notification_id=n.id
  WHERE n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
   AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp() AND n.read_at IS NULL
   AND(n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
   AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id)
  ORDER BY n.created_at DESC,n.id DESC LIMIT 100
 ) eligible;
 RETURN jsonb_build_object('unread',unread_count,'unreadCapped',unread_count=100,'checkedAt',statement_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.notification_center_badge(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_badge(uuid) TO authenticated;

CREATE FUNCTION public.notification_center_lookup(p_workspace uuid,p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);result jsonb;BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 30 OR coalesce(array_ndims(p_ids),0)<>1 THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 IF array_position(p_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'type',n.type,'title',n.title,'body',n.body,'link',n.link,'entity',n.entity,'entity_id',n.entity_id,
  'moduleKey',techerp_api.notification_center_source_module(p_workspace,u,c.source_table,c.source_id),
  'created_at',n.created_at,'read_at',n.read_at,'snoozed_until',n.snoozed_until
 ) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb),'checkedAt',statement_timestamp()) INTO result
 FROM public.notifications n JOIN public.notification_workspace_context c ON c.notification_id=n.id
 WHERE n.id=ANY(p_ids) AND n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
  AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp()
  AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.notification_center_lookup(uuid,uuid[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_lookup(uuid,uuid[]) TO authenticated;

-- Preserve the existing eight-argument cursor/history/search contract. Only
-- canonical hiring-request module resolution changes in this replacement.
CREATE OR REPLACE FUNCTION public.notification_center_list(p_workspace uuid,p_scope text DEFAULT 'workspace',
 p_status text DEFAULT 'all',p_category text DEFAULT NULL,p_q text DEFAULT '',p_cursor jsonb DEFAULT NULL,
 p_cutoff timestamptz DEFAULT NULL,p_module text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);cutoff timestamptz:=coalesce(p_cutoff,statement_timestamp());
 cursor_at timestamptz;cursor_id uuid;pattern text;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('workspace','legacy') OR p_status IS NULL
  OR p_status NOT IN('all','unread','read','snoozed') OR p_q IS NULL OR length(p_q)>120
  OR (p_category IS NOT NULL AND p_category NOT IN('mention','assignment','deal_stage','ticket','task','sla','message',
   'workflow','approval','hiring','form','portfolio','platform')) OR cutoff>statement_timestamp()+interval '1 second' THEN
  RAISE EXCEPTION 'Filtro de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_module IS NOT NULL AND p_module NOT IN('crm','ats','people','contracts','projects','finance') THEN
  RAISE EXCEPTION 'Módulo de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF p_cutoff IS NULL OR jsonb_typeof(p_cursor)<>'object'
   OR NOT p_cursor?'createdAt' OR NOT p_cursor?'id'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor)k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
  BEGIN cursor_at:=(p_cursor->>'createdAt')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END;
  IF cursor_at IS NULL OR cursor_id IS NULL OR cursor_at>cutoff THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
 END IF;
 pattern:='%'||replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')||'%';
 WITH candidates AS NOT MATERIALIZED (
  SELECT n.*,c.source_table,c.source_id,c.workspace_id AS proven_workspace FROM public.notifications n
  LEFT JOIN public.notification_workspace_context c ON c.notification_id=n.id
  WHERE n.user_id=u AND n.created_at<=cutoff
   AND ((p_scope='workspace' AND c.workspace_id=p_workspace AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
    OR (p_scope='legacy' AND c.notification_id IS NULL))
   AND (p_category IS NULL OR techerp_api.notification_center_category(n.type)=p_category)
   AND (p_module IS NULL OR (p_scope='workspace' AND techerp_api.notification_center_source_module(p_workspace,u,c.source_table,c.source_id)=p_module))
   AND (btrim(p_q)='' OR (p_scope='workspace' AND (n.title ILIKE pattern ESCAPE '\' OR n.body ILIKE pattern ESCAPE '\')))
 ),page AS MATERIALIZED (
  SELECT * FROM candidates n WHERE
   (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id))
   AND (p_status='snoozed' AND n.snoozed_until>statement_timestamp()
    OR p_status<>'snoozed' AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
     AND (p_status='all' OR p_status='unread' AND n.read_at IS NULL OR p_status='read' AND n.read_at IS NOT NULL))
   AND (cursor_at IS NULL OR (n.created_at,n.id)<(cursor_at,cursor_id))
  ORDER BY created_at DESC,id DESC LIMIT 31
 ),unread AS (
  SELECT 1 FROM candidates n WHERE n.read_at IS NULL
   AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
   AND (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id)) LIMIT 100
 ),items AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30),last_item AS (
  SELECT created_at,id FROM items ORDER BY created_at,id LIMIT 1
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'type',type,'title',CASE WHEN p_scope='legacy' THEN 'Notificação do histórico pessoal' ELSE title END,
   'body',CASE WHEN p_scope='legacy' THEN 'Este aviso não possui origem de workspace comprovada. Consulte seus registros no TechERP.' ELSE body END,
   'link',CASE WHEN p_scope='legacy' THEN NULL ELSE link END,
   'entity',CASE WHEN p_scope='legacy' THEN NULL ELSE entity END,
   'entity_id',CASE WHEN p_scope='legacy' THEN NULL ELSE entity_id END,
   'moduleKey',CASE WHEN p_scope='legacy' THEN NULL ELSE techerp_api.notification_center_source_module(p_workspace,u,source_table,source_id) END,
   'created_at',created_at,'read_at',read_at,'snoozed_until',snoozed_until
  ) ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
  'unread',(SELECT count(*) FROM unread),'unreadCapped',(SELECT count(*)=100 FROM unread),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>30 THEN
   (SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM last_item) ELSE NULL END,'cutoff',cutoff) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.notification_center_list(uuid,text,text,text,text,jsonb,timestamptz,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_list(uuid,text,text,text,text,jsonb,timestamptz,text) TO authenticated;
