-- NOTIFICA-CENTRAL package 3. Prepared locally; no historical attribution or sends.
ALTER TABLE public.notifications ADD COLUMN snoozed_until timestamptz;
CREATE TABLE public.notification_workspace_context (
 notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 source_table text NOT NULL,source_id uuid NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notification_context_workspace ON public.notification_workspace_context(workspace_id,notification_id);
ALTER TABLE public.notification_workspace_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_workspace_context FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.notification_user_preferences (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0),settings jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,user_id),
 CHECK(jsonb_typeof(settings)='object')
);
ALTER TABLE public.notification_user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_user_preferences FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX notification_center_page ON public.notifications(user_id,created_at DESC,id DESC);
CREATE INDEX notification_center_unread ON public.notifications(user_id,created_at DESC,id DESC) WHERE read_at IS NULL;

-- No caller-chosen actor, selected-workspace bypass, or read-only write is accepted.
CREATE FUNCTION techerp_api.notification_center_actor(p_workspace uuid,p_write boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;u uuid:=auth.uid();BEGIN
 IF coalesce(auth.role(),'')<>'authenticated' OR u IS NULL OR p_workspace IS NULL
  OR current_setting('app.api_subject',true)='on' THEN
  RAISE EXCEPTION 'Sessão e workspace ativo são obrigatórios.' USING ERRCODE='42501';END IF;
 c:=public.work_access_context();
 IF c->>'workspace' IS DISTINCT FROM p_workspace::text OR c->>'actor' IS DISTINCT FROM u::text
  OR NOT public.is_workspace_member(p_workspace,u) OR (p_write AND public.is_read_only_view()) THEN
  RAISE EXCEPTION 'Acesso ao workspace indisponível.' USING ERRCODE='42501';END IF;
 RETURN u;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_actor(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Feed readers already are the authenticated subject. Execute a read-only RLS
-- lookup as the non-BYPASSRLS subject role, retaining the actual JWT. Unlike the
-- service dispatch bridge this path must also work inside Data API GET's read-only
-- transaction; it never writes subject_sessions or impersonates another user.
CREATE FUNCTION techerp_api.notification_center_source_visible(p_ws uuid,p_user uuid,p_table text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;BEGIN
 IF p_ws IS NULL OR p_user IS NULL OR p_id IS NULL OR p_table IS NULL
  OR p_user IS DISTINCT FROM auth.uid() OR coalesce(auth.role(),'')<>'authenticated'
  OR p_table NOT IN('leads','contacts','companies','deals','tickets','activities','ats_jobs','ats_candidates',
   'ats_applications','ats_interviews','projects','project_tasks','project_milestones','contracts',
   'financial_entries','bank_payments','quotes','proposals','services','recurring_plans',
   'subscription_invoices','customer_invoices','people','whatsapp_conversations','email_threads',
   'live_chat_sessions','linkedin_conversations','hiring_preparation_requests','contract_drafts','service_agent_sessions')
  OR current_setting('app.api_subject',true)='on' OR NOT public.is_workspace_member(p_ws,p_user)
  OR (public.work_access_context()->>'workspace') IS DISTINCT FROM p_ws::text THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',p_table)
  INTO allowed USING p_id,p_ws;
 RETURN coalesce(allowed,false);
END $$;
ALTER FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) TO postgres;

-- Proof is captured only on new inserts, against literal source tables and their
-- actual workspace. A title, href, owner_id or old workspace default is not proof.
CREATE FUNCTION techerp_api.notification_center_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t text;w uuid;candidate text;matches integer:=0;BEGIN
 IF NEW.workspace_id IS NULL OR NEW.entity_id IS NULL THEN RETURN NEW;END IF;
 t:=CASE NEW.entity
  WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies'
  WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' WHEN 'activity' THEN 'activities'
  WHEN 'person' THEN 'people' WHEN 'project' THEN 'projects' WHEN 'contract' THEN 'contracts'
  WHEN 'ats_job' THEN 'ats_jobs' WHEN 'ats_candidate' THEN 'ats_candidates'
  WHEN 'ats_application' THEN 'ats_applications' WHEN 'ats_interview' THEN 'ats_interviews'
  WHEN 'project_task' THEN 'project_tasks' WHEN 'project_milestone' THEN 'project_milestones'
  WHEN 'contract_draft' THEN 'contract_drafts' WHEN 'service_agent_session' THEN 'service_agent_sessions'
  WHEN 'hiring_preparation_request' THEN 'hiring_preparation_requests' ELSE NEW.entity END;
 IF t='inbox_conversation' THEN
  FOREACH candidate IN ARRAY ARRAY['whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations'] LOOP
   EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',candidate) INTO w USING NEW.entity_id;
   IF w=NEW.workspace_id THEN matches:=matches+1;t:=candidate;END IF;
  END LOOP;
  IF matches<>1 THEN RETURN NEW;END IF;
 ELSIF t IN('leads','contacts','companies','deals','tickets','activities','ats_jobs','ats_candidates',
  'ats_applications','ats_interviews','projects','project_tasks','project_milestones','contracts',
  'financial_entries','bank_payments','quotes','proposals','services','recurring_plans',
  'subscription_invoices','customer_invoices','people','hiring_preparation_requests',
  'whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations','contract_drafts','service_agent_sessions') THEN
  EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',t) INTO w USING NEW.entity_id;
  IF w IS DISTINCT FROM NEW.workspace_id THEN RETURN NEW;END IF;
 ELSE RETURN NEW;END IF;
 INSERT INTO public.notification_workspace_context(notification_id,workspace_id,source_table,source_id)
  VALUES(NEW.id,NEW.workspace_id,t,NEW.entity_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_center_capture AFTER INSERT ON public.notifications
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_center_capture();

-- The definer lookup cannot recurse through the notification table's own RLS.
-- The public boolean is bound to auth.uid() and never inspects another user's row.
CREATE FUNCTION public.notification_center_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.notifications;c public.notification_workspace_context;ctx jsonb;u uuid:=auth.uid();BEGIN
 IF u IS NULL OR auth.role()<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 ctx:=public.work_access_context();
 IF ctx->>'actor' IS DISTINCT FROM u::text OR ctx->>'workspace' IS NULL THEN RETURN false;END IF;
 SELECT * INTO n FROM public.notifications WHERE id=p_id AND user_id=u;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO c FROM public.notification_workspace_context WHERE notification_id=n.id;
 RETURN coalesce(c.workspace_id::text=ctx->>'workspace' AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id
  AND public.is_workspace_member(c.workspace_id,u)
  AND techerp_api.notification_center_source_visible(c.workspace_id,u,c.source_table,c.source_id),false);
END $$;
REVOKE ALL ON FUNCTION public.notification_center_visible(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_visible(uuid) TO authenticated;
CREATE POLICY notification_center_read_boundary ON public.notifications AS RESTRICTIVE
 FOR SELECT TO authenticated USING(public.notification_center_visible(id));
REVOKE UPDATE,DELETE ON public.notifications FROM authenticated;

CREATE FUNCTION techerp_api.notification_center_category(p_type text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_type IN('mention','assignment','deal_stage','ticket','task','message','workflow') THEN p_type
 WHEN p_type IN('sla','sla.first_response_breach','sla.resolution_breach','sla.at_risk') THEN 'sla'
 WHEN p_type IN('approval','role_profile_approval','hiring_approval','hiring_preparation_approval') THEN 'approval'
 WHEN p_type IN('role_profile','hiring_formalization') THEN 'hiring'
 WHEN p_type='form_submission' THEN 'form' WHEN p_type='portfolio_conflict' THEN 'portfolio'
 WHEN p_type='sequence_handoff' THEN 'task' WHEN p_type IN('security_scan','platform_alert') THEN 'platform'
 ELSE NULL END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_category(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_center_module(p_table text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_table IN('leads','contacts','companies','deals','tickets','activities','quotes','proposals',
  'whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations','service_agent_sessions') THEN 'crm'
 WHEN p_table IN('ats_jobs','ats_candidates','ats_applications','ats_interviews') THEN 'ats'
 WHEN p_table='people' THEN 'people' WHEN p_table IN('projects','project_tasks','project_milestones') THEN 'projects'
 WHEN p_table IN('contracts','contract_drafts','services') THEN 'contracts'
 WHEN p_table IN('financial_entries','bank_payments','recurring_plans','subscription_invoices','customer_invoices') THEN 'finance'
 ELSE NULL END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_module(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_center_list(p_workspace uuid,p_scope text DEFAULT 'workspace',
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
   AND (p_module IS NULL OR (p_scope='workspace' AND techerp_api.notification_center_module(c.source_table)=p_module))
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
   'moduleKey',CASE WHEN p_scope='legacy' THEN NULL ELSE techerp_api.notification_center_module(source_table) END,
   'created_at',created_at,'read_at',read_at,'snoozed_until',snoozed_until
  ) ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
  'unread',(SELECT count(*) FROM unread),'unreadCapped',(SELECT count(*)=100 FROM unread),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>30 THEN
   (SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM last_item) ELSE NULL END,'cutoff',cutoff) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.notification_center_list(uuid,text,text,text,text,jsonb,timestamptz,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_list(uuid,text,text,text,text,jsonb,timestamptz,text) TO authenticated;

CREATE FUNCTION techerp_api.notification_center_item(p_workspace uuid,p_user uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.notification_workspace_context;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE id=p_id AND user_id=p_user) THEN RETURN false;END IF;
 SELECT * INTO c FROM public.notification_workspace_context WHERE notification_id=p_id;
 IF NOT FOUND THEN RETURN true;END IF;
 RETURN c.workspace_id=p_workspace AND EXISTS(SELECT 1 FROM public.notifications n
  WHERE n.id=p_id AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
  AND techerp_api.notification_center_source_visible(p_workspace,p_user,c.source_table,c.source_id);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_center_item(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_center_mark(p_workspace uuid,p_ids uuid[],p_cutoff timestamptz,p_read boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);i uuid;updated integer;BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 100 OR p_cutoff IS NULL OR p_read IS NULL
  OR p_cutoff>statement_timestamp()+interval '1 second' OR array_position(p_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Selecione de um a cem avisos visíveis.' USING ERRCODE='22023';END IF;
 FOREACH i IN ARRAY ARRAY(SELECT DISTINCT x FROM unnest(p_ids)x ORDER BY x) LOOP
  PERFORM 1 FROM public.notifications WHERE id=i AND user_id=u AND created_at<=p_cutoff FOR UPDATE;
  IF NOT FOUND OR NOT techerp_api.notification_center_item(p_workspace,u,i) THEN
   RAISE EXCEPTION 'Notificação indisponível ou contexto alterado.' USING ERRCODE='42501';END IF;
 END LOOP;
 UPDATE public.notifications SET read_at=CASE WHEN p_read THEN statement_timestamp() ELSE NULL END
  WHERE id=ANY(p_ids) AND user_id=u AND ((p_read AND read_at IS NULL) OR (NOT p_read AND read_at IS NOT NULL));
 GET DIAGNOSTICS updated=ROW_COUNT;RETURN jsonb_build_object('updated',updated);
END $$;
REVOKE ALL ON FUNCTION public.notification_center_mark(uuid,uuid[],timestamptz,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_mark(uuid,uuid[],timestamptz,boolean) TO authenticated;

CREATE FUNCTION public.notification_center_snooze(p_workspace uuid,p_id uuid,p_minutes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);updated integer;BEGIN
 IF p_id IS NULL OR p_minutes IS NULL OR p_minutes NOT IN(0,60,1440) THEN
  RAISE EXCEPTION 'Adiamento inválido.' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.notifications WHERE id=p_id AND user_id=u FOR UPDATE;
 IF NOT FOUND OR NOT techerp_api.notification_center_item(p_workspace,u,p_id) THEN
  RAISE EXCEPTION 'Notificação indisponível ou contexto alterado.' USING ERRCODE='42501';END IF;
 UPDATE public.notifications SET snoozed_until=CASE WHEN p_minutes=0 THEN NULL
  ELSE statement_timestamp()+make_interval(mins=>p_minutes) END WHERE id=p_id AND user_id=u;
 GET DIAGNOSTICS updated=ROW_COUNT;RETURN jsonb_build_object('updated',updated);
END $$;
REVOKE ALL ON FUNCTION public.notification_center_snooze(uuid,uuid,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_snooze(uuid,uuid,integer) TO authenticated;

CREATE FUNCTION public.notification_center_preferences(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);p public.notification_user_preferences;legacy jsonb;BEGIN
 SELECT * INTO p FROM public.notification_user_preferences WHERE workspace_id=p_workspace AND user_id=u;
 SELECT notification_preferences INTO legacy FROM public.profiles WHERE id=u;
 RETURN jsonb_build_object('settings',coalesce(p.settings,'{}'::jsonb),'revision',coalesce(p.revision,0),'legacyPrefs',legacy);
END $$;
REVOKE ALL ON FUNCTION public.notification_center_preferences(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_preferences(uuid) TO authenticated;

CREATE FUNCTION public.notification_center_preferences_save(p_workspace uuid,p_patch jsonb,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);stored jsonb;result jsonb;
 current_revision integer;group_key text;entry record;channel record;group_value jsonb;q jsonb;new_revision integer;
 categories text[]:=ARRAY['mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'];
 event_types text[]:=ARRAY['mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval',
  'role_profile','role_profile_approval','hiring_approval','hiring_preparation_approval','hiring_formalization',
  'form_submission','portfolio_conflict','sequence_handoff','security_scan','platform_alert',
  'sla.first_response_breach','sla.resolution_breach','sla.at_risk'];
BEGIN
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
  OR octet_length(p_patch::text)>32768 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch)k
   WHERE k NOT IN('categories','eventOverrides','quiet','summary')) THEN
  RAISE EXCEPTION 'Preferências inválidas.' USING ERRCODE='22023';END IF;
 FOREACH group_key IN ARRAY ARRAY['categories','eventOverrides'] LOOP
  IF p_patch?group_key THEN
   IF jsonb_typeof(p_patch->group_key)<>'object' THEN
    RAISE EXCEPTION 'Grupo de preferências inválido.' USING ERRCODE='22023';END IF;
   FOR entry IN SELECT key,value FROM jsonb_each(p_patch->group_key) LOOP
    IF (group_key='categories' AND NOT entry.key=ANY(categories))
     OR (group_key='eventOverrides' AND NOT entry.key=ANY(ARRAY(SELECT 'legacy.'||t FROM unnest(event_types)t)))
     OR (entry.value<>'null'::jsonb AND jsonb_typeof(entry.value)<>'object') THEN
     RAISE EXCEPTION 'Grupo de preferências inválido.' USING ERRCODE='22023';END IF;
    IF entry.value<>'null'::jsonb THEN
     FOR channel IN SELECT key,value FROM jsonb_each(entry.value) LOOP
      IF channel.key NOT IN('inapp','email','sound','shake')
       OR jsonb_typeof(channel.value) NOT IN('boolean','null') THEN
       RAISE EXCEPTION 'Canal de preferência inválido.' USING ERRCODE='22023';END IF;
     END LOOP;
    END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_patch?'quiet' THEN
  q:=p_patch->'quiet';
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT(q?'enabled' AND q?'timezone' AND q?'start' AND q?'end')
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(q)k WHERE k NOT IN('enabled','timezone','start','end'))
   OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(q->'timezone') IS DISTINCT FROM 'string' OR length(q->>'timezone')>80
   OR (q->>'timezone'<>'UTC' AND strpos(q->>'timezone','/')=0)
   OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone'))
   OR jsonb_typeof(q->'start') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'end') IS DISTINCT FROM 'string'
   OR q->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR q->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   OR ((q->>'enabled')::boolean AND q->>'start'=q->>'end') THEN
   RAISE EXCEPTION 'Período de silêncio inválido.' USING ERRCODE='22023';END IF;
 END IF;
 IF p_patch?'summary' AND (jsonb_typeof(p_patch->'summary') IS DISTINCT FROM 'string'
  OR p_patch->>'summary' NOT IN('none','daily','weekly')) THEN
  RAISE EXCEPTION 'Resumo inválido.' USING ERRCODE='22023';END IF;
 -- Serialize both the first insert and subsequent revisions per user/workspace.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||u::text,0));
 SELECT settings,revision INTO stored,current_revision FROM public.notification_user_preferences
  WHERE workspace_id=p_workspace AND user_id=u FOR UPDATE;
 IF coalesce(current_revision,0)<>p_revision THEN
  -- A stale client revision is not a transient serialization failure. PT409
  -- returns HTTP 409 immediately instead of triggering PostgREST auto-retries.
  RAISE EXCEPTION 'As preferências foram alteradas em outra sessão. Recarregue e tente novamente.' USING ERRCODE='PT409';END IF;
 result:=coalesce(stored,'{}'::jsonb);
 FOREACH group_key IN ARRAY ARRAY['categories','eventOverrides'] LOOP
  IF p_patch?group_key THEN
   IF jsonb_typeof(result->group_key) IS DISTINCT FROM 'object' THEN result:=jsonb_set(result,ARRAY[group_key],'{}');END IF;
   FOR entry IN SELECT key,value FROM jsonb_each(p_patch->group_key) LOOP
    IF entry.value='null'::jsonb THEN result:=result#-ARRAY[group_key,entry.key];
    ELSE
     group_value:=result#>ARRAY[group_key,entry.key];
     IF jsonb_typeof(group_value) IS DISTINCT FROM 'object' THEN group_value:='{}';END IF;
     FOR channel IN SELECT key,value FROM jsonb_each(entry.value) LOOP
      IF channel.value='null'::jsonb THEN group_value:=group_value-channel.key;
      ELSE group_value:=jsonb_set(group_value,ARRAY[channel.key],channel.value);END IF;
     END LOOP;
     IF group_value='{}'::jsonb THEN result:=result#-ARRAY[group_key,entry.key];
     ELSE result:=jsonb_set(result,ARRAY[group_key,entry.key],group_value);END IF;
    END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_patch?'quiet' THEN result:=jsonb_set(result,'{quiet}',
  (CASE WHEN jsonb_typeof(result->'quiet')='object' THEN result->'quiet' ELSE '{}'::jsonb END)||(p_patch->'quiet'));END IF;
 IF p_patch?'summary' THEN result:=jsonb_set(result,'{summary}',p_patch->'summary');END IF;
 new_revision:=p_revision+1;
 INSERT INTO public.notification_user_preferences(workspace_id,user_id,revision,settings)
  VALUES(p_workspace,u,new_revision,result)
  ON CONFLICT(workspace_id,user_id) DO UPDATE SET revision=EXCLUDED.revision,settings=EXCLUDED.settings,updated_at=clock_timestamp();
 RETURN jsonb_build_object('settings',result,'revision',new_revision);
END $$;
REVOKE ALL ON FUNCTION public.notification_center_preferences_save(uuid,jsonb,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_center_preferences_save(uuid,jsonb,integer) TO authenticated;

-- Only trusted service dispatch can resolve somebody else's overlay. Stored
-- future keys survive writes but never widen a known channel's eligibility.
CREATE FUNCTION public.notification_event_inapp(p_workspace uuid,p_user uuid,p_event text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prefs jsonb;settings jsonb;category text;t text;value jsonb;q jsonb;section text;entry record;allowed boolean:=true;BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL
  OR p_workspace IS NULL OR p_user IS NULL OR p_event IS NULL
  OR NOT public.is_workspace_member(p_workspace,p_user) THEN RETURN false;END IF;
 t:=CASE WHEN left(p_event,7)='legacy.' THEN substr(p_event,8) END;
 category:=techerp_api.notification_center_category(t);
 IF category IS NULL THEN RETURN false;END IF;
 SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RETURN false;END IF;
 IF prefs IS NOT NULL AND prefs<>'null'::jsonb THEN
  IF jsonb_typeof(prefs)<>'object' THEN allowed:=false;
  ELSIF prefs?category THEN
   value:=prefs->category;
   allowed:=jsonb_typeof(value)='object' AND (NOT value?'inapp' OR value->'inapp'='true'::jsonb);
  END IF;
 END IF;
 SELECT p.settings INTO settings FROM public.notification_user_preferences p
  WHERE p.workspace_id=p_workspace AND p.user_id=p_user;
 -- Malformed known sections/groups or a malformed routine fail closed across
 -- the overlay, exactly as the shared TypeScript normalizer. Unknown future keys
 -- remain stored but cannot introduce recipients or known channel eligibility.
 IF settings IS NOT NULL THEN
  IF jsonb_typeof(settings)<>'object' THEN RETURN false;END IF;
  FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
   IF settings?section THEN
    IF jsonb_typeof(settings->section)<>'object' THEN RETURN false;END IF;
    FOR entry IN SELECT j.key,j.value FROM jsonb_each(settings->section)j LOOP
     IF ((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
      OR (section='eventOverrides' AND techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL))
      AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF settings?'quiet' THEN
   q:=settings->'quiet';
   IF jsonb_typeof(q)<>'object' OR NOT(q?'enabled' AND q?'timezone' AND q?'start' AND q?'end')
    OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(q->'timezone') IS DISTINCT FROM 'string' OR length(q->>'timezone')>80
    OR (q->>'timezone'<>'UTC' AND strpos(q->>'timezone','/')=0)
    OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone'))
    OR jsonb_typeof(q->'start') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'end') IS DISTINCT FROM 'string'
    OR q->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR q->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR (q->>'enabled'='true' AND q->>'start'=q->>'end') THEN RETURN false;END IF;
  END IF;
 END IF;
 IF settings#>ARRAY['categories',category,'inapp'] IS NOT NULL THEN
  allowed:=settings#>ARRAY['categories',category,'inapp']='true'::jsonb;
 END IF;
 IF settings#>ARRAY['eventOverrides',p_event,'inapp'] IS NOT NULL THEN
  allowed:=settings#>ARRAY['eventOverrides',p_event,'inapp']='true'::jsonb;
 END IF;
 RETURN coalesce(allowed,false);
END $$;
REVOKE ALL ON FUNCTION public.notification_event_inapp(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_event_inapp(uuid,uuid,text) TO service_role;

-- Reapply the package 2 gateway unchanged except for the workspace/event overlay
-- predicate. This additive migration never edits the historical migration.
CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record WHEN 'people' THEN '/people/'||p_record
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    inapp:=public.notification_event_inapp(w,recipient,'legacy.workflow');
    IF NOT coalesce(inapp,false) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');CONTINUE;
    END IF;
    dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;
    created:=NULL;
    INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
    IF created IS NOT NULL THEN sent_count:=sent_count+1;
    ELSIF EXISTS(SELECT 1 FROM public.notifications WHERE dedupe_key=dedupe) THEN duplicate_count:=duplicate_count+1;
    ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count);
END $$;
ALTER FUNCTION public.notification_workflow_dispatch(uuid,uuid,integer,text,uuid,jsonb,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notification_workflow_dispatch(uuid,uuid,integer,text,uuid,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_workflow_dispatch(uuid,uuid,integer,text,uuid,jsonb,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
