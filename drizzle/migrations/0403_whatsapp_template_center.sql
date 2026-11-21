-- Meta owns message templates at WABA level. This catalogue exposes account
-- metadata only; credentials and provider mutations remain server-side.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
 ('system.whatsapp_templates.view.workspace','system','whatsapp_templates','view','workspace','Visualizar modelos de mensagens da Meta','Consultar contas e modelos oficiais de WhatsApp do workspace; exige também leitura de canais e WhatsApp.',true),
 ('system.whatsapp_templates.create.workspace','system','whatsapp_templates','create','workspace','Criar modelos de mensagens da Meta','Submeter modelos à Meta para a conta autorizada; não concede envio de mensagens nem acesso às credenciais.',true),
 ('system.whatsapp_templates.update.workspace','system','whatsapp_templates','update','workspace','Editar modelos de mensagens da Meta','Alterar modelos da conta autorizada, sujeitos às regras e à revisão da Meta.',true),
 ('system.whatsapp_templates.delete.workspace','system','whatsapp_templates','delete','workspace','Excluir modelos de mensagens da Meta','Excluir modelos da conta autorizada após confirmação; afeta os números que compartilham a mesma WABA.',true)
ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION public.wa_template_admin_context(p_workspace uuid,p_action text DEFAULT 'view',p_target text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 u uuid:=auth.uid();c jsonb:=public.work_access_context();k jsonb;
 read_only boolean;caps jsonb;targets jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR u IS NULL OR p_workspace IS NULL
 OR c->>'actor' IS DISTINCT FROM u::text OR c->>'workspace' IS DISTINCT FROM p_workspace::text
 OR p_action IS NULL OR p_action NOT IN('view','create','update','delete')
 OR (p_target IS NOT NULL AND p_target !~ '^(cloud|lovable):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
  RAISE EXCEPTION 'Acesso à central de modelos da Meta não autorizado.' USING ERRCODE='42501';
 END IF;
 k:=coalesce(c->'keys','{}'::jsonb);
 IF NOT coalesce(k @> '{"system.whatsapp_templates.view.workspace":true,"system.channels.view.workspace":true,"system.whatsapp.view.workspace":true}'::jsonb,false) THEN
  RAISE EXCEPTION 'Permissões de leitura de modelos, canais e WhatsApp são obrigatórias.' USING ERRCODE='42501';
 END IF;
 -- Only a canonical false enables external mutations; missing/null contexts
 -- must not authorize provider writes in a role-only test session.
 read_only:=c->'read_only' IS DISTINCT FROM 'false'::jsonb;
 caps:=jsonb_build_object('view',true,
  'create',NOT read_only AND coalesce(k->'system.whatsapp_templates.create.workspace'='true'::jsonb,false),
  'update',NOT read_only AND coalesce(k->'system.whatsapp_templates.update.workspace'='true'::jsonb,false),
  'delete',NOT read_only AND coalesce(k->'system.whatsapp_templates.delete.workspace'='true'::jsonb,false));
 IF p_action<>'view' AND (p_target IS NULL OR NOT coalesce((caps->>p_action)::boolean,false)) THEN
  RAISE EXCEPTION 'Sem permissão para esta alteração de modelo da Meta.' USING ERRCODE='42501';
 END IF;

 WITH cloud_targets AS (
  SELECT 'cloud:'||a.id::text AS id,'cloud'::text AS provider,a.label,
   a.waba_id AS "wabaId",coalesce(a.enabled,false) AS enabled,
   (SELECT jsonb_agg(jsonb_build_object('id',n.phone_number_id,'phone',n.display_phone_number,
      'label',coalesce(nullif(n.verified_name,''),nullif(n.display_phone_number,''),'Número conectado'))
     ORDER BY n.display_phone_number,n.phone_number_id)
    FROM (SELECT n.phone_number_id,n.display_phone_number,n.verified_name
     FROM public.wa_cloud_numbers n
     WHERE n.workspace_id=p_workspace AND n.connection_id=a.id
     ORDER BY n.display_phone_number,n.phone_number_id LIMIT 100)n) AS numbers
  FROM public.wa_cloud_connections a
  WHERE a.workspace_id=p_workspace
   AND EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=p_workspace AND n.connection_id=a.id)
 ), legacy_targets AS (
  SELECT 'lovable:'||a.id::text AS id,'lovable'::text AS provider,a.label,
   -- Channel routing/SDR activation is not transport credential availability.
   -- The server adapter still proves this exact number against the gateway.
   NULL::text AS "wabaId",true AS enabled,
   jsonb_build_array(jsonb_build_object('id',a.source_key,'phone',a.label,
    'label',coalesce(nullif(a.display_name,''),a.label))) AS numbers
  FROM public.service_channel_accounts a
  WHERE a.workspace_id=p_workspace AND a.channel='whatsapp' AND a.archived_at IS NULL
   AND a.source_key ~ '^[0-9]{5,30}$'
   AND NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=p_workspace AND n.phone_number_id=a.source_key)
 ), all_targets AS (SELECT * FROM cloud_targets UNION ALL SELECT * FROM legacy_targets)
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.provider,t.label,t.id),'[]'::jsonb) INTO targets
 FROM (SELECT * FROM all_targets t WHERE p_target IS NULL OR t.id=p_target
  ORDER BY t.provider,t.label,t.id LIMIT 100)t;
 IF p_target IS NOT NULL AND jsonb_array_length(targets)<>1 THEN
  RAISE EXCEPTION 'Conta de modelos indisponível neste workspace.' USING ERRCODE='42501';
 END IF;
 IF p_action<>'view' AND NOT coalesce((targets->0->>'enabled')::boolean,false) THEN
  RAISE EXCEPTION 'A conta deve estar habilitada para alterar modelos na Meta.' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('actor',u,'workspace',p_workspace,'readOnly',read_only,'capabilities',caps,'targets',targets);
END $$;
ALTER FUNCTION public.wa_template_admin_context(uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.wa_template_admin_context(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wa_template_admin_context(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
