-- SOLICITA-PREPARA / package 2. PREPARED ONLY; promote via the migration tool after review.
-- No presets, approvers, operational records, workflows or messages are created.
CREATE ROLE techerp_request_writer NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT authenticated TO techerp_request_writer;
-- Migration executor needs SET ROLE capability to assign the security-definer owner.
GRANT techerp_request_writer TO CURRENT_USER;
GRANT USAGE ON SCHEMA public, auth TO techerp_request_writer;
-- Required by non-superuser migrations when transferring function ownership; revoked below.
GRANT CREATE ON SCHEMA public TO techerp_request_writer;

INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.view.workspace','techpeople','hiring_requests','view','workspace','Ver solicitações de contratação','Consultar preparação de contratação de profissionais.',true),
('techpeople.hiring_requests.create.workspace','techpeople','hiring_requests','create','workspace','Criar solicitação de contratação','Criar preparação, sem autorizar recrutamento.',true),
('techpeople.hiring_requests.update.workspace','techpeople','hiring_requests','update','workspace','Editar solicitação de contratação','Editar preparação com controle de revisão.',true),
('techpeople.hiring_requests.cancel.update.workspace','techpeople','hiring_requests.cancel','update','workspace','Cancelar solicitação de contratação','Cancelar preparação sem efeitos operacionais.',true),
('techcontracts.supplier_requests.view.workspace','techcontracts','supplier_requests','view','workspace','Ver contratação de fornecedores','Consultar preparação de compra WK.',true),
('techcontracts.supplier_requests.create.workspace','techcontracts','supplier_requests','create','workspace','Criar contratação de fornecedor','Criar preparação de compra WK.',true),
('techcontracts.supplier_requests.update.workspace','techcontracts','supplier_requests','update','workspace','Editar contratação de fornecedor','Editar preparação com controle de revisão.',true),
('techcontracts.supplier_requests.cancel.update.workspace','techcontracts','supplier_requests.cancel','update','workspace','Cancelar contratação de fornecedor','Cancelar preparação sem efeitos operacionais.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.hiring_preparation_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 scope_text text NOT NULL DEFAULT '' CHECK(length(scope_text)<=10000),
 purpose text NOT NULL CHECK(purpose IN('client','internal','shared_management')),
 area_id uuid REFERENCES public.user_groups(id),
 legal_entity_id uuid REFERENCES public.legal_entities(id),
 regime text CHECK(regime IN('clt','pj','freelance')),
 person_id uuid REFERENCES public.people(id),
 company_id uuid REFERENCES public.companies(id),
 contact_id uuid REFERENCES public.contacts(id),
 deal_id uuid REFERENCES public.deals(id),
 project_id uuid REFERENCES public.projects(id),
 commercial_contract_id uuid REFERENCES public.contracts(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','ready','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 CHECK((kind='professional' AND regime IS NOT NULL AND contact_id IS NULL) OR (kind='supplier' AND regime IS NULL AND person_id IS NULL))
);
GRANT SELECT ON public.hiring_preparation_requests TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hiring_preparation_requests TO techerp_request_writer;
GRANT ALL ON public.hiring_preparation_requests TO service_role;
ALTER TABLE public.hiring_preparation_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hiring_preparation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 request_id uuid NOT NULL,
 revision integer NOT NULL,
 actor_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 payload jsonb NOT NULL,
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 UNIQUE(workspace_id,actor_id,operation_id), UNIQUE(request_id,revision)
);
GRANT SELECT ON public.hiring_preparation_events TO authenticated;
GRANT SELECT,INSERT ON public.hiring_preparation_events TO techerp_request_writer;
GRANT ALL ON public.hiring_preparation_events TO service_role;
ALTER TABLE public.hiring_preparation_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX hiring_preparation_page ON public.hiring_preparation_requests(workspace_id,kind,created_at DESC,id);

CREATE FUNCTION public.hiring_preparation_access(w uuid,k text,a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND k IN('professional','supplier') AND a IN('view','create','update','cancel')
 AND public.is_workspace_member(w,auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_workspace_id=w)
 AND (a='view' OR NOT public.is_read_only_view())
 AND public.user_has_permission(auth.uid(),w,
 CASE k WHEN 'professional' THEN 'techpeople.hiring_requests.' ELSE 'techcontracts.supplier_requests.' END
 || CASE WHEN a='cancel' THEN 'cancel.update' ELSE a END ||'.workspace')
 AND (a='view' OR public.user_has_permission(auth.uid(),w,
 CASE k WHEN 'professional' THEN 'techpeople.hiring_requests.view.workspace' ELSE 'techcontracts.supplier_requests.view.workspace' END));
$$;
REVOKE ALL ON FUNCTION public.hiring_preparation_access(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_access(uuid,text,text) TO authenticated;
CREATE POLICY preparation_read ON public.hiring_preparation_requests FOR SELECT TO authenticated USING(public.hiring_preparation_access(workspace_id,kind,'view'));
CREATE POLICY preparation_insert ON public.hiring_preparation_requests FOR INSERT TO techerp_request_writer WITH CHECK(public.hiring_preparation_access(workspace_id,kind,'create') AND created_by=auth.uid());
CREATE POLICY preparation_update ON public.hiring_preparation_requests FOR UPDATE TO techerp_request_writer USING(public.hiring_preparation_access(workspace_id,kind,'update') OR public.hiring_preparation_access(workspace_id,kind,'cancel')) WITH CHECK(public.hiring_preparation_access(workspace_id,kind,'update') OR public.hiring_preparation_access(workspace_id,kind,'cancel'));
CREATE POLICY preparation_events_read ON public.hiring_preparation_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_events.workspace_id));
CREATE POLICY preparation_events_insert ON public.hiring_preparation_events FOR INSERT TO techerp_request_writer WITH CHECK(actor_id=auth.uid() AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_events.workspace_id));

-- Invoker trigger: also runs under the non-BYPASSRLS writer, so linked entities must be visible.
CREATE FUNCTION public.hiring_preparation_validate() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE w uuid:=NEW.workspace_id; origin_entity uuid; origin_deal uuid; origin_contract uuid;
BEGIN
 IF current_user<>'techerp_request_writer' THEN RAISE EXCEPTION 'Use a RPC de preparação.' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.kind<>OLD.kind OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1 OR OLD.status='cancelled') THEN RAISE EXCEPTION 'Revisão ou identidade inválida.'; END IF;
 IF NEW.area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_groups WHERE id=NEW.area_id AND workspace_id=w) THEN RAISE EXCEPTION 'Área indisponível.'; END IF;
 IF NEW.legal_entity_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.legal_entities WHERE id=NEW.legal_entity_id AND workspace_id=w AND active) THEN RAISE EXCEPTION 'Entidade legal indisponível ou inativa.'; END IF;
 IF NEW.person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.people WHERE id=NEW.person_id AND workspace_id=w AND NOT archived) THEN RAISE EXCEPTION 'Pessoa indisponível.'; END IF;
 IF NEW.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND workspace_id=w AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Empresa indisponível.'; END IF;
 IF NEW.kind='professional' AND NEW.company_id IS NOT NULL AND NEW.regime<>'pj' THEN RAISE EXCEPTION 'Empresa PJ somente para regime PJ.'; END IF;
 IF NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=NEW.contact_id AND workspace_id=w AND deleted_at IS NULL AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Contato não pertence ao fornecedor.'; END IF;
 IF NEW.purpose<>'client' AND (NEW.deal_id IS NOT NULL OR NEW.commercial_contract_id IS NOT NULL) THEN RAISE EXCEPTION 'Origem comercial somente para finalidade cliente.'; END IF;
 IF NEW.deal_id IS NOT NULL THEN
  SELECT legal_entity_id INTO origin_entity FROM public.deals WHERE id=NEW.deal_id AND workspace_id=w AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio indisponível.'; END IF;
  IF origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
 END IF;
 IF NEW.commercial_contract_id IS NOT NULL THEN
  SELECT coalesce(contracting_legal_entity_id,legal_entity_id),deal_id INTO origin_entity,origin_deal FROM public.contracts WHERE id=NEW.commercial_contract_id AND workspace_id=w AND role::text='provider';
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato comercial indisponível ou WK não fornecedora.'; END IF;
  IF origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
  IF NEW.deal_id IS NOT NULL AND origin_deal IS DISTINCT FROM NEW.deal_id THEN RAISE EXCEPTION 'Contrato não pertence ao negócio.'; END IF;
 END IF;
 IF NEW.project_id IS NOT NULL THEN
  SELECT legal_entity_id,deal_id,contract_id INTO origin_entity,origin_deal,origin_contract FROM public.projects WHERE id=NEW.project_id AND workspace_id=w;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto indisponível.'; END IF;
  IF NEW.purpose='client' AND origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
  IF NEW.deal_id IS NOT NULL AND origin_deal IS DISTINCT FROM NEW.deal_id THEN RAISE EXCEPTION 'Projeto não pertence ao negócio.'; END IF;
  IF NEW.commercial_contract_id IS NOT NULL AND origin_contract IS DISTINCT FROM NEW.commercial_contract_id THEN RAISE EXCEPTION 'Projeto não pertence ao contrato comercial.'; END IF;
 END IF;
 IF NEW.status='ready' AND NEW.purpose='client' AND NEW.deal_id IS NULL AND NEW.commercial_contract_id IS NULL THEN RAISE EXCEPTION 'Associe o negócio ou contrato comercial para preparar uma contratação de cliente.'; END IF;
 IF NEW.status='ready' AND (NEW.area_id IS NULL OR NEW.legal_entity_id IS NULL OR length(btrim(NEW.scope_text))=0 OR (NEW.kind='supplier' AND NEW.company_id IS NULL)) THEN RAISE EXCEPTION 'Preencha escopo, área, entidade legal e fornecedor quando aplicável.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_validate() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_validate() TO techerp_request_writer;
CREATE TRIGGER preparation_validate BEFORE INSERT OR UPDATE ON public.hiring_preparation_requests FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_validate();
CREATE FUNCTION public.hiring_preparation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Histórico imutável.'; END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preparation_immutable BEFORE UPDATE OR DELETE ON public.hiring_preparation_events FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();

CREATE FUNCTION public.hiring_preparation_save(p_ws uuid,p_kind text,p_id uuid,p_revision integer,p_operation uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_preparation_requests; previous public.hiring_preparation_events; action text; result jsonb;
BEGIN
 action:=CASE WHEN p_id IS NULL THEN 'create' WHEN p_data->>'status'='cancelled' THEN 'cancel' ELSE 'update' END;
 IF NOT public.hiring_preparation_access(p_ws,p_kind,action) THEN RAISE EXCEPTION 'Sem permissão para preparação.' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data - ARRAY['title','scope_text','purpose','area_id','legal_entity_id','regime','person_id','company_id','contact_id','deal_id','project_id','commercial_contract_id','status'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Dados inválidos; campos sensíveis não são aceitos.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_ws::text||auth.uid()::text||p_operation::text,0));
 SELECT * INTO previous FROM public.hiring_preparation_events WHERE workspace_id=p_ws AND actor_id=auth.uid() AND operation_id=p_operation;
 IF FOUND THEN
  IF previous.payload<>jsonb_build_object('id',p_id,'revision',p_revision,'kind',p_kind,'data',p_data) THEN RAISE EXCEPTION 'Chave idempotente reutilizada com dados diferentes.'; END IF;
  RETURN previous.snapshot;
 END IF;
 IF p_id IS NULL THEN
  IF p_revision IS DISTINCT FROM 0 OR action<>'create' OR p_data->>'status' IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Criação exige rascunho e revisão zero.'; END IF;
  r.id:=gen_random_uuid();r.workspace_id:=p_ws;r.kind:=p_kind;r.revision:=1;r.created_by:=auth.uid();r.created_at:=now();
 ELSE
  SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501'; END IF;
  IF p_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'REVISION_CONFLICT: outra pessoa alterou a solicitação. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  IF r.status='cancelled' THEN RAISE EXCEPTION 'Solicitação cancelada não pode ser editada.'; END IF;
  IF action='cancel' AND (to_jsonb(r) - ARRAY['id','workspace_id','kind','revision','created_by','created_at','updated_at','status']) IS DISTINCT FROM (p_data - 'status') THEN RAISE EXCEPTION 'Cancelamento não pode editar outros campos.'; END IF;
  r.revision:=r.revision+1;
 END IF;
 r.title:=p_data->>'title';r.scope_text:=coalesce(p_data->>'scope_text','');r.purpose:=p_data->>'purpose';r.status:=p_data->>'status';
 r.area_id:=(p_data->>'area_id')::uuid;r.legal_entity_id:=(p_data->>'legal_entity_id')::uuid;r.regime:=p_data->>'regime';r.person_id:=(p_data->>'person_id')::uuid;r.company_id:=(p_data->>'company_id')::uuid;r.contact_id:=(p_data->>'contact_id')::uuid;r.deal_id:=(p_data->>'deal_id')::uuid;r.project_id:=(p_data->>'project_id')::uuid;r.commercial_contract_id:=(p_data->>'commercial_contract_id')::uuid;r.updated_at:=now();
 IF p_id IS NULL THEN INSERT INTO public.hiring_preparation_requests SELECT r.*;
 ELSE UPDATE public.hiring_preparation_requests SET title=r.title,scope_text=r.scope_text,purpose=r.purpose,status=r.status,area_id=r.area_id,legal_entity_id=r.legal_entity_id,regime=r.regime,person_id=r.person_id,company_id=r.company_id,contact_id=r.contact_id,deal_id=r.deal_id,project_id=r.project_id,commercial_contract_id=r.commercial_contract_id,revision=r.revision,updated_at=r.updated_at WHERE id=r.id; END IF;
 result:=to_jsonb(r);
 INSERT INTO public.hiring_preparation_events(workspace_id,request_id,revision,actor_id,operation_id,payload,snapshot) VALUES(p_ws,r.id,r.revision,auth.uid(),p_operation,jsonb_build_object('id',p_id,'revision',p_revision,'kind',p_kind,'data',p_data),result);
 RETURN result;
END $$;
ALTER FUNCTION public.hiring_preparation_save(uuid,text,uuid,integer,uuid,jsonb) OWNER TO techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_preparation_save(uuid,text,uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_save(uuid,text,uuid,integer,uuid,jsonb) TO authenticated;

-- Invoker reads only bounded, explicit projections. No financial/personal-document fields.
CREATE FUNCTION public.hiring_preparation_page(p_ws uuid,p_kind text,p_search text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb;
BEGIN
 IF NOT public.hiring_preparation_access(p_ws,p_kind,'view') THEN RAISE EXCEPTION 'Sem permissão para preparação.' USING ERRCODE='42501'; END IF;
 IF p_offset<0 OR length(p_search)>200 THEN RAISE EXCEPTION 'Filtro inválido.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT * FROM public.hiring_preparation_requests WHERE workspace_id=p_ws AND kind=p_kind AND title ILIKE '%'||p_search||'%' ORDER BY created_at DESC,id LIMIT 51 OFFSET p_offset)x;
 RETURN rows;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_page(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_page(uuid,text,text,integer) TO authenticated;

CREATE FUNCTION public.hiring_preparation_history(p_ws uuid,p_kind text,p_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb;
BEGIN
 IF p_offset<0 OR NOT public.hiring_preparation_access(p_ws,p_kind,'view') OR NOT EXISTS(SELECT 1 FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind) THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM (SELECT id,revision,actor_id,created_at,snapshot FROM public.hiring_preparation_events WHERE request_id=p_id AND workspace_id=p_ws ORDER BY revision DESC LIMIT 51 OFFSET p_offset)x;
 RETURN rows;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_history(uuid,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_history(uuid,text,uuid,integer) TO authenticated;

REVOKE CREATE ON SCHEMA public FROM techerp_request_writer;
