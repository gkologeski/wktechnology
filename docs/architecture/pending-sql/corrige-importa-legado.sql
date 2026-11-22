-- CORRIGE-IMPORTA-LEGADO: preparado para revisão, NÃO aplicado.
-- Causa: SELECT * em função invoker lia 4 colunas sem GRANT para authenticated
-- (public_token, hiring_person_id, legal_entity_id, hiring_request_origin).
-- Mudança única: leitura por colunas explícitas em jsonb; regras, grants e RLS inalterados.
CREATE OR REPLACE FUNCTION public.contract_legacy_import_create(w uuid, p_contract jsonb, p_reason text, p_operation uuid)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE u uuid:=auth.uid();c jsonb;j jsonb:=p_contract;path text;cols text;vals text;r jsonb;
 allowed text[]:=ARRAY['owner_id','workspace_id','role','title','counterparty_company_id','contracting_legal_entity_id','total_value','currency','starts_at','ends_at','auto_renew','notice_days','number','public_token','status','metadata','monthly_value','hours_per_month','payment_day','payment_method','late_fee_percent','late_interest_monthly_percent','expense_reimbursement_days','readjustment_index','readjustment_period','penalty_percent','cure_period_days','trial_period_days','unilateral_termination_notice_days','service_type','service_scope','service_location','governing_law','jurisdiction','confidentiality_term_months','source_file_path','imported_from','import_confidence','body_html','document_kind'];
BEGIN
 IF u IS NULL OR p_operation IS NULL OR is_read_only_view() OR NOT is_workspace_member(w,u)
  OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND active_workspace_id=w)
  OR NOT EXISTS(SELECT 1 FROM workspaces WHERE id=w AND coalesce(status,'active')='active')
  OR NOT user_has_permission(u,w,'techcontracts.imports.manage.workspace')
  OR NOT user_has_permission(u,w,'techcontracts.legacy_contracts.create.workspace') THEN
  RAISE EXCEPTION 'Sem permissão para importar contrato legado.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(j) IS DISTINCT FROM 'object' OR octet_length(j::text)>500000
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(j) k WHERE NOT(k=ANY(allowed)))
  OR j->>'workspace_id' IS DISTINCT FROM w::text OR j->>'owner_id' IS DISTINCT FROM u::text
  OR coalesce(j->>'status','draft')<>'draft' OR j->>'imported_from' NOT IN('pdf','docx')
  OR coalesce(j->'metadata','{}') ?| ARRAY['accepted_proposal','accepted_contract_draft','commercial_journey_version'] THEN
  RAISE EXCEPTION 'Dados protegidos ou origem inválida na importação.' USING ERRCODE='42501';END IF;
 path:=nullif(j->>'source_file_path','');
 IF path IS NULL OR NOT work_contract_source_owned(path) THEN
  RAISE EXCEPTION 'Arquivo privado original obrigatório e acessível ao autor.' USING ERRCODE='42501';END IF;
 IF nullif(j->>'counterparty_company_id','') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM companies WHERE id=(j->>'counterparty_company_id')::uuid AND workspace_id=w AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Contraparte canônica indisponível neste workspace.' USING ERRCODE='42501';END IF;
 IF nullif(j->>'contracting_legal_entity_id','') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM legal_entities WHERE id=(j->>'contracting_legal_entity_id')::uuid AND workspace_id=w AND active) THEN
  RAISE EXCEPTION 'Entidade legal WK indisponível neste workspace.' USING ERRCODE='42501';END IF;
 PERFORM work_area_authorize('techcontracts.contracts','create');
 PERFORM pg_advisory_xact_lock(hashtextextended('legacy-import:'||w::text||':'||path,0));
 -- Somente colunas concedidas ao usuário (public_token fica fora; já era ignorado no reenvio).
 SELECT to_jsonb(x) INTO c FROM (SELECT id,owner_id,workspace_id,role,title,counterparty_company_id,contracting_legal_entity_id,total_value,currency,starts_at,ends_at,auto_renew,notice_days,number,status,metadata,monthly_value,hours_per_month,payment_day,payment_method,late_fee_percent,late_interest_monthly_percent,expense_reimbursement_days,readjustment_index,readjustment_period,penalty_percent,cure_period_days,trial_period_days,unilateral_termination_notice_days,service_type,service_scope,service_location,governing_law,jurisdiction,confidentiality_term_months,source_file_path,imported_from,import_confidence,body_html,document_kind FROM contracts WHERE id=p_operation) x;
 IF c IS NOT NULL THEN
  IF c->>'workspace_id' IS DISTINCT FROM w::text OR c->>'owner_id' IS DISTINCT FROM u::text OR c->>'source_file_path' IS DISTINCT FROM path THEN
   RAISE EXCEPTION 'Operação de importação já utilizada.' USING ERRCODE='23505';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(j) x WHERE x.key NOT IN('number','public_token')
    AND (CASE WHEN x.key='metadata' THEN (c->x.key)-'commercial_journey_version' ELSE c->x.key END) IS DISTINCT FROM x.value) THEN
   RAISE EXCEPTION 'CONFLICT: os dados desta importação mudaram; abra o contrato já criado.' USING ERRCODE='23505';END IF;
  r:=contract_legacy_recognize(w,p_operation,NULL,p_reason,p_operation);
  RETURN jsonb_build_object('id',p_operation,'replayed',true,'legacy',r);
 END IF;
 IF EXISTS(SELECT 1 FROM contracts WHERE workspace_id=w AND source_file_path=path) THEN
  RAISE EXCEPTION 'Este arquivo já possui contrato. Abra a ficha existente para regularizar.' USING ERRCODE='23505';END IF;
 j:=j||jsonb_build_object('id',p_operation,'status','draft');
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),',') INTO cols,vals FROM jsonb_object_keys(j) k;
 EXECUTE format('INSERT INTO contracts(%s) SELECT %s FROM jsonb_populate_record(NULL::contracts,$1)p',cols,vals) USING j;
 r:=contract_legacy_recognize(w,p_operation,NULL,p_reason,p_operation);
 RETURN jsonb_build_object('id',p_operation,'replayed',false,'legacy',r);
END $function$;
