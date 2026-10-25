-- Ordem 5: shared surfaces. No role/default/override/membership grants.
CREATE OR REPLACE FUNCTION public.shared_context_access(c jsonb,w uuid,r text,a text,owners uuid[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'actor' IS NOT NULL AND c->>'workspace'=w::text
 AND r=ANY(ARRAY['system.files','system.files_share','system.home','system.settings','system.branding','system.custom_objects','system.custom_properties','system.members','system.ai_settings','system.messenger','system.media','system.modules'])
 AND a IN('view','create','update','delete','export','manage')
 AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true))
 AND (c->'keys' ? (r||'.'||a||'.workspace')
  OR (c->'keys' ? (r||'.'||a||'.own') AND (c->>'actor')::uuid=ANY(owners))
  OR (c->'keys' ? (r||'.'||a||'.team') AND ((c->>'actor')::uuid=ANY(owners) OR EXISTS(SELECT 1 FROM unnest(owners)x WHERE c->'team'?x::text)))),false)
$$;
REVOKE ALL ON FUNCTION public.shared_context_access(jsonb,uuid,text,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_context_access(jsonb,uuid,text,text,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_area_authorize(r text,a text DEFAULT 'view')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;BEGIN
 IF NOT shared_context_access(c,w,r,'view',CASE WHEN r IN('system.files','system.files_share','system.media','system.messenger') THEN ARRAY[u] ELSE ARRAY[]::uuid[] END) OR NOT shared_context_access(c,w,r,a,CASE WHEN r IN('system.files','system.files_share','system.media','system.messenger') THEN ARRAY[u] ELSE ARRAY[]::uuid[] END) THEN
 RAISE EXCEPTION 'Sem permissão para esta área compartilhada.' USING ERRCODE='42501';END IF;RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.shared_area_authorize(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_area_authorize(text,text) TO authenticated;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.view.own','system','files_share','view','own','Compartilhamento público de arquivos — view (own)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.view.team','system','files_share','view','team','Compartilhamento público de arquivos — view (team)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.view.workspace','system','files_share','view','workspace','Compartilhamento público de arquivos — view (workspace)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.manage.own','system','files_share','manage','own','Compartilhamento público de arquivos — manage (own)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.manage.team','system','files_share','manage','team','Compartilhamento público de arquivos — manage (team)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files_share.manage.workspace','system','files_share','manage','workspace','Compartilhamento público de arquivos — manage (workspace)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.ai_settings.view.workspace','system','ai_settings','view','workspace','Configurações de IA — view (workspace)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.ai_settings.manage.workspace','system','ai_settings','manage','workspace','Configurações de IA — manage (workspace)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.messenger.view.own','system','messenger','view','own','Mensageiro interno — view (own)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.messenger.create.own','system','messenger','create','own','Mensageiro interno — create (own)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.messenger.manage.own','system','messenger','manage','own','Mensageiro interno — manage (own)','Exige workspace selecionado, membro ativo, ação efetiva, deny e vínculo real. Não concede acesso automaticamente.',true) ON CONFLICT(key) DO NOTHING;

-- Parent references and identity are validated even through direct PostgREST.
CREATE OR REPLACE FUNCTION public.shared_structure_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j jsonb:=to_jsonb(NEW);o jsonb;w uuid:=(j->>'workspace_id')::uuid;p uuid;parent jsonb;c jsonb;bytes bigint;
BEGIN
 IF TG_OP='UPDATE' THEN
  o:=to_jsonb(OLD);
  IF j->>'workspace_id' IS DISTINCT FROM o->>'workspace_id' OR j->>'owner_id' IS DISTINCT FROM o->>'owner_id' THEN
   RAISE EXCEPTION 'Identidade e workspace são imutáveis.' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME IN('user_files','user_file_folders') THEN
  p:=nullif(j->>CASE WHEN TG_TABLE_NAME='user_files' THEN 'folder_id' ELSE 'parent_id' END,'')::uuid;
  IF p IS NOT NULL THEN
   SELECT to_jsonb(x) INTO parent FROM user_file_folders x WHERE x.id=p;
   IF parent IS NULL OR parent->>'workspace_id' IS DISTINCT FROM w::text OR parent->>'owner_id' IS DISTINCT FROM j->>'owner_id' OR (TG_TABLE_NAME='user_file_folders' AND p=(j->>'id')::uuid) THEN
    RAISE EXCEPTION 'Pasta de destino indisponível.' USING ERRCODE='42501';END IF;
   IF TG_TABLE_NAME='user_file_folders' AND TG_OP='UPDATE' THEN
    IF EXISTS(WITH RECURSIVE ancestors AS (SELECT id,parent_id,ARRAY[id] path FROM user_file_folders WHERE id=p UNION ALL SELECT x.id,x.parent_id,a.path||x.id FROM user_file_folders x JOIN ancestors a ON x.id=a.parent_id WHERE NOT x.id=ANY(a.path)) SELECT 1 FROM ancestors WHERE id=OLD.id) THEN
     RAISE EXCEPTION 'Ciclo de pastas não permitido.' USING ERRCODE='23514';END IF;
   END IF;
  END IF;
  IF TG_TABLE_NAME='user_files' THEN
   IF TG_OP='INSERT' AND auth.uid() IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id='user-files' AND x.name=j->>'storage_path' AND x.owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Upload não encontrado.' USING ERRCODE='42501';END IF;
    IF EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id='user-files' AND x.name=j->>'storage_path' AND nullif(x.metadata->>'size','')::bigint IS DISTINCT FROM (j->>'size_bytes')::bigint) THEN RAISE EXCEPTION 'Tamanho de arquivo divergente.' USING ERRCODE='23514';END IF;
    PERFORM pg_advisory_xact_lock(hashtext(j->>'owner_id'));
    SELECT coalesce(sum(size_bytes),0) INTO bytes FROM user_files WHERE owner_id=(j->>'owner_id')::uuid;
    IF bytes+(j->>'size_bytes')::bigint>104857600 THEN RAISE EXCEPTION 'Cota de arquivos excedida.' USING ERRCODE='23514';END IF;
   END IF;
   IF j->>'storage_path' NOT LIKE (j->>'owner_id')||'/%' OR j->>'storage_path' ~ '(^|/)\.\.(/|$)' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE='42501';END IF;
   IF TG_OP='UPDATE' AND (j->>'storage_path' IS DISTINCT FROM o->>'storage_path' OR j->>'size_bytes' IS DISTINCT FROM o->>'size_bytes' OR j->>'mime_type' IS DISTINCT FROM o->>'mime_type') THEN RAISE EXCEPTION 'Objeto armazenado é imutável.' USING ERRCODE='42501';END IF;
   IF coalesce((j->>'is_public')::boolean,false) OR (TG_OP='UPDATE' AND (j->>'is_public' IS DISTINCT FROM o->>'is_public' OR j->>'public_token' IS DISTINCT FROM o->>'public_token')) THEN
    c:=work_access_context();
    IF auth.uid() IS NOT NULL AND NOT shared_context_access(c,w,'system.files_share','manage',ARRAY[(j->>'owner_id')::uuid]) THEN RAISE EXCEPTION 'Sem permissão para compartilhar arquivo.' USING ERRCODE='42501';END IF;
   END IF;
  END IF;
 ELSIF TG_TABLE_NAME='custom_object_records' THEN
  SELECT to_jsonb(x) INTO parent FROM custom_objects x WHERE x.id=(j->>'object_id')::uuid;
  IF parent IS NULL OR parent->>'workspace_id' IS DISTINCT FROM w::text OR (TG_OP='UPDATE' AND j->>'object_id' IS DISTINCT FROM o->>'object_id') THEN RAISE EXCEPTION 'Objeto de origem indisponível.' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shared_structure_guard() FROM PUBLIC,anon,authenticated;
-- Public download is a revocable, scoped capability, never a raw anonymous table read.
CREATE OR REPLACE FUNCTION public.shared_public_file_available(i uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f user_files;c jsonb;BEGIN
 SELECT * INTO f FROM user_files WHERE id=i;
 IF NOT FOUND OR NOT f.is_public OR f.public_token IS NULL THEN RETURN false;END IF;
 c:=work_subject_context(f.workspace_id,f.owner_id);
 RETURN shared_context_access(c,f.workspace_id,'system.files','view',ARRAY[f.owner_id]) AND shared_context_access(c,f.workspace_id,'system.files_share','manage',ARRAY[f.owner_id]);
END $$;
REVOKE ALL ON FUNCTION public.shared_public_file_available(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shared_public_file_available(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shared_chat_access(i uuid,a text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();v chat_conversations;u uuid:=(c->>'actor')::uuid;BEGIN
 SELECT * INTO v FROM chat_conversations WHERE id=i;
 RETURN FOUND AND shared_context_access(c,v.workspace_owner_id,'system.messenger','view',ARRAY[u])
 AND shared_context_access(c,v.workspace_owner_id,'system.messenger',a,ARRAY[u])
 AND EXISTS(SELECT 1 FROM chat_conversation_members WHERE conversation_id=i AND user_id=u)
 AND (a<>'manage' OR v.created_by=u);
END $$;
REVOKE ALL ON FUNCTION public.shared_chat_access(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_chat_access(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_chat_write(a text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;w uuid;u uuid;i uuid;ids uuid[];v chat_conversations;att jsonb;BEGIN
 c:=shared_area_authorize('system.messenger',CASE WHEN a='invite' THEN 'manage' ELSE 'create' END);
 w:=(c->>'workspace')::uuid;u:=(c->>'actor')::uuid;
 IF a IN('dm','group') THEN
  IF jsonb_typeof(p->'members')<>'array' OR jsonb_array_length(p->'members')>50 OR (a='group' AND length(trim(coalesce(p->>'title',''))) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Participantes ou título inválidos.';END IF;
  SELECT array_agg(DISTINCT x) INTO ids FROM unnest(ARRAY[u]||(SELECT array_agg(value::uuid) FROM jsonb_array_elements_text(p->'members')))x;
  IF cardinality(ids)<2 OR cardinality(ids)>51 OR EXISTS(SELECT 1 FROM unnest(ids)x WHERE NOT is_workspace_member(w,x)) THEN RAISE EXCEPTION 'Participantes indisponíveis.' USING ERRCODE='42501';END IF;
  IF a='dm' THEN
   IF cardinality(ids)<>2 THEN RAISE EXCEPTION 'Conversa direta exige dois participantes.';END IF;
   PERFORM pg_advisory_xact_lock(hashtext(w::text||ids::text));
   SELECT id INTO i FROM chat_conversations z WHERE z.workspace_owner_id=w AND kind='dm'
    AND ARRAY(SELECT user_id FROM chat_conversation_members WHERE conversation_id=z.id ORDER BY user_id)=ARRAY(SELECT x FROM unnest(ids)x ORDER BY x) LIMIT 1;
  END IF;
  IF i IS NULL THEN
   INSERT INTO chat_conversations(workspace_owner_id,kind,title,created_by) VALUES(w,CASE WHEN a='dm' THEN 'dm' ELSE 'group' END,CASE WHEN a='group' THEN left(p->>'title',120) END,u) RETURNING id INTO i;
   INSERT INTO chat_conversation_members(conversation_id,user_id) SELECT i,x FROM unnest(ids)x;
  END IF;
  RETURN jsonb_build_object('conversation_id',i);
 END IF;
 i:=(p->>'conversation_id')::uuid;
 IF NOT shared_chat_access(i,CASE WHEN a='invite' THEN 'manage' ELSE 'create' END) THEN RAISE EXCEPTION 'Conversa indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM chat_conversations WHERE id=i FOR UPDATE;
 IF a='invite' THEN
  IF v.kind<>'group' THEN RAISE EXCEPTION 'Apenas grupos aceitam participantes.';END IF;
  SELECT array_agg(DISTINCT value::uuid) INTO ids FROM jsonb_array_elements_text(p->'members');
  IF coalesce(cardinality(ids),0)=0 OR cardinality(ids)>50 OR EXISTS(SELECT 1 FROM unnest(ids)x WHERE NOT is_workspace_member(w,x)) THEN RAISE EXCEPTION 'Participantes indisponíveis.' USING ERRCODE='42501';END IF;
  INSERT INTO chat_conversation_members(conversation_id,user_id) SELECT i,x FROM unnest(ids)x ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok',true,'added',cardinality(ids));
 ELSIF a='send' THEN
  IF length(coalesce(p->>'body',''))>8000 OR jsonb_array_length(coalesce(p->'attachments','[]'))>10 OR (length(trim(coalesce(p->>'body','')))=0 AND jsonb_array_length(coalesce(p->'attachments','[]'))=0) THEN RAISE EXCEPTION 'Mensagem inválida.';END IF;
  FOR att IN SELECT value FROM jsonb_array_elements(coalesce(p->'attachments','[]')) LOOP
   IF NOT EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id='chat-attachments' AND x.name=att->>'storage_path' AND (x.owner=u OR x.owner_id=u::text)) THEN RAISE EXCEPTION 'Anexo não pertence ao remetente.' USING ERRCODE='42501';END IF;
   IF att->>'storage_path' NOT LIKE 'ws/'||i::text||'/'||(p->>'message_id')||'/%' OR att->>'storage_path' ~ '(^|/)\.\.(/|$)' THEN RAISE EXCEPTION 'Anexo de outra conversa.' USING ERRCODE='42501';END IF;
  END LOOP;
  INSERT INTO chat_messages(id,conversation_id,workspace_owner_id,sender_user_id,body) VALUES((p->>'message_id')::uuid,i,w,u,nullif(trim(p->>'body'),''));
  INSERT INTO chat_message_attachments(message_id,storage_path,file_name,mime_type,size_bytes) SELECT (p->>'message_id')::uuid,x->>'storage_path',left(x->>'file_name',255),left(x->>'mime_type',100),(x->>'size_bytes')::bigint FROM jsonb_array_elements(coalesce(p->'attachments','[]'))x;
  UPDATE chat_conversation_members SET last_read_at=now() WHERE conversation_id=i AND user_id=u;
  RETURN jsonb_build_object('message_id',p->>'message_id');
 END IF;
 RAISE EXCEPTION 'Operação desconhecida.' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.shared_chat_write(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_chat_write(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_search_item_access(e text,i text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t text;result boolean;w uuid:=(work_access_context()->>'workspace')::uuid;BEGIN
 t:=CASE e WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies' WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' WHEN 'activity' THEN 'activities' WHEN 'candidate' THEN 'ats_candidates' WHEN 'job' THEN 'ats_jobs' END;
 IF t IS NULL OR w IS NULL OR i IS NULL OR i !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',t) INTO result USING i::uuid,w;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.shared_search_item_access(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_search_item_access(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_security_settings(p jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_area_authorize('system.settings',CASE WHEN p IS NULL THEN 'view' ELSE 'manage' END);w uuid:=(c->>'workspace')::uuid;v jsonb;BEGIN
 IF p IS NOT NULL THEN
  IF p-ARRAY['security','region']<>'{}' OR (p?'region' AND p->>'region' NOT IN('BR','US','EU')) OR (p?'security' AND (jsonb_typeof(p->'security')<>'object' OR p->'security'-ARRAY['ip_allowlist','ip_allowlist_enabled','session_timeout_minutes','require_mfa','force_sso']<>'{}')) THEN RAISE EXCEPTION 'Configuração inválida.' USING ERRCODE='22023';END IF;
  IF jsonb_typeof(p)<>'object' OR (p?'region' AND (jsonb_typeof(p->'region')<>'string' OR p->>'region' NOT IN('BR','US','EU'))) THEN RAISE EXCEPTION 'Configuração inválida.' USING ERRCODE='22023';END IF;
  IF p?'security' THEN
   IF EXISTS(SELECT 1 FROM jsonb_each(p->'security') x WHERE x.key IN('ip_allowlist_enabled','require_mfa','force_sso') AND jsonb_typeof(x.value)<>'boolean') THEN RAISE EXCEPTION 'Opção de segurança inválida.' USING ERRCODE='22023';END IF;
   IF (p->'security')?'session_timeout_minutes' THEN
    IF jsonb_typeof(p->'security'->'session_timeout_minutes')<>'number' OR p->'security'->>'session_timeout_minutes' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Tempo de sessão inválido.' USING ERRCODE='22023';END IF;
    IF (p->'security'->>'session_timeout_minutes')::numeric NOT BETWEEN 15 AND 1440 THEN RAISE EXCEPTION 'Tempo de sessão inválido.' USING ERRCODE='22023';END IF;
   END IF;
   IF (p->'security')?'ip_allowlist' THEN
    IF jsonb_typeof(p->'security'->'ip_allowlist')<>'array' THEN RAISE EXCEPTION 'Lista de IPs inválida.' USING ERRCODE='22023';END IF;
    IF jsonb_array_length(p->'security'->'ip_allowlist')>50 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'security'->'ip_allowlist') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 64) THEN RAISE EXCEPTION 'Lista de IPs inválida.' USING ERRCODE='22023';END IF;
   END IF;
  END IF;
  UPDATE workspaces SET security_settings=CASE WHEN p?'security' THEN coalesce(security_settings,'{}')||(p->'security') ELSE security_settings END,data_region=CASE WHEN p?'region' THEN p->>'region' ELSE data_region END WHERE id=w;
 END IF;
 SELECT jsonb_build_object('workspaceId',w,'security',coalesce(security_settings,'{}'),'dataRegion',coalesce(data_region,'BR')) INTO v FROM workspaces WHERE id=w;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.shared_security_settings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_security_settings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.shared_file_authorize(t text,i uuid,a text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();j jsonb;BEGIN
 IF t NOT IN('user_files','user_file_folders') OR i IS NULL THEN RAISE EXCEPTION 'Arquivo indisponível.' USING ERRCODE='42501';END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=$1',t) INTO j USING i;
 IF j IS NULL OR NOT shared_context_access(c,(j->>'workspace_id')::uuid,'system.files','view',ARRAY[(j->>'owner_id')::uuid]) OR NOT shared_context_access(c,(j->>'workspace_id')::uuid,'system.files',a,ARRAY[(j->>'owner_id')::uuid]) THEN RAISE EXCEPTION 'Arquivo indisponível ou sem permissão.' USING ERRCODE='42501';END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.shared_file_authorize(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_file_authorize(text,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_file_capabilities(t text,ids uuid[])
RETURNS TABLE(id uuid,can_update boolean,can_delete boolean,can_export boolean,can_share boolean,public_token text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();j jsonb;w uuid;o uuid[];share boolean;BEGIN
 IF t NOT IN('user_files','user_file_folders') OR cardinality(ids)>2000 THEN RAISE EXCEPTION 'Consulta inválida.';END IF;
 FOR j IN EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=ANY($1)',t) USING ids LOOP
  w:=(j->>'workspace_id')::uuid;o:=ARRAY[(j->>'owner_id')::uuid];
  IF NOT shared_context_access(c,w,'system.files','view',o) THEN CONTINUE;END IF;
  share:=t='user_files' AND shared_context_access(c,w,'system.files_share','manage',o);
  RETURN QUERY SELECT (j->>'id')::uuid,shared_context_access(c,w,'system.files','update',o),shared_context_access(c,w,'system.files','delete',o),shared_context_access(c,w,'system.files','export',o),share,CASE WHEN share THEN j->>'public_token' END;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.shared_file_capabilities(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_file_capabilities(text,uuid[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_file_share(i uuid,enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();f user_files;token text;BEGIN
 SELECT * INTO f FROM user_files WHERE id=i FOR UPDATE;
 IF NOT FOUND OR enabled IS NULL OR NOT shared_context_access(c,f.workspace_id,'system.files','view',ARRAY[f.owner_id]) OR NOT shared_context_access(c,f.workspace_id,'system.files_share','manage',ARRAY[f.owner_id]) THEN RAISE EXCEPTION 'Compartilhamento não autorizado.' USING ERRCODE='42501';END IF;
 token:=CASE WHEN enabled THEN replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','') END;
 UPDATE user_files SET is_public=enabled,public_token=token WHERE id=i;
 RETURN jsonb_build_object('is_public',enabled,'public_token',token);
END $$;
REVOKE ALL ON FUNCTION public.shared_file_share(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_file_share(uuid,boolean) TO authenticated;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files.export.own','system','files','export','own','Baixar arquivos — own','Baixar conteúdo autorizado; exige leitura e escopo real. Sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.files.export.team','system','files','export','team','Baixar arquivos — team','Baixar conteúdo autorizado; exige leitura e escopo real. Sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.view.own','system','media','view','own','Biblioteca de mídia — view (own)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.view.team','system','media','view','team','Biblioteca de mídia — view (team)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.view.workspace','system','media','view','workspace','Biblioteca de mídia — view (workspace)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.create.own','system','media','create','own','Biblioteca de mídia — create (own)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.create.team','system','media','create','team','Biblioteca de mídia — create (team)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.create.workspace','system','media','create','workspace','Biblioteca de mídia — create (workspace)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.delete.own','system','media','delete','own','Biblioteca de mídia — delete (own)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.delete.team','system','media','delete','team','Biblioteca de mídia — delete (team)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.delete.workspace','system','media','delete','workspace','Biblioteca de mídia — delete (workspace)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.manage.own','system','media','manage','own','Biblioteca de mídia — manage (own)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.manage.team','system','media','manage','team','Biblioteca de mídia — manage (team)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.media.manage.workspace','system','media','manage','workspace','Biblioteca de mídia — manage (workspace)','Exige membro ativo, tenant selecionado e vínculo real; sem concessão automática.',true) ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.shared_upload_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),actor_id uuid NOT NULL REFERENCES auth.users(id),path text UNIQUE NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),consumed_at timestamptz);
ALTER TABLE public.shared_upload_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_upload_receipts FROM PUBLIC,anon,authenticated;
CREATE INDEX shared_upload_actor_time ON public.shared_upload_receipts(actor_id,created_at);
CREATE OR REPLACE FUNCTION public.shared_media_begin(filename text,folder text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_area_authorize('system.media','create');w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;p text;BEGIN
 IF filename IS NULL OR length(filename)>200 OR filename ~ '[^a-zA-Z0-9_.-]' OR filename IN('','..','.') OR folder IS NOT NULL AND folder<>'branding' THEN RAISE EXCEPTION 'Nome de arquivo inválido.';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('media:'||u::text));
 IF (SELECT count(*) FROM shared_upload_receipts WHERE actor_id=u AND created_at>now()-interval '1 hour')>=100 THEN RAISE EXCEPTION 'Limite técnico de uploads atingido.' USING ERRCODE='54000';END IF;
 p:=w::text||'/'||CASE WHEN folder IS NULL THEN '' ELSE folder||'/' END||to_char(now(),'YYYY/MM')||'/'||gen_random_uuid()::text||'-'||filename;
 INSERT INTO shared_upload_receipts(workspace_id,actor_id,path) VALUES(w,u,p);RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.shared_media_begin(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_media_begin(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_media_register(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_area_authorize('system.media','create');w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;v shared_upload_receipts;o storage.objects;j jsonb;BEGIN
 SELECT * INTO v FROM shared_upload_receipts WHERE path=p->>'path' AND actor_id=u AND workspace_id=w AND consumed_at IS NULL AND created_at>now()-interval '1 hour' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Upload indisponível ou já registrado.' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM storage.objects WHERE bucket_id='media' AND name=v.path;
 IF NOT FOUND THEN RAISE EXCEPTION 'Objeto armazenado não encontrado.' USING ERRCODE='42501';END IF;
 INSERT INTO media_assets(workspace_id,owner_user_id,bucket,path,filename,mime,size_bytes,width,height,url,url_expires_at) VALUES(w,u,'media',v.path,left(p->>'filename',200),coalesce(o.metadata->>'mimetype',p->>'mime'),coalesce((o.metadata->>'size')::bigint,(p->>'size_bytes')::bigint),(p->>'width')::integer,(p->>'height')::integer,p->>'url',(p->>'url_expires_at')::timestamptz) RETURNING to_jsonb(media_assets) INTO j;
 UPDATE shared_upload_receipts SET consumed_at=now() WHERE id=v.id;RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.shared_media_register(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_media_register(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_media_authorize(i uuid,a text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();v media_assets;BEGIN
 SELECT * INTO v FROM media_assets WHERE id=i;
 IF NOT FOUND OR NOT shared_context_access(c,v.workspace_id,'system.media','view',ARRAY[v.owner_user_id]) OR NOT shared_context_access(c,v.workspace_id,'system.media',a,ARRAY[v.owner_user_id]) THEN RAISE EXCEPTION 'Mídia indisponível.' USING ERRCODE='42501';END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.shared_media_authorize(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_media_authorize(uuid,text) TO authenticated;

-- Storage calls use the JWT actor again; database rows are never inferred from a URL supplied by the caller.
CREATE OR REPLACE FUNCTION public.shared_storage_access(b text,p text,a text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;i uuid;
BEGIN
 IF u IS NULL OR p IS NULL OR p='' OR p ~ '(^|/)\.\.(/|$)' OR a NOT IN('view','create','update','delete') OR (a<>'view' AND coalesce((c->>'read_only')::boolean,true)) THEN RETURN false;END IF;
 IF a='update' THEN RETURN false;END IF;
 IF b='user-files' THEN
  IF EXISTS(SELECT 1 FROM user_files WHERE storage_path=p) THEN
   RETURN a<>'create' AND EXISTS(SELECT 1 FROM user_files f WHERE f.storage_path=p AND shared_context_access(c,f.workspace_id,'system.files','view',ARRAY[f.owner_id]) AND shared_context_access(c,f.workspace_id,'system.files',CASE WHEN a='view' THEN 'export' ELSE a END,ARRAY[f.owner_id]));
  END IF;
  RETURN split_part(p,'/',1)=u::text AND shared_context_access(c,w,'system.files','view',ARRAY[u]) AND shared_context_access(c,w,'system.files','create',ARRAY[u]);
 ELSIF b='media' THEN
  IF EXISTS(SELECT 1 FROM media_assets WHERE bucket='media' AND path=p) THEN
   RETURN a<>'create' AND EXISTS(SELECT 1 FROM media_assets f WHERE f.bucket='media' AND f.path=p AND shared_context_access(c,f.workspace_id,'system.media','view',ARRAY[f.owner_user_id]) AND shared_context_access(c,f.workspace_id,'system.media',a,ARRAY[f.owner_user_id]));
  END IF;
  RETURN EXISTS(SELECT 1 FROM shared_upload_receipts v WHERE v.path=p AND v.actor_id=u AND v.workspace_id=w AND v.consumed_at IS NULL AND v.created_at>now()-interval '1 hour') AND shared_context_access(c,w,'system.media','view',ARRAY[u]) AND shared_context_access(c,w,'system.media','create',ARRAY[u]);
 ELSIF b='chat-attachments' THEN
  BEGIN i:=split_part(p,'/',2)::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN false;END;
  IF NOT shared_chat_access(i,CASE WHEN a='create' THEN 'create' ELSE 'view' END) THEN RETURN false;END IF;
  IF a='create' THEN RETURN true;END IF;
  IF a='view' THEN RETURN EXISTS(SELECT 1 FROM chat_message_attachments x JOIN chat_messages m ON m.id=x.message_id WHERE x.storage_path=p AND m.conversation_id=i AND m.deleted_at IS NULL) OR (shared_chat_access(i,'create') AND EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id=b AND x.name=p AND (x.owner=u OR x.owner_id=u::text)));END IF;
  RETURN shared_chat_access(i,'manage') OR (shared_chat_access(i,'create') AND (EXISTS(SELECT 1 FROM chat_message_attachments x JOIN chat_messages m ON m.id=x.message_id WHERE x.storage_path=p AND m.conversation_id=i AND m.sender_user_id=u) OR EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id=b AND x.name=p AND (x.owner=u OR x.owner_id=u::text))));
 ELSIF b='whatsapp-media' THEN
  IF EXISTS(SELECT 1 FROM whatsapp_messages WHERE media_url=p) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM whatsapp_messages x WHERE x.media_url=p AND sales_record_access('whatsapp_messages',x.id,'view'));
  END IF;
  RETURN split_part(p,'/',1)=u::text AND sales_context_access(c,w,'techsales.inbox.whatsapp','view',ARRAY[u]) AND sales_context_access(c,w,'techsales.inbox.whatsapp','create',ARRAY[u]);
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.shared_storage_access(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_storage_access(text,text,text) TO authenticated;

-- All existing bucket policies also require a current, active selected workspace.
-- Domain-specific predicates remain in force; this never grants object access.
CREATE OR REPLACE FUNCTION public.shared_storage_session_access(a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH ctx AS MATERIALIZED(SELECT public.work_access_context() c)
 SELECT coalesce(c->>'actor' IS NOT NULL AND c->>'workspace' IS NOT NULL AND a IN('view','create','update','delete') AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true)),false) FROM ctx
$$;
REVOKE ALL ON FUNCTION public.shared_storage_session_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_storage_session_access(text) TO authenticated;
