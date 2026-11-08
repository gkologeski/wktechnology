-- ACEITE-MINUTA Entrega 2: minuta de contrato com revisão jurídica.
-- Não concede permissões a nenhum cargo; escrita só por RPCs com checagem explícita.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.contract_drafts.view.workspace','techcontracts','contract_drafts','view','workspace','Ver minutas de contrato','Lista e abre minutas geradas após o aceite da proposta.',true),
('techcontracts.contract_drafts.approve.workspace','techcontracts','contract_drafts','approve','workspace','Aprovar minuta de contrato','Revisar, trocar modelo, editar e aprovar ou recusar o envio da minuta. Exige estar na lista de aprovadores jurídicos.',true),
('techcontracts.contract_draft_approvers.manage.workspace','techcontracts','contract_draft_approvers','manage','workspace','Configurar aprovadores jurídicos','Escolher quem aprova minutas de contrato no workspace.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.contract_draft_approvers(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);
GRANT SELECT ON public.contract_draft_approvers TO authenticated;
GRANT ALL ON public.contract_draft_approvers TO service_role;
ALTER TABLE public.contract_draft_approvers ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_draft_approvers_select ON public.contract_draft_approvers FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id,auth.uid()) AND (
  public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_draft_approvers.manage.workspace')
  OR user_id=auth.uid()));

CREATE TABLE public.contract_drafts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
 proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
 template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
 title text NOT NULL,
 body_html text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending_legal' CHECK(status IN('pending_legal','approved','rejected','sent','accepted','changes_requested','canceled')),
 missing_template boolean NOT NULL DEFAULT false,
 created_by uuid,
 decided_by uuid,
 decided_at timestamptz,
 decision_note text,
 revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contract_drafts_open_per_proposal ON public.contract_drafts(proposal_id) WHERE status NOT IN('rejected','canceled');
CREATE INDEX contract_drafts_ws_status ON public.contract_drafts(workspace_id,status,created_at DESC);
CREATE INDEX contract_drafts_deal ON public.contract_drafts(deal_id);
GRANT SELECT ON public.contract_drafts TO authenticated;
GRANT ALL ON public.contract_drafts TO service_role;
ALTER TABLE public.contract_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_drafts_select ON public.contract_drafts FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id,auth.uid()) AND (
  public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_drafts.view.workspace')
  OR (public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_drafts.approve.workspace')
      AND EXISTS(SELECT 1 FROM public.contract_draft_approvers a WHERE a.workspace_id=contract_drafts.workspace_id AND a.user_id=auth.uid()))));

CREATE TABLE public.contract_draft_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 draft_id uuid NOT NULL REFERENCES public.contract_drafts(id) ON DELETE CASCADE,
 actor_id uuid,
 kind text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contract_draft_events_draft ON public.contract_draft_events(draft_id,created_at DESC);
GRANT SELECT ON public.contract_draft_events TO authenticated;
GRANT ALL ON public.contract_draft_events TO service_role;
ALTER TABLE public.contract_draft_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_draft_events_select ON public.contract_draft_events FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.contract_drafts d WHERE d.id=draft_id));

-- Aprovador jurídico válido: listado, membro ativo e com a chave de aprovar (deny prevalece via user_effective_permissions).
CREATE OR REPLACE FUNCTION public.contract_draft_is_approver(p_ws uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_user IS NOT NULL
  AND EXISTS(SELECT 1 FROM contract_draft_approvers a WHERE a.workspace_id=p_ws AND a.user_id=p_user)
  AND is_workspace_member(p_ws,p_user)
  AND user_has_permission(p_user,p_ws,'techcontracts.contract_drafts.approve.workspace')
$$;
REVOKE ALL ON FUNCTION public.contract_draft_is_approver(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_is_approver(uuid,uuid) TO authenticated,service_role;

-- Define a lista de aprovadores do workspace ativo.
CREATE OR REPLACE FUNCTION public.contract_draft_set_approvers(p_users uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid;n integer:=0;BEGIN
 IF w IS NULL OR (c->>'read_only')::boolean OR NOT (c->'keys') ? 'techcontracts.contract_draft_approvers.manage.workspace' THEN
  RAISE EXCEPTION 'Sem permissão para configurar aprovadores jurídicos.' USING ERRCODE='42501';END IF;
 IF coalesce(array_length(p_users,1),0)>20 THEN RAISE EXCEPTION 'Máximo de 20 aprovadores.';END IF;
 FOREACH u IN ARRAY coalesce(p_users,'{}') LOOP
  IF NOT EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=w AND m.user_id=u AND coalesce(m.status,'active')<>'inactive') THEN
   RAISE EXCEPTION 'Aprovador precisa ser membro ativo do workspace.' USING ERRCODE='22023';END IF;
 END LOOP;
 DELETE FROM contract_draft_approvers WHERE workspace_id=w AND NOT (user_id=ANY(coalesce(p_users,'{}')));
 INSERT INTO contract_draft_approvers(workspace_id,user_id,created_by)
  SELECT w,x,auth.uid() FROM unnest(coalesce(p_users,'{}')) x ON CONFLICT DO NOTHING;
 SELECT count(*) INTO n FROM contract_draft_approvers WHERE workspace_id=w;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_set_approvers(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_set_approvers(uuid[]) TO authenticated;

-- Abre a minuta da proposta aceita (chamada só pelo motor de workflows). Idempotente.
CREATE OR REPLACE FUNCTION public.contract_draft_open(p_ws uuid,p_proposal uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p record;d uuid;t record;existing uuid;n integer:=0;ap record;BEGIN
 SELECT id,workspace_id,deal_id,title,status INTO p FROM proposals WHERE id=p_proposal;
 IF p.id IS NULL OR p.workspace_id<>p_ws THEN RAISE EXCEPTION 'Proposta fora do workspace.' USING ERRCODE='42501';END IF;
 IF p.status<>'accepted' THEN RAISE EXCEPTION 'A minuta só é aberta para proposta aceita.' USING ERRCODE='22023';END IF;
 SELECT id INTO existing FROM contract_drafts WHERE proposal_id=p.id AND status NOT IN('rejected','canceled');
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('draft_id',existing,'created',false);END IF;
 -- Modelo padrão do serviço: primeiro serviço do negócio com modelo vinculado ativo.
 SELECT ct.id,ct.name,ct.body_html INTO t
  FROM deal_line_items li
  JOIN contract_template_services s ON s.service_catalog_id=li.service_catalog_id AND s.workspace_id=p_ws
  JOIN contract_templates ct ON ct.id=s.template_id AND ct.workspace_id=p_ws AND coalesce(ct.status,'active')<>'archived'
  WHERE li.deal_id=p.deal_id
  ORDER BY ct.is_default DESC, li.created_at, ct.name LIMIT 1;
 INSERT INTO contract_drafts(workspace_id,deal_id,proposal_id,template_id,title,body_html,missing_template,created_by)
  VALUES(p_ws,p.deal_id,p.id,t.id,'Minuta — '||coalesce(p.title,'Proposta'),coalesce(t.body_html,''),t.id IS NULL,p_actor)
  RETURNING id INTO d;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(p_ws,d,p_actor,'opened',jsonb_build_object('template_id',t.id,'missing_template',t.id IS NULL));
 FOR ap IN SELECT a.user_id FROM contract_draft_approvers a WHERE a.workspace_id=p_ws LOOP
  IF contract_draft_is_approver(p_ws,ap.user_id) THEN
   INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key)
   VALUES(ap.user_id,ap.user_id,p_ws,'approval','Revisar minuta de contrato',
    CASE WHEN t.id IS NULL THEN 'Proposta aceita sem modelo padrão vinculado ao serviço: escolha o modelo e aprove o envio.'
         ELSE 'Proposta aceita: confira o modelo "'||t.name||'" e aprove o envio ao cliente.' END,
    '/contracts/drafts/'||d,'contract_drafts',d,'contract_draft:'||d||':'||ap.user_id);
   n:=n+1;
  END IF;
 END LOOP;
 IF n=0 THEN
  INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
   VALUES(p_ws,d,p_actor,'no_approvers','{}'::jsonb);
  INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key)
   VALUES(p_actor,p_actor,p_ws,'approval','Minuta sem aprovador jurídico',
    'Configure os aprovadores em Configurações → Fluxos de aprovação → Minuta de contrato.',
    '/contracts/drafts/'||d,'contract_drafts',d,'contract_draft:'||d||':noapprover');
 END IF;
 RETURN jsonb_build_object('draft_id',d,'created',true,'notified',n,'template_id',t.id);
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_open(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_draft_open(uuid,uuid,uuid) TO service_role;

-- Corpo de um modelo para a troca na revisão (somente aprovador da minuta).
CREATE OR REPLACE FUNCTION public.contract_draft_template_body(p_draft uuid,p_template uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;b text;BEGIN
 SELECT workspace_id INTO w FROM contract_drafts WHERE id=p_draft;
 IF w IS NULL OR NOT contract_draft_is_approver(w,auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para revisar esta minuta.' USING ERRCODE='42501';END IF;
 SELECT body_html INTO b FROM contract_templates WHERE id=p_template AND workspace_id=w;
 IF b IS NULL THEN RAISE EXCEPTION 'Modelo não encontrado neste workspace.' USING ERRCODE='22023';END IF;
 RETURN b;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_template_body(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_template_body(uuid,uuid) TO authenticated;

-- Lista de modelos para o seletor da revisão (somente aprovador da minuta).
CREATE OR REPLACE FUNCTION public.contract_draft_templates(p_draft uuid)
RETURNS TABLE(id uuid,name text,is_default boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;BEGIN
 SELECT d.workspace_id INTO w FROM contract_drafts d WHERE d.id=p_draft;
 IF w IS NULL OR NOT contract_draft_is_approver(w,auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para revisar esta minuta.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT ct.id,ct.name,ct.is_default FROM contract_templates ct
  WHERE ct.workspace_id=w AND coalesce(ct.status,'active')<>'archived' ORDER BY ct.is_default DESC,ct.name LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_templates(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_templates(uuid) TO authenticated;

-- Revisão jurídica: salvar edição, aprovar ou recusar. CAS por revisão.
CREATE OR REPLACE FUNCTION public.contract_draft_review(p_draft uuid,p_revision integer,p_decision text,p_template uuid,p_body text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;u uuid:=auth.uid();BEGIN
 IF is_read_only_view() THEN RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR NOT contract_draft_is_approver(d.workspace_id,u) THEN RAISE EXCEPTION 'Sem permissão para revisar esta minuta.' USING ERRCODE='42501';END IF;
 IF d.status NOT IN('pending_legal','changes_requested') THEN RAISE EXCEPTION 'Esta minuta já foi decidida.' USING ERRCODE='22023';END IF;
 IF d.revision<>p_revision THEN RAISE EXCEPTION 'A minuta foi alterada por outra pessoa. Recarregue a página.' USING ERRCODE='40001';END IF;
 IF p_decision NOT IN('save','approve','reject') THEN RAISE EXCEPTION 'Decisão inválida.';END IF;
 IF p_template IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contract_templates WHERE id=p_template AND workspace_id=d.workspace_id) THEN
  RAISE EXCEPTION 'Modelo não encontrado neste workspace.' USING ERRCODE='22023';END IF;
 IF length(coalesce(p_body,''))>500000 THEN RAISE EXCEPTION 'Texto da minuta muito longo.';END IF;
 IF p_decision='approve' AND length(btrim(regexp_replace(coalesce(p_body,d.body_html),'<[^>]*>','','g')))<20 THEN
  RAISE EXCEPTION 'A minuta precisa ter texto antes de ser aprovada.' USING ERRCODE='22023';END IF;
 IF p_decision='reject' AND length(btrim(coalesce(p_note,'')))<5 THEN
  RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE='22023';END IF;
 UPDATE contract_drafts SET
  template_id=coalesce(p_template,template_id),
  body_html=coalesce(p_body,body_html),
  missing_template=(coalesce(p_template,template_id) IS NULL),
  status=CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE status END,
  decided_by=CASE WHEN p_decision='save' THEN decided_by ELSE u END,
  decided_at=CASE WHEN p_decision='save' THEN decided_at ELSE now() END,
  decision_note=CASE WHEN p_decision='save' THEN decision_note ELSE nullif(btrim(p_note),'') END,
  revision=revision+1,updated_at=now()
 WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(d.workspace_id,d.id,u,CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'edited' END,
   jsonb_build_object('template_id',coalesce(p_template,d.template_id),'template_changed',p_template IS DISTINCT FROM d.template_id AND p_template IS NOT NULL,
    'body_changed',p_body IS NOT NULL AND p_body IS DISTINCT FROM d.body_html,'note',nullif(btrim(coalesce(p_note,'')),'')));
 RETURN jsonb_build_object('id',d.id,'revision',d.revision+1,
  'status',CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE d.status END);
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_review(uuid,integer,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_review(uuid,integer,text,uuid,text,text) TO authenticated;