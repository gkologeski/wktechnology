-- Personal credentials remain private even if a user has workspace-scoped Inbox grants.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techsales.inbox.linkedin.view.own','techsales','inbox.linkedin','view','own','Ver Inbox LinkedIn pessoal','Ler conversas da própria conta no workspace ativo.',true),
('techsales.inbox.linkedin.create.own','techsales','inbox.linkedin','create','own','Enviar na Inbox LinkedIn pessoal','Responder pela própria conta, sujeito às proteções Unipile.',true),
('techsales.inbox.linkedin.manage.own','techsales','inbox.linkedin','manage','own','Gerenciar Inbox LinkedIn pessoal','Associar entidades e controlar atendimento da própria conta.',true)
ON CONFLICT(key) DO NOTHING;
CREATE FUNCTION public.linkedin_inbox_access(c jsonb,w uuid,o uuid,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT public.unipile_personal_access(c,w,o,CASE WHEN a='view' THEN 'view' ELSE 'manage' END)
 AND coalesce((c->'keys'->>'techsales.inbox.linkedin.view.own')::boolean,false)
 AND a IN('view','create','manage') AND coalesce((c->'keys'->>('techsales.inbox.linkedin.'||a||'.own'))::boolean,false)
$$;
REVOKE ALL ON FUNCTION public.linkedin_inbox_access(jsonb,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.linkedin_inbox_access(jsonb,uuid,uuid,text) TO authenticated,service_role;
CREATE UNIQUE INDEX unipile_account_tenant_owner ON public.unipile_accounts(id,workspace_id,owner_id);
CREATE TABLE public.linkedin_conversations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,owner_id uuid NOT NULL,account_id uuid NOT NULL,
 provider_chat_id text NOT NULL,sender_id text NOT NULL,title text NOT NULL,snippet text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')),last_message_at timestamptz NOT NULL DEFAULT now(),
 contact_id uuid REFERENCES public.contacts(id),lead_id uuid REFERENCES public.leads(id),company_id uuid REFERENCES public.companies(id),deal_id uuid REFERENCES public.deals(id),
 assigned_to uuid REFERENCES auth.users(id),
 identity_status text NOT NULL DEFAULT 'unresolved',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,provider_chat_id),UNIQUE(id,workspace_id),UNIQUE(id,workspace_id,account_id),
 FOREIGN KEY(account_id,workspace_id,owner_id) REFERENCES public.unipile_accounts(id,workspace_id,owner_id)
);
CREATE INDEX linkedin_conversations_recent ON public.linkedin_conversations(workspace_id,owner_id,last_message_at DESC,id);
CREATE TABLE public.linkedin_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,conversation_id uuid NOT NULL,account_id uuid NOT NULL,
 provider_message_id text NOT NULL,direction text NOT NULL CHECK(direction IN('inbound','outbound')),body text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conversation_id,workspace_id,account_id) REFERENCES public.linkedin_conversations(id,workspace_id,account_id),
 UNIQUE(account_id,provider_message_id)
);
CREATE INDEX linkedin_messages_history ON public.linkedin_messages(conversation_id,created_at DESC,id DESC);
ALTER TABLE public.linkedin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_conversations,public.linkedin_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_conversations,public.linkedin_messages TO authenticated;
GRANT ALL ON public.linkedin_conversations,public.linkedin_messages TO service_role;
CREATE POLICY linkedin_conversation_read ON public.linkedin_conversations FOR SELECT TO authenticated USING(
 public.linkedin_inbox_access((SELECT public.work_access_context()),workspace_id,owner_id,'view'));
CREATE POLICY linkedin_message_read ON public.linkedin_messages FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.linkedin_conversations c WHERE c.id=conversation_id AND c.workspace_id=linkedin_messages.workspace_id));
CREATE FUNCTION public.linkedin_project_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts;cid uuid;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=NEW.account_id;
 IF a.workspace_id IS NULL THEN RAISE EXCEPTION 'Account tenant unavailable';END IF;
 INSERT INTO public.linkedin_conversations(workspace_id,owner_id,account_id,provider_chat_id,sender_id,title,snippet,last_message_at)
 VALUES(a.workspace_id,a.owner_id,a.id,NEW.chat_id,NEW.sender_id,NEW.sender_id,left(coalesce(NEW.body,''),240),NEW.created_at)
 ON CONFLICT(account_id,provider_chat_id) DO UPDATE SET snippet=EXCLUDED.snippet,last_message_at=EXCLUDED.last_message_at,status='open' RETURNING id INTO cid;
 INSERT INTO public.linkedin_messages(workspace_id,conversation_id,account_id,provider_message_id,direction,body,created_at)
 VALUES(a.workspace_id,cid,a.id,NEW.provider_message_id,'inbound',coalesce(NEW.body,''),NEW.created_at) ON CONFLICT(account_id,provider_message_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.linkedin_project_inbound() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER linkedin_inbound_projection AFTER INSERT ON public.unipile_inbound_messages FOR EACH ROW EXECUTE FUNCTION public.linkedin_project_inbound();
-- Projection of an already-existing private journal (no provider requests).
INSERT INTO public.linkedin_conversations(workspace_id,owner_id,account_id,provider_chat_id,sender_id,title,snippet,last_message_at)
SELECT DISTINCT ON(m.account_id,m.chat_id) a.workspace_id,a.owner_id,a.id,m.chat_id,m.sender_id,m.sender_id,left(coalesce(m.body,''),240),m.created_at
FROM public.unipile_inbound_messages m JOIN public.unipile_accounts a ON a.id=m.account_id WHERE a.workspace_id IS NOT NULL ORDER BY m.account_id,m.chat_id,m.created_at DESC,m.id DESC;
INSERT INTO public.linkedin_messages(workspace_id,conversation_id,account_id,provider_message_id,direction,body,created_at)
SELECT c.workspace_id,c.id,m.account_id,m.provider_message_id,'inbound',coalesce(m.body,''),m.created_at FROM public.unipile_inbound_messages m JOIN public.linkedin_conversations c ON c.account_id=m.account_id AND c.provider_chat_id=m.chat_id;
CREATE FUNCTION public.linkedin_conversation_edit(p_id uuid,p_status text DEFAULT NULL,p_entity_type text DEFAULT NULL,p_entity uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.linkedin_conversations;ctx jsonb:=public.work_access_context();t text;w uuid;
BEGIN
 SELECT * INTO c FROM public.linkedin_conversations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.linkedin_inbox_access(ctx,c.workspace_id,c.owner_id,'manage') THEN RAISE EXCEPTION 'Conversation unauthorized' USING ERRCODE='42501';END IF;
 IF p_status IS NOT NULL THEN
 IF p_status NOT IN('open','closed') THEN RAISE EXCEPTION 'Invalid status';END IF;
 UPDATE public.linkedin_conversations SET status=p_status WHERE id=c.id;RETURN;END IF;
 t:=CASE p_entity_type WHEN 'contact' THEN 'contacts' WHEN 'lead' THEN 'leads' WHEN 'company' THEN 'companies' WHEN 'deal' THEN 'deals' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Invalid entity';END IF;
 IF p_entity IS NOT NULL THEN
 IF NOT public.sales_record_access(t,p_entity,'view') THEN RAISE EXCEPTION 'Entity unauthorized' USING ERRCODE='42501';END IF;
 EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',t) INTO w USING p_entity;
 IF w IS DISTINCT FROM c.workspace_id THEN RAISE EXCEPTION 'Entity tenant mismatch' USING ERRCODE='42501';END IF;
 END IF;
 EXECUTE format('UPDATE public.linkedin_conversations SET %I=$1,identity_status=''manual'' WHERE id=$2',p_entity_type||'_id') USING p_entity,c.id;
 IF p_entity_type='contact' AND p_entity IS NOT NULL THEN UPDATE public.linkedin_conversations SET lead_id=NULL WHERE id=c.id;END IF;
 IF p_entity_type='lead' AND p_entity IS NOT NULL THEN UPDATE public.linkedin_conversations SET contact_id=NULL WHERE id=c.id;END IF;
END $$;
REVOKE ALL ON FUNCTION public.linkedin_conversation_edit(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.linkedin_conversation_edit(uuid,text,text,uuid) TO authenticated;
CREATE FUNCTION public.linkedin_outbound_commit(p_conversation uuid,p_workspace uuid,p_owner uuid,p_message text,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.linkedin_conversations;result uuid;
BEGIN
 SELECT * INTO c FROM public.linkedin_conversations WHERE id=p_conversation AND workspace_id=p_workspace AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND OR nullif(p_message,'') IS NULL THEN RAISE EXCEPTION 'Invalid outbound receipt';END IF;
 INSERT INTO public.linkedin_messages(workspace_id,conversation_id,account_id,provider_message_id,direction,body)
 VALUES(c.workspace_id,c.id,c.account_id,p_message,'outbound',p_body)
 ON CONFLICT(account_id,provider_message_id) DO UPDATE SET provider_message_id=EXCLUDED.provider_message_id RETURNING id INTO result;
 UPDATE public.linkedin_conversations SET snippet=left(p_body,240),last_message_at=now() WHERE id=c.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.linkedin_outbound_commit(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_outbound_commit(uuid,uuid,uuid,text,text) TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.linkedin_messages;
 END IF;
END $$;
