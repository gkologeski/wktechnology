-- SOLICITA-PREPARA / approved prototype complement. PREPARED ONLY after 0373; no production application.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.reference.view.workspace','people','techpeople.hiring_requests.reference','view','workspace','Ver valor de referência de contratação','Leitura específica de condição sensível.',true),
('techpeople.hiring_requests.reference.update.workspace','people','techpeople.hiring_requests.reference','update','workspace','Editar valor de referência de contratação','Preparação de condição sensível sem efeito financeiro.',true),
('techcontracts.supplier_requests.reference.view.workspace','contracts','techcontracts.supplier_requests.reference','view','workspace','Ver valor de referência de fornecedor','Leitura específica de condição sensível.',true),
('techcontracts.supplier_requests.reference.update.workspace','contracts','techcontracts.supplier_requests.reference','update','workspace','Editar valor de referência de fornecedor','Preparação de condição sensível sem efeito financeiro.',true)
ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.hiring_preparation_requests ADD COLUMN selection_mode text NOT NULL DEFAULT 'needs_selection' CHECK(selection_mode IN('defined','needs_selection')),
 ADD COLUMN modality text NOT NULL DEFAULT 'delivery' CHECK(modality IN('delivery','hourly','monthly','mixed')),
 ADD COLUMN release_condition text CHECK(release_condition IN('wk_acceptance_invoice','also_client_acceptance'));
CREATE TABLE public.hiring_preparation_reference_values (
 request_id uuid PRIMARY KEY, workspace_id uuid NOT NULL, reference_value numeric(14,2), revision integer NOT NULL,
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id)
);
GRANT SELECT,INSERT,UPDATE ON public.hiring_preparation_reference_values TO techerp_request_writer;
GRANT ALL ON public.hiring_preparation_reference_values TO service_role;
ALTER TABLE public.hiring_preparation_reference_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_writer ON public.hiring_preparation_reference_values FOR ALL TO techerp_request_writer USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_reference_values.workspace_id)) WITH CHECK(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_reference_values.workspace_id));
CREATE TABLE public.hiring_preparation_reference_events (
 workspace_id uuid NOT NULL, request_id uuid NOT NULL, actor_id uuid NOT NULL, operation_id uuid NOT NULL, input jsonb NOT NULL,
 PRIMARY KEY(workspace_id,actor_id,operation_id), FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id)
);
GRANT SELECT,INSERT ON public.hiring_preparation_reference_events TO techerp_request_writer;
GRANT ALL ON public.hiring_preparation_reference_events TO service_role;
ALTER TABLE public.hiring_preparation_reference_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_event_writer ON public.hiring_preparation_reference_events FOR ALL TO techerp_request_writer USING(actor_id=auth.uid() AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_reference_events.workspace_id)) WITH CHECK(actor_id=auth.uid() AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_reference_events.workspace_id));
CREATE TRIGGER reference_event_immutable BEFORE UPDATE OR DELETE ON public.hiring_preparation_reference_events FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE OR REPLACE FUNCTION public.hiring_preparation_access(w uuid,k text,a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND k IN('professional','supplier') AND a IN('view','create','update','cancel','reference_view','reference_update')
 AND public.is_workspace_member(w,auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_workspace_id=w)
 AND (a IN('view','reference_view') OR NOT public.is_read_only_view())
 AND public.user_has_permission(auth.uid(),w,
 CASE k WHEN 'professional' THEN 'techpeople.hiring_requests.' ELSE 'techcontracts.supplier_requests.' END
 || CASE WHEN a='cancel' THEN 'cancel.update' WHEN a='reference_view' THEN 'reference.view' WHEN a='reference_update' THEN 'reference.update' ELSE a END ||'.workspace')
 AND (a='view' OR public.user_has_permission(auth.uid(),w,
 CASE k WHEN 'professional' THEN 'techpeople.hiring_requests.view.workspace' ELSE 'techcontracts.supplier_requests.view.workspace' END));
$$;
CREATE OR REPLACE FUNCTION public.hiring_preparation_validate() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
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
 IF NEW.status='ready' AND (NEW.area_id IS NULL OR NEW.legal_entity_id IS NULL OR length(btrim(NEW.scope_text))=0 OR (NEW.kind='supplier' AND NEW.company_id IS NULL)) THEN RAISE EXCEPTION 'Preencha escopo, área, entidade legal e fornecedor quando aplicável.'; END IF;
 IF NEW.kind='professional' AND (NEW.release_condition IS NOT NULL OR (NEW.selection_mode='needs_selection' AND NEW.person_id IS NOT NULL) OR (NEW.status='ready' AND NEW.selection_mode='defined' AND NEW.person_id IS NULL)) THEN RAISE EXCEPTION 'Profissional definido exige pessoa real; necessidade de seleção não vincula pessoa nem abre vaga.'; END IF;
 IF NEW.kind='supplier' AND NEW.status='ready' AND NEW.release_condition IS NULL THEN RAISE EXCEPTION 'Informe condição de liberação do fornecedor para revisão.'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.hiring_preparation_save(p_ws uuid,p_kind text,p_id uuid,p_revision integer,p_operation uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_preparation_requests; previous public.hiring_preparation_events; action text; result jsonb; sensitive jsonb; old_sensitive jsonb;
BEGIN
 action:=CASE WHEN p_id IS NULL THEN 'create' WHEN p_data->>'status'='cancelled' THEN 'cancel' ELSE 'update' END;
 IF NOT public.hiring_preparation_access(p_ws,p_kind,action) THEN RAISE EXCEPTION 'Sem permissão para preparação.' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data - ARRAY['title','scope_text','purpose','area_id','legal_entity_id','regime','person_id','company_id','contact_id','deal_id','project_id','commercial_contract_id','status','selection_mode','modality','release_condition','reference_value'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Dados inválidos; campos sensíveis não são aceitos.'; END IF;
 sensitive:=p_data->'reference_value';
 IF p_data ? 'reference_value' AND (action='cancel' OR NOT public.hiring_preparation_access(p_ws,p_kind,'reference_update')) THEN RAISE EXCEPTION 'Sem permissão para alterar valor de referência.' USING ERRCODE='42501'; END IF;
 IF sensitive IS NOT NULL AND sensitive<>'null'::jsonb AND (jsonb_typeof(sensitive)<>'number' OR (sensitive::text)::numeric<0 OR (sensitive::text)::numeric>999999999999.99) THEN RAISE EXCEPTION 'Valor de referência inválido.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_ws::text||auth.uid()::text||p_operation::text,0));
 SELECT * INTO previous FROM public.hiring_preparation_events WHERE workspace_id=p_ws AND actor_id=auth.uid() AND operation_id=p_operation;
 IF FOUND THEN
  SELECT input INTO old_sensitive FROM public.hiring_preparation_reference_events WHERE operation_id=p_operation AND workspace_id=p_ws AND actor_id=auth.uid();
  IF coalesce(old_sensitive,'{}') IS DISTINCT FROM (CASE WHEN p_data ? 'reference_value' THEN jsonb_build_object('reference_value',sensitive) ELSE '{}'::jsonb END) THEN RAISE EXCEPTION 'Chave idempotente reutilizada com valor diferente.'; END IF;
  IF previous.payload<>jsonb_build_object('id',p_id,'revision',p_revision,'kind',p_kind,'data',p_data-'reference_value') THEN RAISE EXCEPTION 'Chave idempotente reutilizada com dados diferentes.'; END IF;
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
  IF action='cancel' AND (to_jsonb(r) - ARRAY['id','workspace_id','kind','revision','created_by','created_at','updated_at','status']) IS DISTINCT FROM (p_data - ARRAY['status','reference_value']) THEN RAISE EXCEPTION 'Cancelamento não pode editar outros campos.'; END IF;
  r.revision:=r.revision+1;
 END IF;
 r.selection_mode:=coalesce(p_data->>'selection_mode','needs_selection');r.modality:=coalesce(p_data->>'modality','delivery');r.release_condition:=p_data->>'release_condition';
 r.title:=p_data->>'title';r.scope_text:=coalesce(p_data->>'scope_text','');r.purpose:=p_data->>'purpose';r.status:=p_data->>'status';
 r.area_id:=(p_data->>'area_id')::uuid;r.legal_entity_id:=(p_data->>'legal_entity_id')::uuid;r.regime:=p_data->>'regime';r.person_id:=(p_data->>'person_id')::uuid;r.company_id:=(p_data->>'company_id')::uuid;r.contact_id:=(p_data->>'contact_id')::uuid;r.deal_id:=(p_data->>'deal_id')::uuid;r.project_id:=(p_data->>'project_id')::uuid;r.commercial_contract_id:=(p_data->>'commercial_contract_id')::uuid;r.updated_at:=now();
 IF p_id IS NULL THEN INSERT INTO public.hiring_preparation_requests SELECT r.*;
 ELSE UPDATE public.hiring_preparation_requests SET selection_mode=r.selection_mode,modality=r.modality,release_condition=r.release_condition,title=r.title,scope_text=r.scope_text,purpose=r.purpose,status=r.status,area_id=r.area_id,legal_entity_id=r.legal_entity_id,regime=r.regime,person_id=r.person_id,company_id=r.company_id,contact_id=r.contact_id,deal_id=r.deal_id,project_id=r.project_id,commercial_contract_id=r.commercial_contract_id,revision=r.revision,updated_at=r.updated_at WHERE id=r.id; END IF;
 result:=to_jsonb(r);
 INSERT INTO public.hiring_preparation_events(workspace_id,request_id,revision,actor_id,operation_id,payload,snapshot) VALUES(p_ws,r.id,r.revision,auth.uid(),p_operation,jsonb_build_object('id',p_id,'revision',p_revision,'kind',p_kind,'data',p_data-'reference_value'),result);
 IF p_data ? 'reference_value' THEN
 INSERT INTO public.hiring_preparation_reference_values(workspace_id,request_id,reference_value,revision) VALUES(p_ws,r.id,(p_data->>'reference_value')::numeric,r.revision) ON CONFLICT(request_id) DO UPDATE SET reference_value=excluded.reference_value,revision=excluded.revision;
 END IF;
 INSERT INTO public.hiring_preparation_reference_events(workspace_id,request_id,actor_id,operation_id,input) VALUES(p_ws,r.id,auth.uid(),p_operation,CASE WHEN p_data ? 'reference_value' THEN jsonb_build_object('reference_value',sensitive) ELSE '{}'::jsonb END);
 RETURN result;
END $$;

CREATE FUNCTION public.hiring_preparation_reference(p_ws uuid,p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE value numeric; rev integer;
BEGIN
 IF NOT public.hiring_preparation_access(p_ws,p_kind,'reference_view') OR NOT EXISTS(SELECT 1 FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind) THEN RAISE EXCEPTION 'Sem permissão para valor de referência.' USING ERRCODE='42501'; END IF;
 SELECT reference_value,revision INTO value,rev FROM public.hiring_preparation_reference_values WHERE request_id=p_id AND workspace_id=p_ws;
 RETURN jsonb_build_object('reference_value',value,'revision',rev);
END $$;
ALTER FUNCTION public.hiring_preparation_reference(uuid,text,uuid) OWNER TO techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_preparation_reference(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_reference(uuid,text,uuid) TO authenticated;
