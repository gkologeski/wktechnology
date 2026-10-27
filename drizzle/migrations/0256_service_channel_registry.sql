-- Central account metadata contains no transport credentials. Activation is explicit.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
 ('system.channels.view.workspace','system','channels','view','workspace','Ver canais de atendimento','Visualizar contas e identidades de atendimento do workspace.',true),
 ('system.channels.manage.workspace','system','channels','manage','workspace','Gerenciar canais de atendimento','Configurar identidade, agente e ativação de contas autorizadas.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.service_channel_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 channel text NOT NULL CHECK(channel IN('whatsapp','email','chat')),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 160),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=60),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,channel,source_key), UNIQUE(id,workspace_id)
);
CREATE UNIQUE INDEX sdr_playbooks_identity_workspace ON public.sdr_playbooks(id,workspace_id);
CREATE TABLE public.service_channel_bindings (
 account_id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 agent_id uuid NOT NULL,
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=60),
 inbound boolean NOT NULL DEFAULT false,
 campaigns boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,workspace_id) REFERENCES public.service_channel_accounts(id,workspace_id) ON DELETE CASCADE,
 FOREIGN KEY(agent_id,workspace_id) REFERENCES public.sdr_playbooks(id,workspace_id)
);

CREATE FUNCTION public.service_channel_access(c jsonb,w uuid,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'actor' IS NOT NULL AND c->>'workspace'=w::text
 AND a IN('view','manage')
 AND c->'keys' ? 'system.channels.view.workspace'
 AND c->'keys' ? ('system.channels.'||a||'.workspace')
 AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true)),false)
$$;
REVOKE ALL ON FUNCTION public.service_channel_access(jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_channel_access(jsonb,uuid,text) TO authenticated,service_role;

ALTER TABLE public.service_channel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_channel_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_channel_accounts,public.service_channel_bindings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.service_channel_accounts,public.service_channel_bindings TO authenticated;
GRANT ALL ON public.service_channel_accounts,public.service_channel_bindings TO service_role;
CREATE POLICY service_channels_read ON public.service_channel_accounts FOR SELECT TO authenticated
 USING(public.service_channel_access((SELECT public.work_access_context()),workspace_id,'view'));
CREATE POLICY service_bindings_read ON public.service_channel_bindings FOR SELECT TO authenticated
 USING(public.service_channel_access((SELECT public.work_access_context()),workspace_id,'view') AND EXISTS(
 SELECT 1 FROM public.sdr_playbooks p WHERE p.id=agent_id AND p.workspace_id=service_channel_bindings.workspace_id));

-- All writes go through this invoker-context checked RPC, including direct API calls.
CREATE FUNCTION public.service_channel_save(p_account uuid,p_label text,p_name text,p_enabled boolean,
 p_agent uuid,p_agent_name text,p_inbound boolean,p_campaigns boolean,p_agent_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context(); w uuid:=(c->>'workspace')::uuid; ac public.service_channel_accounts; agent_check uuid;
BEGIN
 IF NOT public.service_channel_access(c,w,'manage') THEN RAISE EXCEPTION 'Sem permissão para configurar canais.' USING ERRCODE='42501'; END IF;
 SELECT * INTO ac FROM public.service_channel_accounts WHERE id=p_account AND workspace_id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501'; END IF;
 FOR agent_check IN SELECT p_agent WHERE p_agent IS NOT NULL UNION SELECT agent_id FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w LOOP
  IF NOT EXISTS(SELECT 1 FROM public.sdr_playbooks p WHERE p.id=agent_check AND p.workspace_id=w
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','update',ARRAY[coalesce(p.assigned_to,p.owner_id)]))
  THEN RAISE EXCEPTION 'Agente indisponível ou sem permissão de edição.' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF p_agent_enabled AND (NOT p_enabled OR p_agent IS NULL OR NOT(p_inbound OR p_campaigns)) THEN
  RAISE EXCEPTION 'Selecione um agente, um modo de atendimento e ative a conta.' USING ERRCODE='23514'; END IF;
 UPDATE public.service_channel_accounts SET label=p_label,display_name=p_name,enabled=p_enabled WHERE id=p_account AND workspace_id=w;
 IF p_agent IS NULL THEN
  DELETE FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w;
 ELSE
  INSERT INTO public.service_channel_bindings(account_id,workspace_id,agent_id,display_name,inbound,campaigns,enabled)
   VALUES(p_account,w,p_agent,p_agent_name,p_inbound,p_campaigns,p_agent_enabled)
  ON CONFLICT(account_id) DO UPDATE SET agent_id=excluded.agent_id,display_name=excluded.display_name,
   inbound=excluded.inbound,campaigns=excluded.campaigns,enabled=excluded.enabled,updated_at=now();
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.service_channel_save(uuid,text,text,boolean,uuid,text,boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_channel_save(uuid,text,text,boolean,uuid,text,boolean,boolean,boolean) TO authenticated;

CREATE FUNCTION public.service_channel_authorize(p_action text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context(); BEGIN
 IF NOT public.service_channel_access(c,(c->>'workspace')::uuid,p_action) THEN
  RAISE EXCEPTION 'Sem permissão para canais de atendimento.' USING ERRCODE='42501'; END IF;
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.service_channel_authorize(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_channel_authorize(text) TO authenticated;
