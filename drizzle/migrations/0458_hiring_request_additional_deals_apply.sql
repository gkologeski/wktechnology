-- Vários negócios atendidos por uma solicitação: negócio principal em deal_id e adicionais em additional_deal_ids.
ALTER TABLE public.hiring_preparation_requests ADD COLUMN IF NOT EXISTS additional_deal_ids uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.hiring_preparation_requests.additional_deal_ids IS 'Negócios adicionais atendidos (além do principal deal_id); validados pelo gatilho na mesma entidade/workspace e visibilidade do autor.';
CREATE OR REPLACE FUNCTION public.hiring_preparation_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE w uuid:=NEW.workspace_id; origin_entity uuid; origin_deal uuid; origin_contract uuid; extra uuid; deal_set uuid[];
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
 NEW.additional_deal_ids:=coalesce(NEW.additional_deal_ids,'{}');
 IF cardinality(NEW.additional_deal_ids)>0 THEN
  IF NEW.purpose<>'client' THEN RAISE EXCEPTION 'Origem comercial somente para finalidade cliente.'; END IF;
  IF NEW.deal_id IS NULL THEN RAISE EXCEPTION 'Escolha o negócio principal antes dos negócios adicionais.'; END IF;
  IF cardinality(NEW.additional_deal_ids)>20 THEN RAISE EXCEPTION 'Limite de 20 negócios adicionais.'; END IF;
  IF NEW.deal_id=ANY(NEW.additional_deal_ids) OR (SELECT count(DISTINCT x) FROM unnest(NEW.additional_deal_ids) x)<>cardinality(NEW.additional_deal_ids) OR array_position(NEW.additional_deal_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Negócio repetido na solicitação.'; END IF;
  FOREACH extra IN ARRAY NEW.additional_deal_ids LOOP
   SELECT legal_entity_id INTO origin_entity FROM public.deals WHERE id=extra AND workspace_id=w AND deleted_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Negócio adicional indisponível.'; END IF;
   IF origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
  END LOOP;
 END IF;
 deal_set:=CASE WHEN NEW.deal_id IS NULL THEN '{}'::uuid[] ELSE array_prepend(NEW.deal_id,NEW.additional_deal_ids) END;
 IF NEW.commercial_contract_id IS NOT NULL THEN
  SELECT coalesce(contracting_legal_entity_id,legal_entity_id),deal_id INTO origin_entity,origin_deal FROM public.contracts WHERE id=NEW.commercial_contract_id AND workspace_id=w AND role::text='provider';
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato comercial indisponível ou WK não fornecedora.'; END IF;
  IF origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
  IF NEW.deal_id IS NOT NULL AND (origin_deal IS NULL OR NOT origin_deal=ANY(deal_set)) THEN RAISE EXCEPTION 'Contrato não pertence a nenhum dos negócios.'; END IF;
 END IF;
 IF NEW.project_id IS NOT NULL THEN
  SELECT legal_entity_id,deal_id,contract_id INTO origin_entity,origin_deal,origin_contract FROM public.projects WHERE id=NEW.project_id AND workspace_id=w;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto indisponível.'; END IF;
  IF NEW.purpose='client' AND origin_entity IS NOT NULL AND origin_entity IS DISTINCT FROM NEW.legal_entity_id THEN RAISE EXCEPTION 'Entidade legal diverge da origem cliente.'; END IF;
  IF NEW.deal_id IS NOT NULL AND (origin_deal IS NULL OR NOT origin_deal=ANY(deal_set)) THEN RAISE EXCEPTION 'Projeto não pertence a nenhum dos negócios.'; END IF;
  IF NEW.commercial_contract_id IS NOT NULL AND origin_contract IS DISTINCT FROM NEW.commercial_contract_id THEN RAISE EXCEPTION 'Projeto não pertence ao contrato comercial.'; END IF;
 END IF;
 IF NEW.status='ready' AND NEW.purpose='client' AND NEW.deal_id IS NULL AND NEW.commercial_contract_id IS NULL THEN RAISE EXCEPTION 'Associe o negócio ou contrato comercial para preparar uma contratação de cliente.'; END IF;
 IF NEW.status='ready' AND (NEW.area_id IS NULL OR NEW.legal_entity_id IS NULL OR length(btrim(NEW.scope_text))=0 OR (NEW.kind='supplier' AND NEW.company_id IS NULL)) THEN RAISE EXCEPTION 'Preencha escopo, área, entidade legal e fornecedor quando aplicável.'; END IF;
 IF NEW.kind='professional' AND (NEW.release_condition IS NOT NULL OR (NEW.selection_mode='needs_selection' AND NEW.person_id IS NOT NULL) OR (NEW.status='ready' AND NEW.selection_mode='defined' AND NEW.person_id IS NULL)) THEN RAISE EXCEPTION 'Profissional definido exige pessoa real; necessidade de seleção não vincula pessoa nem abre vaga.'; END IF;
 IF NEW.kind='supplier' AND NEW.status='ready' AND NEW.release_condition='also_client_acceptance' AND (NEW.purpose IS DISTINCT FROM 'client' OR (NEW.project_id IS NULL AND NEW.commercial_contract_id IS NULL AND NEW.deal_id IS NULL)) THEN RAISE EXCEPTION 'Aceite do cliente final exige finalidade Cliente vinculada a projeto, negócio ou contrato comercial canônico.'; END IF;
 IF NEW.kind='supplier' AND NEW.status='ready' AND NEW.release_condition IS NULL THEN RAISE EXCEPTION 'Informe condição de liberação do fornecedor para revisão.'; END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.hiring_preparation_save(p_ws uuid, p_kind text, p_id uuid, p_revision integer, p_operation uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r public.hiring_preparation_requests%ROWTYPE; previous public.hiring_preparation_events%ROWTYPE; action text; result jsonb; sensitive jsonb; old_sensitive jsonb;
BEGIN
 action:=CASE WHEN p_id IS NULL THEN 'create' WHEN p_data->>'status'='cancelled' THEN 'cancel' ELSE 'update' END;
 IF NOT public.hiring_preparation_access(p_ws,p_kind,action) THEN RAISE EXCEPTION 'Sem permissão para preparação.' USING ERRCODE='42501'; END IF;
 IF p_operation IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data - ARRAY['title','scope_text','purpose','area_id','legal_entity_id','regime','person_id','company_id','contact_id','deal_id','project_id','commercial_contract_id','additional_deal_ids','status','selection_mode','modality','release_condition','reference_value'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Dados inválidos; campos sensíveis não são aceitos.'; END IF;
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
  IF action='cancel' AND (to_jsonb(r) - ARRAY['id','workspace_id','kind','revision','created_by','created_at','updated_at','status']) IS DISTINCT FROM (p_data - ARRAY['status','reference_value','additional_deal_ids'] || jsonb_build_object('additional_deal_ids',CASE WHEN p_data ? 'additional_deal_ids' THEN p_data->'additional_deal_ids' ELSE to_jsonb(r.additional_deal_ids) END)) THEN RAISE EXCEPTION 'Cancelamento não pode editar outros campos.'; END IF;
  r.revision:=r.revision+1;
 END IF;
 r.selection_mode:=coalesce(p_data->>'selection_mode','needs_selection');r.modality:=coalesce(p_data->>'modality','delivery');r.release_condition:=p_data->>'release_condition';
 r.title:=p_data->>'title';r.scope_text:=coalesce(p_data->>'scope_text','');r.purpose:=p_data->>'purpose';r.status:=p_data->>'status';
 r.area_id:=(p_data->>'area_id')::uuid;r.legal_entity_id:=(p_data->>'legal_entity_id')::uuid;r.regime:=p_data->>'regime';r.person_id:=(p_data->>'person_id')::uuid;r.company_id:=(p_data->>'company_id')::uuid;r.contact_id:=(p_data->>'contact_id')::uuid;r.deal_id:=(p_data->>'deal_id')::uuid;r.project_id:=(p_data->>'project_id')::uuid;r.commercial_contract_id:=(p_data->>'commercial_contract_id')::uuid;r.updated_at:=now();
 IF p_data ? 'additional_deal_ids' THEN
  IF jsonb_typeof(p_data->'additional_deal_ids')<>'array' THEN RAISE EXCEPTION 'Dados inválidos; negócios adicionais.'; END IF;
  r.additional_deal_ids:=ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(p_data->'additional_deal_ids') WITH ORDINALITY t(x,o) ORDER BY o);
 ELSIF action<>'cancel' THEN r.additional_deal_ids:='{}';
 END IF;
 IF p_id IS NULL THEN INSERT INTO public.hiring_preparation_requests SELECT r.*;
 ELSE UPDATE public.hiring_preparation_requests SET selection_mode=r.selection_mode,modality=r.modality,release_condition=r.release_condition,title=r.title,scope_text=r.scope_text,purpose=r.purpose,status=r.status,area_id=r.area_id,legal_entity_id=r.legal_entity_id,regime=r.regime,person_id=r.person_id,company_id=r.company_id,contact_id=r.contact_id,deal_id=r.deal_id,project_id=r.project_id,commercial_contract_id=r.commercial_contract_id,additional_deal_ids=r.additional_deal_ids,revision=r.revision,updated_at=r.updated_at WHERE id=r.id; END IF;
 result:=to_jsonb(r);
 INSERT INTO public.hiring_preparation_events(workspace_id,request_id,revision,actor_id,operation_id,payload,snapshot) VALUES(p_ws,r.id,r.revision,auth.uid(),p_operation,jsonb_build_object('id',p_id,'revision',p_revision,'kind',p_kind,'data',p_data-'reference_value'),result);
 IF p_data ? 'reference_value' THEN
 INSERT INTO public.hiring_preparation_reference_values(workspace_id,request_id,reference_value,revision) VALUES(p_ws,r.id,(p_data->>'reference_value')::numeric,r.revision) ON CONFLICT(request_id) DO UPDATE SET reference_value=excluded.reference_value,revision=excluded.revision;
 END IF;
 INSERT INTO public.hiring_preparation_reference_events(workspace_id,request_id,actor_id,operation_id,input) VALUES(p_ws,r.id,auth.uid(),p_operation,CASE WHEN p_data ? 'reference_value' THEN jsonb_build_object('reference_value',sensitive) ELSE '{}'::jsonb END);
 RETURN result;
END $function$;