-- Package 4 batch C2 (PARCELA-CONCILIA): canonical payables, explicit reconciliation and source integrity.
-- Reviewed release migration; apply through the journal after green CI. No business records are seeded.
-- Payables are canonical public.financial_entries (direction payable, status open, origin_type contract, origin_id = contract).
-- Payment truth stays public.financial_payments; nothing here writes paid_amount, paid status or payments.
-- Provenance is a trusted row in hiring_payable_installments (definer-only), never a caller-set GUC.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.payables.view.workspace','techpeople','hiring_requests.payables','view','workspace','Ver parcelas do profissional','Lê parcelas, títulos vinculados, pendências e conciliações; exige também acesso a títulos, contrato e pessoa.',true),
('techpeople.hiring_requests.payables.manage.workspace','techpeople','hiring_requests.payables','manage','workspace','Gerar contas a pagar do profissional','Gera parcelas canônicas a partir de fontes elegíveis selecionadas; nunca paga.',true),
('techpeople.hiring_requests.payables_reconciliation.approve.workspace','techpeople','hiring_requests.payables_reconciliation','approve','workspace','Conciliar títulos legados do profissional','Vincula título existente compatível ou registra que não se relaciona; exige Financeiro configurado.',true),
('techcontracts.supplier_requests.payables.view.workspace','techcontracts','supplier_requests.payables','view','workspace','Ver parcelas do fornecedor','Lê parcelas, títulos vinculados, pendências e conciliações; exige também acesso a títulos e contrato.',true),
('techcontracts.supplier_requests.payables.manage.workspace','techcontracts','supplier_requests.payables','manage','workspace','Gerar contas a pagar do fornecedor','Gera parcelas canônicas a partir de fontes elegíveis selecionadas; nunca paga.',true),
('techcontracts.supplier_requests.payables_reconciliation.approve.workspace','techcontracts','supplier_requests.payables_reconciliation','approve','workspace','Conciliar títulos legados do fornecedor','Vincula título existente compatível ou registra que não se relaciona; exige Financeiro configurado.',true),
('techcontracts.supplier_requests.client_acceptance.manage.workspace','techcontracts','supplier_requests.client_acceptance','manage','workspace','Registrar aceite do cliente final','Registra o aceite nomeado do cliente final sobre a versão exata da entrega; não libera sozinho.',true),
('techcontracts.supplier_requests.client_acceptance.approve.workspace','techcontracts','supplier_requests.client_acceptance','approve','workspace','Conferir aceite do cliente final','Financeiro configurado confere o aceite registrado por outra pessoa.',true)
ON CONFLICT(key) DO NOTHING;

-- Special condition (0374 blocked it): now allowed only for client purpose with a canonical project/deal/commercial contract.
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
 IF NEW.status='ready' AND NEW.purpose='client' AND NEW.deal_id IS NULL AND NEW.commercial_contract_id IS NULL THEN RAISE EXCEPTION 'Associe o negócio ou contrato comercial para preparar uma contratação de cliente.'; END IF;
 IF NEW.status='ready' AND (NEW.area_id IS NULL OR NEW.legal_entity_id IS NULL OR length(btrim(NEW.scope_text))=0 OR (NEW.kind='supplier' AND NEW.company_id IS NULL)) THEN RAISE EXCEPTION 'Preencha escopo, área, entidade legal e fornecedor quando aplicável.'; END IF;
 IF NEW.kind='professional' AND (NEW.release_condition IS NOT NULL OR (NEW.selection_mode='needs_selection' AND NEW.person_id IS NOT NULL) OR (NEW.status='ready' AND NEW.selection_mode='defined' AND NEW.person_id IS NULL)) THEN RAISE EXCEPTION 'Profissional definido exige pessoa real; necessidade de seleção não vincula pessoa nem abre vaga.'; END IF;
 IF NEW.kind='supplier' AND NEW.status='ready' AND NEW.release_condition='also_client_acceptance' AND (NEW.purpose IS DISTINCT FROM 'client' OR (NEW.project_id IS NULL AND NEW.commercial_contract_id IS NULL AND NEW.deal_id IS NULL)) THEN RAISE EXCEPTION 'Aceite do cliente final exige finalidade Cliente vinculada a projeto, negócio ou contrato comercial canônico.'; END IF;
 IF NEW.kind='supplier' AND NEW.status='ready' AND NEW.release_condition IS NULL THEN RAISE EXCEPTION 'Informe condição de liberação do fornecedor para revisão.'; END IF;
 RETURN NEW;
END $$;

-- ---------------- Tables (private: no grants to authenticated; reads/writes only through definer RPCs) ----------------
CREATE TABLE public.hiring_client_acceptances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 delivery_id uuid NOT NULL,
 delivery_version integer NOT NULL,
 delivery_hash text NOT NULL,
 target_kind text NOT NULL CHECK(target_kind IN('project','commercial_contract','deal')),
 target_id uuid NOT NULL,
 accepted_by_name text NOT NULL CHECK(length(btrim(accepted_by_name)) BETWEEN 3 AND 200),
 accepted_by_role text NOT NULL CHECK(length(btrim(accepted_by_role)) BETWEEN 2 AND 120),
 accepted_on date NOT NULL,
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 5 AND 500),
 content_hash text NOT NULL,
 status text NOT NULL DEFAULT 'registered' CHECK(status IN('registered','confirmed','rejected')),
 operation_id uuid NOT NULL UNIQUE,
 registered_by uuid NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid,
 decision_reason text,
 decided_at timestamptz,
 decision_operation uuid UNIQUE,
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES public.hiring_execution_deliveries(workspace_id,id),
 FOREIGN KEY(delivery_id,delivery_version) REFERENCES public.hiring_execution_delivery_versions(delivery_id,version)
);
CREATE UNIQUE INDEX hiring_client_acceptance_open ON public.hiring_client_acceptances(delivery_id,delivery_version) WHERE status IN('registered','confirmed');

CREATE TABLE public.hiring_payable_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 start_id uuid NOT NULL REFERENCES public.hiring_execution_starts(id),
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 person_id uuid,
 company_id uuid,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 contract_hash text NOT NULL,
 request_revision integer NOT NULL,
 legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id),
 plan_id uuid NOT NULL REFERENCES public.hiring_economic_plans(id),
 plan_version integer NOT NULL,
 plan_hash text NOT NULL,
 preview_hash text NOT NULL,
 competence date NOT NULL CHECK(competence=date_trunc('month',competence)::date),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 total numeric(14,2) NOT NULL CHECK(total>0),
 fiscal_document_id uuid REFERENCES public.hiring_fiscal_documents(id),
 justification text NOT NULL CHECK(length(btrim(justification)) BETWEEN 10 AND 2000),
 payload_hash text NOT NULL,
 operation_id uuid NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(plan_id,plan_version) REFERENCES public.hiring_economic_plan_versions(plan_id,version)
);
CREATE TABLE public.hiring_payable_installments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 schedule_id uuid NOT NULL,
 seq smallint NOT NULL CHECK(seq BETWEEN 1 AND 24),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 due_on date NOT NULL,
 financial_entry_id uuid NOT NULL UNIQUE,
 external_ref text NOT NULL UNIQUE,
 UNIQUE(schedule_id,seq),
 FOREIGN KEY(workspace_id,schedule_id) REFERENCES public.hiring_payable_schedules(workspace_id,id),
 FOREIGN KEY(financial_entry_id) REFERENCES public.financial_entries(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE public.hiring_payable_reconciliations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 decision text NOT NULL CHECK(decision IN('linked','unrelated')),
 financial_entry_id uuid REFERENCES public.financial_entries(id),
 recurrence_id uuid REFERENCES public.financial_recurrences(id),
 competence date NOT NULL CHECK(competence=date_trunc('month',competence)::date),
 plan_id uuid REFERENCES public.hiring_economic_plans(id),
 plan_version integer,
 plan_hash text,
 preview_hash text,
 compatibility jsonb NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 payload_hash text NOT NULL,
 operation_id uuid NOT NULL UNIQUE,
 finance_user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 CHECK((financial_entry_id IS NULL)<>(recurrence_id IS NULL)),
 CHECK(decision='unrelated' OR (financial_entry_id IS NOT NULL AND plan_hash IS NOT NULL))
);
-- One decision per legacy title/recurrence and contract: a title is never linked twice nor to two contracts.
CREATE UNIQUE INDEX hiring_recon_entry ON public.hiring_payable_reconciliations(financial_entry_id) WHERE financial_entry_id IS NOT NULL AND decision='linked';
CREATE INDEX hiring_recon_entry_contract ON public.hiring_payable_reconciliations(contract_id,financial_entry_id,competence) WHERE financial_entry_id IS NOT NULL;
CREATE INDEX hiring_recon_recurrence_contract ON public.hiring_payable_reconciliations(contract_id,recurrence_id,competence) WHERE recurrence_id IS NOT NULL;

-- Stable source claims: contract + canonical source (+ competence for monthly). Independent of plan version/order.
CREATE TABLE public.hiring_payable_source_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 claim_key text NOT NULL UNIQUE,
 source_kind text NOT NULL CHECK(source_kind IN('delivery','monthly','time_entry')),
 competence date NOT NULL,
 delivery_id uuid,
 delivery_version integer,
 delivery_decision_id uuid REFERENCES public.hiring_execution_delivery_decisions(id),
 client_acceptance_id uuid REFERENCES public.hiring_client_acceptances(id),
 time_entry_id uuid REFERENCES public.project_time_entries(id),
 time_entry_revision integer,
 period_closing_id uuid REFERENCES public.project_period_closings(id),
 seconds bigint,
 amount numeric(14,2),
 source_hash text NOT NULL,
 plan_id uuid NOT NULL REFERENCES public.hiring_economic_plans(id),
 plan_version integer NOT NULL,
 plan_hash text NOT NULL,
 schedule_id uuid REFERENCES public.hiring_payable_schedules(id),
 reconciliation_id uuid REFERENCES public.hiring_payable_reconciliations(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(delivery_id,delivery_version) REFERENCES public.hiring_execution_delivery_versions(delivery_id,version),
 CHECK((schedule_id IS NULL)<>(reconciliation_id IS NULL)),
 CHECK(source_kind<>'delivery' OR (delivery_decision_id IS NOT NULL AND delivery_id IS NOT NULL)),
 CHECK(source_kind<>'time_entry' OR (time_entry_id IS NOT NULL AND period_closing_id IS NOT NULL))
);
CREATE INDEX hiring_claim_time ON public.hiring_payable_source_claims(time_entry_id) WHERE time_entry_id IS NOT NULL;
CREATE INDEX hiring_claim_closing ON public.hiring_payable_source_claims(period_closing_id) WHERE period_closing_id IS NOT NULL;
CREATE INDEX hiring_claim_delivery ON public.hiring_payable_source_claims(delivery_id) WHERE delivery_id IS NOT NULL;
-- Fiscal/payroll document balance reservation (never above the verified amount, never reused beyond it).
CREATE TABLE public.hiring_fiscal_document_allocations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 document_id uuid NOT NULL REFERENCES public.hiring_fiscal_documents(id),
 schedule_id uuid REFERENCES public.hiring_payable_schedules(id),
 reconciliation_id uuid REFERENCES public.hiring_payable_reconciliations(id),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((schedule_id IS NULL)<>(reconciliation_id IS NULL))
);
CREATE INDEX hiring_fiscal_alloc_doc ON public.hiring_fiscal_document_allocations(document_id);

REVOKE ALL ON public.hiring_client_acceptances,public.hiring_payable_schedules,public.hiring_payable_installments,public.hiring_payable_reconciliations,public.hiring_payable_source_claims,public.hiring_fiscal_document_allocations FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT ALL ON public.hiring_client_acceptances,public.hiring_payable_schedules,public.hiring_payable_installments,public.hiring_payable_reconciliations,public.hiring_payable_source_claims,public.hiring_fiscal_document_allocations TO service_role;
ALTER TABLE public.hiring_client_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_payable_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_payable_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_payable_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_payable_source_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_fiscal_document_allocations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER hiring_pay_schedule_immutable BEFORE UPDATE OR DELETE ON public.hiring_payable_schedules FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_pay_installment_immutable BEFORE UPDATE OR DELETE ON public.hiring_payable_installments FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_pay_recon_immutable BEFORE UPDATE OR DELETE ON public.hiring_payable_reconciliations FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_pay_claim_immutable BEFORE UPDATE OR DELETE ON public.hiring_payable_source_claims FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_pay_alloc_immutable BEFORE UPDATE OR DELETE ON public.hiring_fiscal_document_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE FUNCTION public.hiring_client_acceptance_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Aceite do cliente é histórico.';END IF;
 IF OLD.status<>'registered' OR NEW.status NOT IN('confirmed','rejected') OR (to_jsonb(NEW)-ARRAY['status','decided_by','decision_reason','decided_at','decision_operation']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_by','decision_reason','decided_at','decision_operation']) THEN RAISE EXCEPTION 'Aceite do cliente registrado é imutável.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_client_acceptance_guard BEFORE UPDATE OR DELETE ON public.hiring_client_acceptances FOR EACH ROW EXECUTE FUNCTION public.hiring_client_acceptance_guard();

-- ---------------- Integrity guards on canonical finance and on frozen sources ----------------
-- Contracts governed by this flow: every contract with an authorized hiring start (package 4). Older ATS/sales contracts are untouched.
CREATE FUNCTION public.hiring_pay_governed(k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT k IS NOT NULL AND (EXISTS(SELECT 1 FROM hiring_execution_starts WHERE contract_id=k) OR EXISTS(SELECT 1 FROM contracts WHERE id=k AND hiring_request_origin IS NOT NULL))
$$;
CREATE FUNCTION public.hiring_pay_entry_claimed(e uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_payable_installments WHERE financial_entry_id=e) OR EXISTS(SELECT 1 FROM hiring_payable_reconciliations WHERE financial_entry_id=e AND decision='linked')
$$;
CREATE FUNCTION public.hiring_pay_payroll_person(notes text) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT (regexp_match(coalesce(notes,''),'\[people_payroll:([0-9a-fA-F-]{36})\]'))[1]::uuid
$$;
CREATE FUNCTION public.hiring_pay_entry_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i hiring_payable_installments;sc hiring_payable_schedules;pp uuid;locked text[]:=ARRAY['workspace_id','direction','origin_type','origin_id','contract_id','amount','currency','competence_date','due_date','legal_entity_id','counterparty_company_id','external_ref','parent_entry_id','installment_number','installment_total'];
BEGIN
 IF TG_OP='DELETE' THEN
  IF hiring_pay_entry_claimed(OLD.id) OR hiring_pay_governed(OLD.contract_id) OR (OLD.origin_type::text='contract' AND hiring_pay_governed(OLD.origin_id)) THEN RAISE EXCEPTION 'Título vinculado à contratação governada não pode ser excluído.';END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='INSERT' THEN
  IF hiring_pay_governed(NEW.contract_id) OR (NEW.origin_type::text='contract' AND hiring_pay_governed(NEW.origin_id)) THEN
   SELECT * INTO i FROM hiring_payable_installments WHERE financial_entry_id=NEW.id;
   SELECT * INTO sc FROM hiring_payable_schedules WHERE id=i.schedule_id;
   IF i.id IS NULL OR sc.contract_id IS DISTINCT FROM NEW.contract_id OR NEW.origin_type::text<>'contract' OR NEW.origin_id IS DISTINCT FROM sc.contract_id OR NEW.direction::text<>'payable'
    OR NEW.status::text<>'open' OR NEW.paid_amount<>0 OR NEW.amount<>i.amount OR NEW.due_date<>i.due_on OR NEW.currency<>sc.currency OR NEW.workspace_id<>sc.workspace_id
    OR NEW.legal_entity_id IS DISTINCT FROM sc.legal_entity_id OR NEW.external_ref IS DISTINCT FROM i.external_ref OR NEW.competence_date<>sc.competence THEN
    RAISE EXCEPTION 'Títulos desta contratação só nascem pelo fluxo governado de contas a pagar.' USING ERRCODE='42501';
   END IF;
  END IF;
  -- Legacy payroll generation stays, but cannot duplicate a competence already claimed by the governed flow.
  pp:=hiring_pay_payroll_person(NEW.notes);
  IF pp IS NOT NULL AND EXISTS(SELECT 1 FROM hiring_payable_schedules s WHERE s.workspace_id=NEW.workspace_id AND s.person_id=pp AND s.competence=date_trunc('month',NEW.competence_date)::date) OR (pp IS NOT NULL AND EXISTS(SELECT 1 FROM hiring_payable_reconciliations reconciliation JOIN hiring_preparation_requests request ON request.id=reconciliation.request_id WHERE reconciliation.workspace_id=NEW.workspace_id AND reconciliation.decision='linked' AND request.person_id=pp AND reconciliation.competence=date_trunc('month',NEW.competence_date)::date)) THEN
   RAISE EXCEPTION 'Competência já possui obrigação gerada pela contratação governada desta pessoa.';
  END IF;
  RETURN NEW;
 END IF;
 IF hiring_pay_governed(NEW.contract_id) AND NOT hiring_pay_governed(OLD.contract_id) THEN RAISE EXCEPTION 'Não é possível mover título para contrato de contratação governada; use a conciliação.' USING ERRCODE='42501';END IF;
 IF NEW.origin_type::text='contract' AND hiring_pay_governed(NEW.origin_id) AND NOT (OLD.origin_type::text='contract' AND OLD.origin_id IS NOT DISTINCT FROM NEW.origin_id) THEN RAISE EXCEPTION 'Não é possível apontar título para contrato de contratação governada; use a conciliação.' USING ERRCODE='42501';END IF;
 IF hiring_pay_entry_claimed(OLD.id) OR hiring_pay_governed(OLD.contract_id) OR (OLD.origin_type::text='contract' AND hiring_pay_governed(OLD.origin_id)) THEN
  IF (SELECT bool_or((to_jsonb(NEW)->k) IS DISTINCT FROM (to_jsonb(OLD)->k)) FROM unnest(locked) k) THEN RAISE EXCEPTION 'Lastro do título governado é imutável; registre revisão/aditivo explícito.';END IF;
  IF NEW.status::text='cancelled' AND OLD.status::text<>'cancelled' THEN RAISE EXCEPTION 'Título governado não é cancelado diretamente; registre revisão/aditivo explícito.';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_pay_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_entry_guard();
CREATE FUNCTION public.hiring_pay_recurrence_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF hiring_pay_governed(nullif(NEW.template->>'contract_id','')::uuid) OR (NEW.template->>'origin_type'='contract' AND hiring_pay_governed(nullif(NEW.template->>'origin_id','')::uuid)) THEN
  RAISE EXCEPTION 'Contratação governada não usa recorrência; gere parcelas pelo fluxo de contas a pagar.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_pay_recurrence_guard BEFORE INSERT OR UPDATE ON public.financial_recurrences FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_recurrence_guard();
-- Frozen sources: claimed hours, closings and deliveries keep their backing. Sales billing fields (invoice_id, financial_entry_id) stay free.
CREATE FUNCTION public.hiring_pay_time_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_payable_source_claims WHERE time_entry_id=OLD.id) THEN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['invoice_id','financial_entry_id','invoiced_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['invoice_id','financial_entry_id','invoiced_at','updated_at']) THEN
   RAISE EXCEPTION 'Apontamento é lastro de conta a pagar; correções exigem revisão/aditivo explícito.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER hiring_pay_time_guard BEFORE UPDATE OR DELETE ON public.project_time_entries FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_time_guard();
CREATE FUNCTION public.hiring_pay_closing_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_payable_source_claims WHERE period_closing_id=OLD.id) AND (TG_OP='DELETE' OR (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at')) THEN
  RAISE EXCEPTION 'Fechamento é lastro de conta a pagar e não pode ser reaberto.';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER hiring_pay_closing_guard BEFORE UPDATE OR DELETE ON public.project_period_closings FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_closing_guard();
CREATE FUNCTION public.hiring_pay_delivery_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_payable_source_claims WHERE delivery_id=OLD.id) AND (TG_OP='DELETE' OR (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at')) THEN
  RAISE EXCEPTION 'Entrega com obrigação gerada não muda; registre nova entrega ou aditivo explícito.';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER hiring_pay_delivery_guard BEFORE UPDATE OR DELETE ON public.hiring_execution_deliveries FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_delivery_guard();

-- Allocations backing claimed time may end prospectively, but cannot erase the person/project/contract or claimed dates.
CREATE FUNCTION public.hiring_pay_allocation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_payable_source_claims claim JOIN project_time_entries entry ON entry.id=claim.time_entry_id WHERE entry.allocation_id=OLD.id) THEN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['ends_at','status','can_track_time','notes','updated_at','period_override_reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['ends_at','status','can_track_time','notes','updated_at','period_override_reason']) OR EXISTS(SELECT 1 FROM hiring_payable_source_claims claim JOIN project_time_entries entry ON entry.id=claim.time_entry_id WHERE entry.allocation_id=OLD.id AND NEW.ends_at IS NOT NULL AND entry.entry_date>NEW.ends_at) THEN
   RAISE EXCEPTION 'Alocação é lastro de conta a pagar; preserve vínculos e datas já utilizadas.';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER hiring_pay_allocation_guard BEFORE UPDATE OR DELETE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_pay_allocation_guard();
REVOKE ALL ON FUNCTION public.hiring_pay_allocation_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
-- Caller-RLS probes run as the existing non-BYPASSRLS writer, with the caller JWT unchanged.
CREATE FUNCTION public.hiring_pay_visible_entries(ids uuid[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id FROM financial_entries WHERE id=ANY(ids) $$;
CREATE FUNCTION public.hiring_pay_visible_recurrences(ids uuid[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id FROM financial_recurrences WHERE id=ANY(ids) $$;
DO $pay_owner$ DECLARE had_create boolean:=has_schema_privilege('techerp_request_writer','public','CREATE');BEGIN
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO techerp_request_writer;END IF;
 ALTER FUNCTION public.hiring_pay_visible_entries(uuid[]) OWNER TO techerp_request_writer;
 ALTER FUNCTION public.hiring_pay_visible_recurrences(uuid[]) OWNER TO techerp_request_writer;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM techerp_request_writer;END IF;
END $pay_owner$;
REVOKE ALL ON FUNCTION public.hiring_pay_visible_entries(uuid[]),public.hiring_pay_visible_recurrences(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
-- Ignore only derived payment/run bookkeeping when binding a human 'unrelated' decision.
CREATE FUNCTION public.hiring_pay_target_hash(target jsonb,kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT hiring_ops_hash((CASE kind WHEN 'entry' THEN target-ARRAY['status','paid_amount','updated_at'] ELSE target-ARRAY['occurrences_generated','next_run_date','last_generated_entry_id','updated_at'] END)::text)
$$;
REVOKE ALL ON FUNCTION public.hiring_pay_target_hash(jsonb,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
-- ---------------- Authorization ----------------
CREATE FUNCTION public.hiring_pay_subject(w uuid,u uuid,k text,act text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u IS NOT NULL AND act IN('payables.view','payables.manage','payables_reconciliation.approve','client_acceptance.manage','client_acceptance.approve')
 AND (act NOT LIKE 'client_acceptance.%' OR k='supplier')
 AND hiring_preparation_approval_subject(w,u,k,'view')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x=CASE k WHEN 'professional' THEN 'techpeople.hiring_requests' ELSE 'techcontracts.supplier_requests' END||'.'||act||'.workspace')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techfinance.entries.'||CASE act WHEN 'payables.manage' THEN 'create' WHEN 'payables_reconciliation.approve' THEN 'update' ELSE 'view' END||'.workspace')
$$;
CREATE FUNCTION public.hiring_pay_actor(w uuid,i uuid,act text,write boolean) RETURNS public.hiring_preparation_requests LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 IF auth.uid() IS NULL OR r.id IS NULL OR s.id IS NULL OR (write AND is_read_only_view()) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
  OR NOT hiring_preparation_access(w,r.kind,'view') OR NOT hiring_pay_subject(w,auth.uid(),r.kind,act) OR NOT hiring_econ_private_ok(w,r,s.contract_id)
  OR (act IN('payables.manage','payables_reconciliation.approve') AND (NOT hiring_pay_subject(w,auth.uid(),r.kind,'payables.view') OR NOT hiring_econ_subject(w,auth.uid(),r.kind,'economics.view') OR NOT hiring_ops_subject(w,auth.uid(),r.kind,'fiscal_documents.view'))) THEN
  RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';
 END IF;
 RETURN r;
END $$;
CREATE FUNCTION public.hiring_pay_finance_only() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE fin uuid;
BEGIN
 SELECT finance_user_id INTO fin FROM contract_handoff_settings WHERE workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND enabled;
 IF fin IS NULL THEN RAISE EXCEPTION 'Configure o responsável Financeiro nas configurações contratuais existentes.';END IF;
 IF fin<>auth.uid() THEN RAISE EXCEPTION 'Somente o responsável Financeiro configurado executa esta ação.' USING ERRCODE='42501';END IF;
END $$;

-- ---------------- Eligible lines (current approved plan + compute), selection and legacy detection ----------------
CREATE FUNCTION public.hiring_pay_line_key(l jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE l->>'type' WHEN 'delivery' THEN 'delivery:'||(l->>'delivery_id') WHEN 'monthly' THEN 'monthly:'||(l->>'competence') ELSE 'hourly:'||coalesce(l->>'project_id','*') END
$$;
CREATE FUNCTION public.hiring_pay_eligible(w uuid,i uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v jsonb;r hiring_preparation_requests;s hiring_execution_starts;l jsonb;out jsonb:='[]';lo date;hi date;issue text;ca hiring_client_acceptances;claimed boolean;
BEGIN
 lo:=date_trunc('month',p_month)::date;hi:=(lo+interval '1 month - 1 day')::date;
 IF lo>date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Competência futura não gera obrigação.';END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 v:=hiring_econ_compute(w,i,lo);
 FOR l IN SELECT * FROM jsonb_array_elements(v->'lines') LOOP
  issue:=l->>'issue';
  IF issue IS NULL AND l->>'type'='monthly' AND hi>=current_date THEN issue:='period_open';END IF;
  IF issue IS NULL AND l->>'type'='hourly' AND coalesce((l->>'seconds')::bigint,0)=0 THEN issue:='no_closed_hours';END IF;
  IF issue IS NULL AND r.kind='supplier' AND r.release_condition='also_client_acceptance' THEN
   IF l->>'type'<>'delivery' THEN issue:='client_acceptance_needs_delivery';
   ELSE
    SELECT * INTO ca FROM hiring_client_acceptances WHERE delivery_id=(l->>'delivery_id')::uuid AND delivery_version=(l->>'delivery_version')::int AND status='confirmed';
    IF ca.id IS NULL OR ca.delivery_hash IS DISTINCT FROM (SELECT content_hash FROM hiring_execution_delivery_versions WHERE delivery_id=ca.delivery_id AND version=ca.delivery_version) THEN issue:='client_acceptance_missing';
    ELSE l:=l||jsonb_build_object('client_acceptance_id',ca.id);END IF;
   END IF;
  END IF;
  claimed:=CASE l->>'type'
   WHEN 'delivery' THEN EXISTS(SELECT 1 FROM hiring_payable_source_claims WHERE claim_key=s.contract_id||':delivery:'||(l->>'delivery_id'))
   WHEN 'monthly' THEN EXISTS(SELECT 1 FROM hiring_payable_source_claims WHERE claim_key=s.contract_id||':monthly:'||lo)
   ELSE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(l->'entries','[]')) e JOIN hiring_payable_source_claims c ON c.claim_key=s.contract_id||':time_entry:'||(e->>'id')) END;
  IF claimed THEN issue:='already_claimed';END IF;
  out:=out||(l||jsonb_build_object('key',hiring_pay_line_key(l),'blocking',issue));
 END LOOP;
 RETURN jsonb_build_object('preview_hash',v->>'hash','plan_id',v->>'plan_id','plan_version',(v->>'plan_version')::int,'plan_hash',v->>'plan_hash','currency',v->>'currency','competence',lo,'lines',out);
END $$;
-- Legacy titles/recurrences that could already cover the same obligation and still lack an explicit decision.
CREATE FUNCTION public.hiring_pay_legacy(w uuid,i uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;lo date;e jsonb;rc jsonb;projs uuid[];plan hiring_economic_plans;version_hash text;ids uuid[];
BEGIN
 lo:=date_trunc('month',p_month)::date;
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 SELECT * INTO plan FROM hiring_economic_plans WHERE request_id=i AND workspace_id=w;
 SELECT content_hash INTO version_hash FROM hiring_economic_plan_versions WHERE plan_id=plan.id AND version=plan.version;
 SELECT coalesce(array_agg(DISTINCT project_id),'{}') INTO projs FROM people_allocations WHERE workspace_id=w AND s.engagement_id IS NOT NULL AND hiring_engagement_id=s.engagement_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'kind','entry','description',f.description,'amount',f.amount,'currency',f.currency,'status',f.status::text,'due_date',f.due_date,'competence',f.competence_date,
   'origin_type',f.origin_type::text,'paid',f.paid_amount,
   'match',CASE WHEN f.contract_id=s.contract_id OR f.origin_id=s.contract_id THEN 'contract' WHEN hiring_pay_payroll_person(f.notes)=r.person_id THEN 'payroll' ELSE 'counterparty' END) ORDER BY f.due_date),'[]') INTO e
  FROM financial_entries f
  WHERE f.workspace_id=w AND f.direction::text='payable' AND f.status::text<>'cancelled' AND date_trunc('month',f.competence_date)::date=lo
   AND NOT EXISTS(SELECT 1 FROM hiring_payable_installments x WHERE x.financial_entry_id=f.id)
   AND NOT EXISTS(SELECT 1 FROM hiring_payable_reconciliations x WHERE x.financial_entry_id=f.id AND x.contract_id=s.contract_id AND x.decision='unrelated' AND x.competence=lo AND x.plan_hash=version_hash AND x.compatibility->>'target_hash'=hiring_pay_target_hash(to_jsonb(f),'entry'))
   AND NOT EXISTS(SELECT 1 FROM hiring_payable_reconciliations x WHERE x.financial_entry_id=f.id AND x.decision='linked')
   AND (f.contract_id=s.contract_id OR (f.origin_type::text='contract' AND f.origin_id=s.contract_id)
    OR (r.person_id IS NOT NULL AND hiring_pay_payroll_person(f.notes)=r.person_id)
    OR (r.company_id IS NOT NULL AND f.counterparty_company_id=r.company_id AND (f.contract_id IS NOT NULL OR f.service_id IS NOT NULL OR f.project_id IS NOT NULL OR f.origin_type::text IN('contract','service','project_milestone','project_measurement')))
    OR (f.project_id=ANY(projs) AND hiring_pay_payroll_person(f.notes) IS NOT DISTINCT FROM r.person_id AND r.person_id IS NOT NULL));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind','recurrence','description',x.template->>'description','amount',x.template->>'amount','cadence',x.cadence,'next_run_date',x.next_run_date)),'[]') INTO rc
  FROM financial_recurrences x
  WHERE x.workspace_id=w AND x.active AND x.direction='payable'
   AND NOT EXISTS(SELECT 1 FROM hiring_payable_reconciliations y WHERE y.recurrence_id=x.id AND y.contract_id=s.contract_id AND y.decision='unrelated' AND y.competence=lo AND y.plan_hash=version_hash AND y.compatibility->>'target_hash'=hiring_pay_target_hash(to_jsonb(x),'recurrence'))
   AND (x.template->>'contract_id'=s.contract_id::text OR x.template->>'origin_id'=s.contract_id::text
    OR (r.person_id IS NOT NULL AND hiring_pay_payroll_person(x.template->>'notes')=r.person_id)
    OR (r.company_id IS NOT NULL AND x.template->>'counterparty_company_id'=r.company_id::text));
 SELECT coalesce(array_agg((value->>'id')::uuid),'{}') INTO ids FROM jsonb_array_elements(e);
 IF cardinality(ids)<>(SELECT count(*) FROM hiring_pay_visible_entries(ids)) THEN RAISE EXCEPTION 'Há fontes financeiras indisponíveis ao seu usuário; conciliação bloqueada.' USING ERRCODE='42501';END IF;
 SELECT coalesce(array_agg((value->>'id')::uuid),'{}') INTO ids FROM jsonb_array_elements(rc);
 IF cardinality(ids)<>(SELECT count(*) FROM hiring_pay_visible_recurrences(ids)) THEN RAISE EXCEPTION 'Há recorrências indisponíveis ao seu usuário; conciliação bloqueada.' USING ERRCODE='42501';END IF;
 RETURN e||rc;
END $$;
-- Selection: explicit keys, every key eligible, unique; returns chosen lines and exact total.
CREATE FUNCTION public.hiring_pay_select(el jsonb,p_keys jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE k text;l jsonb;chosen jsonb:='[]';total numeric:=0;seen text[]:='{}';
BEGIN
 IF p_keys IS NULL OR jsonb_typeof(p_keys)<>'array' OR jsonb_array_length(p_keys) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Selecione explicitamente as linhas/fontes (1 a 50).';END IF;
 FOR k IN SELECT jsonb_array_elements_text(p_keys) LOOP
  IF k=ANY(seen) THEN RAISE EXCEPTION 'Linha selecionada em duplicidade.';END IF;
  seen:=seen||k;
  SELECT x INTO l FROM jsonb_array_elements(el->'lines') x WHERE x->>'key'=k;
  IF l IS NULL THEN RAISE EXCEPTION 'Linha % não existe no cálculo atual; recalcule.',k;END IF;
  IF l->>'blocking' IS NOT NULL THEN RAISE EXCEPTION 'Linha % pendente (%); pendências não viram zero nem obrigação.',k,l->>'blocking';END IF;
  IF l->>'amount' IS NULL OR (l->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Linha % sem valor conferido.',k;END IF;
  chosen:=chosen||l;total:=total+(l->>'amount')::numeric;
 END LOOP;
 RETURN jsonb_build_object('lines',chosen,'total',round(total,2));
END $$;
-- Writes stable claims for the chosen lines (unique claim_key => concurrent/duplicate sources fail).
CREATE FUNCTION public.hiring_pay_claim(w uuid,s public.hiring_execution_starts,el jsonb,chosen jsonb,p_schedule uuid,p_recon uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l jsonb;e jsonb;lo date:=(el->>'competence')::date;ph text:=el->>'plan_hash';pid uuid:=(el->>'plan_id')::uuid;pv int:=(el->>'plan_version')::int;
BEGIN
 FOR l IN SELECT * FROM jsonb_array_elements(chosen) LOOP
  BEGIN
   IF l->>'type'='delivery' THEN
    INSERT INTO hiring_payable_source_claims(workspace_id,contract_id,claim_key,source_kind,competence,delivery_id,delivery_version,delivery_decision_id,client_acceptance_id,amount,source_hash,plan_id,plan_version,plan_hash,schedule_id,reconciliation_id)
    SELECT w,s.contract_id,s.contract_id||':delivery:'||(l->>'delivery_id'),'delivery',lo,(l->>'delivery_id')::uuid,(l->>'delivery_version')::int,(l->>'decision_id')::uuid,nullif(l->>'client_acceptance_id','')::uuid,(l->>'amount')::numeric,
     dv.content_hash,pid,pv,ph,p_schedule,p_recon FROM hiring_execution_delivery_versions dv WHERE dv.delivery_id=(l->>'delivery_id')::uuid AND dv.version=(l->>'delivery_version')::int;
   ELSIF l->>'type'='monthly' THEN
    INSERT INTO hiring_payable_source_claims(workspace_id,contract_id,claim_key,source_kind,competence,amount,source_hash,plan_id,plan_version,plan_hash,schedule_id,reconciliation_id)
    VALUES(w,s.contract_id,s.contract_id||':monthly:'||lo,'monthly',lo,(l->>'amount')::numeric,hiring_ops_hash(l::text),pid,pv,ph,p_schedule,p_recon);
   ELSE
    FOR e IN SELECT * FROM jsonb_array_elements(l->'entries') LOOP
     INSERT INTO hiring_payable_source_claims(workspace_id,contract_id,claim_key,source_kind,competence,time_entry_id,time_entry_revision,period_closing_id,seconds,source_hash,plan_id,plan_version,plan_hash,schedule_id,reconciliation_id)
     VALUES(w,s.contract_id,s.contract_id||':time_entry:'||(e->>'id'),'time_entry',lo,(e->>'id')::uuid,(e->>'revision')::int,(e->>'closing')::uuid,(e->>'seconds')::bigint,hiring_ops_hash(e::text),pid,pv,ph,p_schedule,p_recon);
    END LOOP;
   END IF;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_SOURCE: fonte já possui obrigação ou conciliação.';
  END;
 END LOOP;
END $$;
-- Fiscal/payroll document requirements and reservation under a row lock.
CREATE FUNCTION public.hiring_pay_reserve_document(w uuid,r public.hiring_preparation_requests,s public.hiring_execution_starts,p_doc uuid,p_currency text,p_amount numeric,chosen jsonb,p_schedule uuid,p_recon uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d hiring_fiscal_documents;used numeric;expected text[];counter text;
BEGIN
 expected:=CASE WHEN r.kind='supplier' THEN ARRAY['nfse','nfe'] WHEN r.regime='clt' THEN ARRAY['payroll_evidence'] WHEN r.regime='freelance' THEN ARRAY['freelance_document'] ELSE ARRAY['nfse','nfe'] END;
 IF p_doc IS NULL THEN RAISE EXCEPTION '%',CASE WHEN r.regime='clt' THEN 'CLT exige evidência de folha conferida (sem nota fiscal fictícia).' ELSE 'Exige documento fiscal conferido pelo Financeiro.' END;END IF;
 SELECT * INTO d FROM hiring_fiscal_documents WHERE id=p_doc AND workspace_id=w AND request_id=r.id FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Documento indisponível para esta solicitação.';END IF;
 IF d.server_attested_at IS NULL OR d.server_sha256 IS DISTINCT FROM d.sha256 THEN RAISE EXCEPTION 'Arquivo fiscal sem confirmação dos bytes pelo servidor.';END IF;
 IF d.status<>'verified' OR NOT EXISTS(SELECT 1 FROM hiring_fiscal_document_reviews review WHERE review.document_id=d.id AND review.workspace_id=w AND review.decision='verified' AND review.sha256=d.sha256) THEN RAISE EXCEPTION 'Documento ainda não conferido pelo Financeiro (conferência humana; não é validação SEFAZ).';END IF;
 IF NOT d.doc_type=ANY(expected) THEN RAISE EXCEPTION 'Tipo de documento incompatível com o regime (%).',array_to_string(expected,'/');END IF;
 IF d.currency IS DISTINCT FROM p_currency THEN RAISE EXCEPTION 'Moeda do documento diverge da obrigação.';END IF;
 IF d.doc_type<>'payroll_evidence' AND d.taker_tax_id IS DISTINCT FROM (SELECT hiring_ops_digits(cnpj) FROM legal_entities WHERE id=s.legal_entity_id) THEN RAISE EXCEPTION 'Tomador do documento diverge do CNPJ WK do contrato.';END IF;
 counter:=CASE WHEN r.kind='supplier' OR (r.regime='pj' AND r.company_id IS NOT NULL) THEN (SELECT hiring_ops_digits(cnpj) FROM companies WHERE id=r.company_id AND workspace_id=w) WHEN r.regime='pj' THEN (SELECT hiring_ops_digits(to_jsonb(p)->>'cnpj') FROM people p WHERE id=r.person_id AND workspace_id=w) WHEN r.regime='clt' THEN (SELECT hiring_ops_digits(cnpj) FROM legal_entities WHERE id=s.legal_entity_id AND workspace_id=w) ELSE (SELECT CASE WHEN d.modality='nfse' THEN coalesce(hiring_ops_digits(to_jsonb(p)->>'cnpj'),hiring_ops_digits(to_jsonb(p)->'personal_doc'->>'cpf')) ELSE hiring_ops_digits(to_jsonb(p)->'personal_doc'->>'cpf') END FROM people p WHERE id=r.person_id AND workspace_id=w) END;
 IF counter IS NOT NULL AND d.issuer_tax_id IS DISTINCT FROM counter THEN RAISE EXCEPTION 'Emissor do documento diverge do contratado.';END IF;
 IF counter IS NULL THEN RAISE EXCEPTION 'Contratado sem CNPJ canônico para conferir o emissor.';END IF;
 IF d.delivery_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(chosen) ch(v) WHERE ch.v->>'type'='delivery' AND (ch.v->>'delivery_id')::uuid=d.delivery_id) THEN RAISE EXCEPTION 'Documento vinculado a outra entrega.';END IF;
 SELECT coalesce(sum(amount),0) INTO used FROM hiring_fiscal_document_allocations WHERE document_id=d.id;
 IF used+p_amount>d.amount THEN RAISE EXCEPTION 'Saldo do documento insuficiente: conferido %, já utilizado %.',d.amount,used;END IF;
 INSERT INTO hiring_fiscal_document_allocations(workspace_id,document_id,schedule_id,reconciliation_id,amount) VALUES(w,d.id,p_schedule,p_recon,p_amount);
END $$;

-- ---------------- Generate canonical installments ----------------
CREATE FUNCTION public.hiring_payable_generate(w uuid,i uuid,p_month date,p_preview_hash text,p_keys jsonb,p_installments jsonb,p_document uuid,p_justification text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;el jsonb;sel jsonb;prev hiring_payable_schedules;payload text;problem text;sid uuid;x jsonb;n int:=0;cnt int;sum_i numeric:=0;eid uuid;lo date;legacy jsonb;
BEGIN
 r:=hiring_pay_actor(w,i,'payables.manage',true);
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Operação obrigatória.';END IF;
 lo:=date_trunc('month',p_month)::date;
 payload:=hiring_ops_hash(jsonb_build_object('w',w,'i',i,'m',lo,'h',p_preview_hash,'k',p_keys,'n',p_installments,'d',p_document,'j',btrim(coalesce(p_justification,'')))::text);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring_payable:'||s.contract_id,0));
 SELECT * INTO prev FROM hiring_payable_schedules WHERE operation_id=p_operation;
 IF prev.id IS NOT NULL THEN
  IF prev.workspace_id<>w OR prev.created_by<>auth.uid() OR prev.payload_hash<>payload THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
  RETURN prev.id;
 END IF;
 IF EXISTS(SELECT 1 FROM hiring_payable_reconciliations WHERE operation_id=p_operation) THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
 IF length(btrim(coalesce(p_justification,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Justifique a geração (10 a 2000 caracteres).';END IF;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 el:=hiring_pay_eligible(w,i,lo);
 IF p_preview_hash IS DISTINCT FROM el->>'preview_hash' THEN RAISE EXCEPTION 'STALE: as fontes ou o plano mudaram desde a prévia; recalcule.';END IF;
 IF (SELECT contract_hash FROM hiring_economic_plan_versions WHERE plan_id=(el->>'plan_id')::uuid AND version=(el->>'plan_version')::int) IS DISTINCT FROM s.contract_hash THEN RAISE EXCEPTION 'STALE: plano vinculado a outro instrumento.';END IF;
 sel:=hiring_pay_select(el,p_keys);
 legacy:=hiring_pay_legacy(w,i,lo);
 IF jsonb_array_length(legacy)>0 THEN RAISE EXCEPTION 'LEGACY_CONFLICT: % título(s)/recorrência(s) existentes podem cobrir esta competência; concilie explicitamente antes de gerar.',jsonb_array_length(legacy);END IF;
 IF p_installments IS NULL OR jsonb_typeof(p_installments)<>'array' THEN RAISE EXCEPTION 'Informe as parcelas.';END IF;
 cnt:=jsonb_array_length(p_installments);
 IF cnt NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Informe de 1 a 24 parcelas.';END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
  IF jsonb_typeof(x)<>'object' OR x-ARRAY['amount','due_on']<>'{}'::jsonb OR jsonb_typeof(x->'amount') IS DISTINCT FROM 'number' OR (x->>'amount')::numeric::text IN('NaN','Infinity','-Infinity') OR (x->>'amount')::numeric<=0 OR (x->>'amount')::numeric>999999999999.99 OR scale((x->>'amount')::numeric)>2 THEN RAISE EXCEPTION 'Parcela com valor explícito inválido.';END IF;
  IF x->>'due_on' IS NULL OR (x->>'due_on')::date<lo THEN RAISE EXCEPTION 'Vencimento explícito obrigatório e não anterior à competência.';END IF;
  sum_i:=sum_i+(x->>'amount')::numeric;
 END LOOP;
 IF sum_i<>(sel->>'total')::numeric THEN RAISE EXCEPTION 'Soma das parcelas (%) deve fechar exatamente a obrigação (%).',sum_i,sel->>'total';END IF;
 INSERT INTO hiring_payable_schedules(workspace_id,request_id,start_id,kind,person_id,company_id,contract_id,contract_hash,request_revision,legal_entity_id,plan_id,plan_version,plan_hash,preview_hash,competence,currency,total,fiscal_document_id,justification,payload_hash,operation_id,created_by)
 VALUES(w,i,s.id,r.kind,r.person_id,r.company_id,s.contract_id,s.contract_hash,s.request_revision,s.legal_entity_id,(el->>'plan_id')::uuid,(el->>'plan_version')::int,el->>'plan_hash',el->>'preview_hash',lo,el->>'currency',(sel->>'total')::numeric,p_document,btrim(p_justification),payload,p_operation,auth.uid())
 RETURNING id INTO sid;
 PERFORM hiring_pay_claim(w,s,el,sel->'lines',sid,NULL);
 PERFORM hiring_pay_reserve_document(w,r,s,p_document,el->>'currency',(sel->>'total')::numeric,sel->'lines',sid,NULL);
 FOR x IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
  n:=n+1;eid:=gen_random_uuid();
  INSERT INTO hiring_payable_installments(workspace_id,schedule_id,seq,amount,due_on,financial_entry_id,external_ref) VALUES(w,sid,n,(x->>'amount')::numeric,(x->>'due_on')::date,eid,'hiring:'||sid||':'||n);
  INSERT INTO financial_entries(id,workspace_id,owner_id,direction,origin_type,origin_id,contract_id,counterparty_company_id,description,amount,currency,competence_date,due_date,paid_amount,status,external_ref,metadata,installment_number,installment_total,legal_entity_id)
  VALUES(eid,w,auth.uid(),'payable','contract',s.contract_id,s.contract_id,CASE WHEN r.kind='supplier' THEN r.company_id END,'Contratação '||left(r.title,120)||' — '||to_char(lo,'MM/YYYY')||' — parcela '||n||'/'||cnt,
   (x->>'amount')::numeric,el->>'currency',lo,(x->>'due_on')::date,0,'open','hiring:'||sid||':'||n,jsonb_build_object('hiring_schedule_id',sid,'hiring_request_id',i),n,cnt,s.legal_entity_id);
 END LOOP;
 RETURN sid;
END $$;

-- ---------------- Reconciliation of legacy titles/recurrences ----------------
CREATE FUNCTION public.hiring_payable_reconcile(w uuid,i uuid,p_month date,p_target uuid,p_decision text,p_preview_hash text,p_keys jsonb,p_document uuid,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;lo date;payload text;prev hiring_payable_reconciliations;f financial_entries;rc financial_recurrences;el jsonb;sel jsonb;comp jsonb;rid uuid;problem text;
BEGIN
 r:=hiring_pay_actor(w,i,'payables_reconciliation.approve',true);
 PERFORM hiring_pay_finance_only();
 IF p_operation IS NULL OR p_target IS NULL OR p_decision NOT IN('linked','unrelated') THEN RAISE EXCEPTION 'Informe título/recorrência, decisão e operação.';END IF;
 lo:=date_trunc('month',p_month)::date;
 payload:=hiring_ops_hash(jsonb_build_object('w',w,'i',i,'m',lo,'t',p_target,'d',p_decision,'h',p_preview_hash,'k',p_keys,'doc',p_document,'r',btrim(coalesce(p_reason,'')))::text);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring_payable:'||s.contract_id,0));
 SELECT * INTO prev FROM hiring_payable_reconciliations WHERE operation_id=p_operation;
 IF prev.id IS NOT NULL THEN
  IF prev.workspace_id<>w OR prev.finance_user_id<>auth.uid() OR prev.payload_hash<>payload THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
  RETURN prev.id;
 END IF;
 IF EXISTS(SELECT 1 FROM hiring_payable_schedules WHERE operation_id=p_operation) THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Justifique a conciliação (10 a 2000 caracteres).';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(hiring_pay_legacy(w,i,lo)) x WHERE (x->>'id')::uuid=p_target) THEN RAISE EXCEPTION 'Título/recorrência não é candidato pendente desta competência.';END IF;
 SELECT * INTO f FROM financial_entries WHERE id=p_target AND workspace_id=w FOR UPDATE;
 SELECT * INTO rc FROM financial_recurrences WHERE id=p_target AND workspace_id=w;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 el:=hiring_pay_eligible(w,i,lo);
 IF p_preview_hash IS DISTINCT FROM el->>'preview_hash' THEN RAISE EXCEPTION 'STALE: as fontes ou o plano mudaram desde a prévia; recalcule.';END IF;
 IF p_decision='unrelated' THEN
  IF (f.id IS NOT NULL AND (f.contract_id=s.contract_id OR f.origin_id=s.contract_id)) OR (rc.id IS NOT NULL AND (rc.template->>'contract_id'=s.contract_id::text OR rc.template->>'origin_id'=s.contract_id::text)) THEN
   RAISE EXCEPTION 'Título apontando para este contrato não pode ser declarado não relacionado; vincule-o ou trate com revisão/aditivo.';
  END IF;
  INSERT INTO hiring_payable_reconciliations(workspace_id,request_id,contract_id,decision,financial_entry_id,recurrence_id,competence,plan_id,plan_version,plan_hash,preview_hash,compatibility,reason,payload_hash,operation_id,finance_user_id)
  VALUES(w,i,s.contract_id,'unrelated',f.id,rc.id,lo,(el->>'plan_id')::uuid,(el->>'plan_version')::int,el->>'plan_hash',el->>'preview_hash',jsonb_build_object('declared','unrelated','target_hash',hiring_pay_target_hash(CASE WHEN f.id IS NOT NULL THEN to_jsonb(f) ELSE to_jsonb(rc) END,CASE WHEN f.id IS NOT NULL THEN 'entry' ELSE 'recurrence' END)),btrim(p_reason),payload,p_operation,auth.uid()) RETURNING id INTO rid;
  RETURN rid;
 END IF;
 IF f.id IS NULL THEN RAISE EXCEPTION 'Recorrência não é vinculada como obrigação: desative-a no Financeiro ou declare não relacionada.';END IF;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 el:=hiring_pay_eligible(w,i,lo);
 IF p_preview_hash IS DISTINCT FROM el->>'preview_hash' THEN RAISE EXCEPTION 'STALE: as fontes ou o plano mudaram desde a prévia; recalcule.';END IF;
 sel:=hiring_pay_select(el,p_keys);
 comp:=jsonb_build_object('direction',f.direction::text='payable','legal_entity',f.legal_entity_id IS NOT DISTINCT FROM s.legal_entity_id,'currency',f.currency=el->>'currency',
  'competence',date_trunc('month',f.competence_date)::date=lo,'amount',f.amount=(sel->>'total')::numeric,
  'counterparty',CASE WHEN r.kind='supplier' THEN f.counterparty_company_id IS NOT DISTINCT FROM r.company_id ELSE (hiring_pay_payroll_person(f.notes)=r.person_id OR f.contract_id=s.contract_id OR f.origin_id=s.contract_id) END,
  'status',f.status::text,'paid',f.paid_amount);
 IF NOT ((comp->>'direction')::boolean AND (comp->>'legal_entity')::boolean AND (comp->>'currency')::boolean AND (comp->>'competence')::boolean AND (comp->>'amount')::boolean AND (comp->>'counterparty')::boolean) THEN
  RAISE EXCEPTION 'INCOMPATIBLE: título não comprova a mesma obrigação (%); nada foi vinculado.',(SELECT string_agg(key,', ') FROM jsonb_each(comp) WHERE value='false'::jsonb);
 END IF;
 INSERT INTO hiring_payable_reconciliations(workspace_id,request_id,contract_id,decision,financial_entry_id,competence,plan_id,plan_version,plan_hash,preview_hash,compatibility,reason,payload_hash,operation_id,finance_user_id)
 VALUES(w,i,s.contract_id,'linked',f.id,lo,(el->>'plan_id')::uuid,(el->>'plan_version')::int,el->>'plan_hash',el->>'preview_hash',comp,btrim(p_reason),payload,p_operation,auth.uid()) RETURNING id INTO rid;
 PERFORM hiring_pay_claim(w,s,el,sel->'lines',NULL,rid);
 IF r.kind='supplier' OR r.regime IN('pj','freelance','clt') THEN PERFORM hiring_pay_reserve_document(w,r,s,p_document,el->>'currency',(sel->>'total')::numeric,sel->'lines',NULL,rid);END IF;
 RETURN rid;
END $$;

-- ---------------- Final client acceptance (supplier special condition) ----------------
CREATE FUNCTION public.hiring_client_acceptance_register(w uuid,i uuid,p_delivery uuid,p_version integer,p_hash text,p_target_kind text,p_target uuid,p_name text,p_role text,p_on date,p_evidence text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;prev hiring_client_acceptances;dv hiring_execution_delivery_versions;h text;nid uuid;problem text;
BEGIN
 r:=hiring_pay_actor(w,i,'client_acceptance.manage',true);
 IF r.release_condition IS DISTINCT FROM 'also_client_acceptance' THEN RAISE EXCEPTION 'Solicitação não usa a condição de aceite do cliente final.';END IF;
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Operação obrigatória.';END IF;
 h:=hiring_ops_hash(jsonb_build_object('w',w,'i',i,'d',p_delivery,'v',p_version,'h',p_hash,'tk',p_target_kind,'t',p_target,'n',btrim(coalesce(p_name,'')),'r',btrim(coalesce(p_role,'')),'on',p_on,'e',btrim(coalesce(p_evidence,'')))::text);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO prev FROM hiring_client_acceptances WHERE operation_id=p_operation;
 IF prev.id IS NOT NULL THEN
  IF prev.workspace_id<>w OR prev.request_id<>i OR prev.registered_by<>auth.uid() OR prev.content_hash<>h THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
  RETURN prev.id;
 END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF NOT ((p_target_kind='project' AND p_target=r.project_id) OR (p_target_kind='commercial_contract' AND p_target=r.commercial_contract_id) OR (p_target_kind='deal' AND p_target=r.deal_id)) THEN
  RAISE EXCEPTION 'O aceite deve apontar o projeto, contrato comercial ou negócio canônico vinculado à solicitação.';
 END IF;
 SELECT v.* INTO dv FROM hiring_execution_delivery_versions v JOIN hiring_execution_deliveries d ON d.id=v.delivery_id AND d.request_id=i AND d.workspace_id=w AND d.version=v.version WHERE v.delivery_id=p_delivery AND v.version=p_version;
 IF dv.id IS NULL OR dv.content_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'STALE: informe a versão atual exata da entrega.';END IF;
 IF NOT EXISTS(SELECT 1 FROM hiring_execution_delivery_decisions WHERE delivery_id=p_delivery AND version=p_version AND decision='accepted' AND content_hash=p_hash) THEN RAISE EXCEPTION 'O aceite técnico da WK vem antes; aceite técnico não substitui o do cliente.';END IF;
 IF p_on IS NULL OR p_on<dv.period_start OR p_on>current_date THEN RAISE EXCEPTION 'Data do aceite do cliente inválida.';END IF;
 INSERT INTO hiring_client_acceptances(workspace_id,request_id,delivery_id,delivery_version,delivery_hash,target_kind,target_id,accepted_by_name,accepted_by_role,accepted_on,evidence_reference,content_hash,operation_id,registered_by)
 VALUES(w,i,p_delivery,p_version,p_hash,p_target_kind,p_target,btrim(p_name),btrim(p_role),p_on,btrim(p_evidence),h,p_operation,auth.uid()) RETURNING id INTO nid;
 RETURN nid;
END $$;
CREATE FUNCTION public.hiring_client_acceptance_decide(w uuid,i uuid,p_acceptance uuid,p_hash text,p_decision text,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;a hiring_client_acceptances;problem text;
BEGIN
 r:=hiring_pay_actor(w,i,'client_acceptance.approve',true);
 PERFORM hiring_pay_finance_only();
 IF p_decision NOT IN('confirmed','rejected') OR p_operation IS NULL THEN RAISE EXCEPTION 'Decisão inválida.';END IF;
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO a FROM hiring_client_acceptances WHERE decision_operation=p_operation;
 IF a.id IS NOT NULL THEN
  IF a.id<>p_acceptance OR a.workspace_id<>w OR a.request_id<>i OR a.content_hash IS DISTINCT FROM p_hash OR a.decision_reason IS DISTINCT FROM btrim(p_reason) OR a.decided_by<>auth.uid() OR a.status<>p_decision THEN RAISE EXCEPTION 'Operação já utilizada com dados diferentes.';END IF;
  RETURN a.id;
 END IF;
 SELECT * INTO a FROM hiring_client_acceptances WHERE id=p_acceptance AND workspace_id=w AND request_id=i FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Aceite indisponível.';END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF NOT EXISTS(SELECT 1 FROM hiring_execution_deliveries d JOIN hiring_execution_delivery_decisions k ON k.delivery_id=d.id AND k.version=d.version WHERE d.id=a.delivery_id AND d.version=a.delivery_version AND k.content_hash=a.delivery_hash AND k.decision='accepted') THEN RAISE EXCEPTION 'STALE: a entrega ou aceite técnico mudou.';END IF;
 IF a.status<>'registered' THEN RAISE EXCEPTION 'Aceite já decidido.';END IF;
 IF a.content_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'STALE: aceite diverge do conferido.';END IF;
 IF a.registered_by=auth.uid() THEN RAISE EXCEPTION 'Quem registrou o aceite não pode conferi-lo.' USING ERRCODE='42501';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Registre o motivo da conferência.';END IF;
 UPDATE hiring_client_acceptances SET status=p_decision,decided_by=auth.uid(),decision_reason=btrim(p_reason),decided_at=now(),decision_operation=p_operation WHERE id=a.id;
 RETURN a.id;
END $$;

-- ---------------- Private context (amounts only for authorized Finance viewers) ----------------
CREATE FUNCTION public.hiring_payable_context(w uuid,i uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;u uuid:=auth.uid();ro boolean:=is_read_only_view();vw boolean;mg boolean;rc boolean;cam boolean;caa boolean;fin uuid;el jsonb;el_err text;legacy jsonb;sched jsonb;recon jsonb;docs jsonb;accs jsonb;delivs jsonb;ids uuid[];econ_read boolean;fiscal_read boolean;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF u IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND active_workspace_id=w) OR NOT hiring_preparation_access(w,r.kind,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 vw:=s.id IS NOT NULL AND hiring_pay_subject(w,u,r.kind,'payables.view') AND hiring_econ_private_ok(w,r,s.contract_id);
 econ_read:=vw AND hiring_econ_subject(w,u,r.kind,'economics.view');
 fiscal_read:=vw AND hiring_ops_subject(w,u,r.kind,'fiscal_documents.view');
 mg:=vw AND econ_read AND fiscal_read AND NOT ro AND hiring_pay_subject(w,u,r.kind,'payables.manage');
 SELECT finance_user_id INTO fin FROM contract_handoff_settings WHERE workspace_id=w AND enabled;
 rc:=vw AND econ_read AND fiscal_read AND NOT ro AND fin=u AND hiring_pay_subject(w,u,r.kind,'payables_reconciliation.approve');
 cam:=vw AND NOT ro AND r.release_condition='also_client_acceptance' AND hiring_pay_subject(w,u,r.kind,'client_acceptance.manage');
 caa:=vw AND NOT ro AND r.release_condition='also_client_acceptance' AND fin=u AND hiring_pay_subject(w,u,r.kind,'client_acceptance.approve');
 IF vw THEN
  SELECT coalesce(array_agg(entry_id),'{}') INTO ids FROM (SELECT n.financial_entry_id entry_id FROM hiring_payable_installments n JOIN hiring_payable_schedules sc ON sc.id=n.schedule_id WHERE sc.workspace_id=w AND sc.request_id=i UNION SELECT financial_entry_id FROM hiring_payable_reconciliations WHERE workspace_id=w AND request_id=i AND financial_entry_id IS NOT NULL) source;
  IF cardinality(ids)<>(SELECT count(*) FROM hiring_pay_visible_entries(ids)) THEN RAISE EXCEPTION 'Há títulos indisponíveis ao seu usuário; consulta bloqueada.' USING ERRCODE='42501';END IF;
  IF p_month IS NOT NULL AND econ_read THEN
   BEGIN el:=hiring_pay_eligible(w,i,p_month);EXCEPTION WHEN OTHERS THEN el_err:=SQLERRM;END;
   legacy:=hiring_pay_legacy(w,i,p_month);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'competence',x.competence,'currency',x.currency,'total',x.total,'plan_version',x.plan_version,'justification',x.justification,'at',x.created_at,
    'by',(SELECT full_name FROM profiles WHERE id=x.created_by),'document_id',x.fiscal_document_id,
    'installments',(SELECT coalesce(jsonb_agg(jsonb_build_object('seq',n.seq,'amount',n.amount,'due_on',n.due_on,'entry_id',n.financial_entry_id,'status',(SELECT status::text FROM financial_entries WHERE id=n.financial_entry_id),
      'paid',(SELECT paid_amount FROM financial_entries WHERE id=n.financial_entry_id)) ORDER BY n.seq),'[]') FROM hiring_payable_installments n WHERE n.schedule_id=x.id),
    'sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('kind',c.source_kind,'delivery_id',c.delivery_id,'time_entry_id',c.time_entry_id,'seconds',c.seconds,'amount',c.amount)),'[]') FROM hiring_payable_source_claims c WHERE c.schedule_id=x.id)) ORDER BY x.competence DESC,x.created_at DESC),'[]') INTO sched
   FROM (SELECT * FROM hiring_payable_schedules WHERE workspace_id=w AND request_id=i ORDER BY competence DESC LIMIT 60) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'decision',x.decision,'entry_id',x.financial_entry_id,'recurrence_id',x.recurrence_id,'competence',x.competence,'compatibility',x.compatibility,'reason',x.reason,'at',x.created_at,
    'by',(SELECT full_name FROM profiles WHERE id=x.finance_user_id)) ORDER BY x.created_at DESC),'[]') INTO recon FROM hiring_payable_reconciliations x WHERE x.workspace_id=w AND x.request_id=i;
  IF fiscal_read THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'doc_type',d.doc_type,'number',d.document_number,'amount',d.amount,'currency',d.currency,'delivery_id',d.delivery_id,
    'used',(SELECT coalesce(sum(a.amount),0) FROM hiring_fiscal_document_allocations a WHERE a.document_id=d.id)) ORDER BY d.issued_on),'[]') INTO docs
   FROM hiring_fiscal_documents d WHERE d.workspace_id=w AND d.request_id=i AND d.status='verified';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'delivery_id',a.delivery_id,'delivery_version',a.delivery_version,'target_kind',a.target_kind,'accepted_by_name',a.accepted_by_name,'accepted_by_role',a.accepted_by_role,
    'accepted_on',a.accepted_on,'evidence_reference',a.evidence_reference,'status',a.status,'content_hash',a.content_hash,'registered_by_me',a.registered_by=u,'reason',a.decision_reason,'at',a.registered_at) ORDER BY a.registered_at DESC),'[]') INTO accs
   FROM hiring_client_acceptances a WHERE a.workspace_id=w AND a.request_id=i;
  IF cam THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'version',d.version,'hash',v.content_hash,'title',v.title)),'[]') INTO delivs
    FROM hiring_execution_deliveries d JOIN hiring_execution_delivery_versions v ON v.delivery_id=d.id AND v.version=d.version
    WHERE d.workspace_id=w AND d.request_id=i AND EXISTS(SELECT 1 FROM hiring_execution_delivery_decisions k WHERE k.delivery_id=d.id AND k.version=d.version AND k.decision='accepted' AND k.content_hash=v.content_hash);
  END IF;
 END IF;
 RETURN jsonb_build_object('started',s.id IS NOT NULL,'kind',r.kind,'regime',r.regime,'release_condition',r.release_condition,
  'client_targets',CASE WHEN cam THEN jsonb_strip_nulls(jsonb_build_object('project',r.project_id,'commercial_contract',r.commercial_contract_id,'deal',r.deal_id)) END,
  'can_view',vw,'can_generate',mg,'can_reconcile',coalesce(rc,false),'can_register_client',coalesce(cam,false),'can_confirm_client',coalesce(caa,false),'finance_configured',fin IS NOT NULL,
  'finance_name',CASE WHEN vw THEN (SELECT full_name FROM profiles WHERE id=fin) END,'contract_id',CASE WHEN vw THEN s.contract_id END,
  'eligible',el,'eligible_problem',el_err,'legacy',coalesce(legacy,'[]'),'schedules',coalesce(sched,'[]'),'reconciliations',coalesce(recon,'[]'),'documents',coalesce(docs,'[]'),
  'client_acceptances',coalesce(accs,'[]'),'acceptable_deliveries',coalesce(delivs,'[]'));
END $$;

DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['hiring_pay_governed(uuid)','hiring_pay_entry_claimed(uuid)','hiring_pay_payroll_person(text)','hiring_pay_entry_guard()','hiring_pay_recurrence_guard()','hiring_pay_time_guard()',
  'hiring_pay_closing_guard()','hiring_pay_delivery_guard()','hiring_client_acceptance_guard()','hiring_pay_subject(uuid,uuid,text,text)','hiring_pay_actor(uuid,uuid,text,boolean)','hiring_pay_finance_only()',
  'hiring_pay_line_key(jsonb)','hiring_pay_eligible(uuid,uuid,date)','hiring_pay_legacy(uuid,uuid,date)','hiring_pay_select(jsonb,jsonb)',
  'hiring_pay_claim(uuid,public.hiring_execution_starts,jsonb,jsonb,uuid,uuid)','hiring_pay_reserve_document(uuid,public.hiring_preparation_requests,public.hiring_execution_starts,uuid,text,numeric,jsonb,uuid,uuid)',
  'hiring_payable_generate(uuid,uuid,date,text,jsonb,jsonb,uuid,text,uuid)','hiring_payable_reconcile(uuid,uuid,date,uuid,text,text,jsonb,uuid,text,uuid)',
  'hiring_client_acceptance_register(uuid,uuid,uuid,integer,text,text,uuid,text,text,date,text,uuid)','hiring_client_acceptance_decide(uuid,uuid,uuid,text,text,text,uuid)','hiring_payable_context(uuid,uuid,date)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer';
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.hiring_payable_generate(uuid,uuid,date,text,jsonb,jsonb,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_payable_reconcile(uuid,uuid,date,uuid,text,text,jsonb,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_client_acceptance_register(uuid,uuid,uuid,integer,text,text,uuid,text,text,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_client_acceptance_decide(uuid,uuid,uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_payable_context(uuid,uuid,date) TO authenticated;
