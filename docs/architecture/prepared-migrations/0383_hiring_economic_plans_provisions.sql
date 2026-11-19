-- Package 4 batch C1 (PLANO-PROVISAO): versioned economic plan, eligible calculation and management cost provision.
-- PREPARED FOR REVIEW ONLY: outside the drizzle journal; never applied by this batch.
-- Creates NO financial_entries, recurrence, payable, payment, invoice or sales-billing change (batch C2 owns titles).
-- The demand reference value is never a debt or an automatic price; nothing is extracted from contract HTML.
-- Provisions reuse public.hiring_monthly_provisions (kind='cost', config_id NULL); legacy ATS/revenue rows and functions are untouched.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.economics.view.workspace','techpeople','hiring_requests.economics','view','workspace','Ver plano econômico do profissional','Lê modalidade, componentes, valores e cálculo elegível; exige também acesso ao contrato e à pessoa.',true),
('techpeople.hiring_requests.economics.manage.workspace','techpeople','hiring_requests.economics','manage','workspace','Montar plano econômico do profissional','Registra versões do plano conferidas contra o instrumento assinado; não gera título nem pagamento.',true),
('techpeople.hiring_requests.economics.approve.workspace','techpeople','hiring_requests.economics','approve','workspace','Aprovar plano econômico do profissional','Responsável Financeiro configurado aprova ou rejeita a versão exata; não aprova o que montou.',true),
('techpeople.hiring_requests.provisions.manage.workspace','techpeople','hiring_requests.provisions','manage','workspace','Prever provisão do profissional','Calcula a prévia gerencial por competência sem criar obrigação.',true),
('techpeople.hiring_requests.provisions.approve.workspace','techpeople','hiring_requests.provisions','approve','workspace','Fechar provisão do profissional','Congela competência encerrada ou cria revisão encadeada justificada.',true),
('techcontracts.supplier_requests.economics.view.workspace','techcontracts','supplier_requests.economics','view','workspace','Ver plano econômico do fornecedor','Lê modalidade, componentes, valores e cálculo elegível; exige também acesso ao contrato.',true),
('techcontracts.supplier_requests.economics.manage.workspace','techcontracts','supplier_requests.economics','manage','workspace','Montar plano econômico do fornecedor','Registra versões do plano conferidas contra o instrumento assinado; não gera título nem pagamento.',true),
('techcontracts.supplier_requests.economics.approve.workspace','techcontracts','supplier_requests.economics','approve','workspace','Aprovar plano econômico do fornecedor','Responsável Financeiro configurado aprova ou rejeita a versão exata; não aprova o que montou.',true),
('techcontracts.supplier_requests.provisions.manage.workspace','techcontracts','supplier_requests.provisions','manage','workspace','Prever provisão do fornecedor','Calcula a prévia gerencial por competência sem criar obrigação.',true),
('techcontracts.supplier_requests.provisions.approve.workspace','techcontracts','supplier_requests.provisions','approve','workspace','Fechar provisão do fornecedor','Congela competência encerrada ou cria revisão encadeada justificada.',true),
('techfinance.provisions.view.workspace','techfinance','provisions','view','workspace','Ver provisões mensais','Prévia e histórico de provisões; exige também acesso a tarifas e ao contrato.',true),
('techfinance.provisions.manage.workspace','techfinance','provisions','manage','workspace','Preparar provisões mensais','Recalcula a prévia sem gerar título, cobrança ou pagamento.',true),
('techfinance.provisions.approve.workspace','techfinance','provisions','approve','workspace','Fechar e revisar provisões mensais','Congela competência encerrada ou cria revisão justificada, preservando o histórico.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.hiring_economic_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE,
 start_id uuid NOT NULL UNIQUE REFERENCES public.hiring_execution_starts(id),
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','in_review','approved','rejected')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id)
);
CREATE TABLE public.hiring_economic_plan_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 plan_id uuid NOT NULL,
 version integer NOT NULL,
 modality text NOT NULL CHECK(modality IN('delivery','hourly','monthly','mixed')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 effective_from date NOT NULL,
 effective_to date,
 components jsonb NOT NULL CHECK(jsonb_typeof(components)='array' AND jsonb_array_length(components) BETWEEN 1 AND 20),
 source_reference text NOT NULL CHECK(length(btrim(source_reference)) BETWEEN 5 AND 500),
 legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 contract_hash text NOT NULL,
 request_revision integer NOT NULL,
 release_condition text,
 content_hash text NOT NULL,
 change_reason text CHECK(change_reason IS NULL OR length(btrim(change_reason)) BETWEEN 5 AND 2000),
 operation_id uuid NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(plan_id,version),
 FOREIGN KEY(workspace_id,plan_id) REFERENCES public.hiring_economic_plans(workspace_id,id),
 CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE TABLE public.hiring_economic_plan_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 plan_id uuid NOT NULL,
 version integer NOT NULL,
 kind text NOT NULL CHECK(kind IN('submitted','approved','rejected')),
 content_hash text NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 2000),
 finance_user_id uuid,
 operation_id uuid NOT NULL UNIQUE,
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,plan_id) REFERENCES public.hiring_economic_plans(workspace_id,id),
 FOREIGN KEY(plan_id,version) REFERENCES public.hiring_economic_plan_versions(plan_id,version)
);
CREATE UNIQUE INDEX hiring_econ_one_decision ON public.hiring_economic_plan_events(plan_id,version) WHERE kind IN('approved','rejected');
-- Private: no direct reads; amounts are only returned by the gated context RPC.
REVOKE ALL ON public.hiring_economic_plans,public.hiring_economic_plan_versions,public.hiring_economic_plan_events FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT ALL ON public.hiring_economic_plans,public.hiring_economic_plan_versions,public.hiring_economic_plan_events TO service_role;
ALTER TABLE public.hiring_economic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_economic_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_economic_plan_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER hiring_econ_version_immutable BEFORE UPDATE OR DELETE ON public.hiring_economic_plan_versions FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_econ_event_immutable BEFORE UPDATE OR DELETE ON public.hiring_economic_plan_events FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE FUNCTION public.hiring_econ_plan_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Plano econômico é histórico; crie nova versão.';END IF;
 IF (to_jsonb(NEW)-ARRAY['version','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','status','updated_at']) OR NEW.version<OLD.version THEN RAISE EXCEPTION 'Plano econômico só muda por nova versão.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_econ_plan_guard BEFORE UPDATE OR DELETE ON public.hiring_economic_plans FOR EACH ROW EXECUTE FUNCTION public.hiring_econ_plan_guard();

CREATE FUNCTION public.hiring_econ_subject(w uuid,u uuid,k text,act text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u IS NOT NULL AND act IN('economics.view','economics.manage','economics.approve','provisions.manage','provisions.approve')
 AND hiring_preparation_approval_subject(w,u,k,'view')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x=CASE k WHEN 'professional' THEN 'techpeople.hiring_requests' ELSE 'techcontracts.supplier_requests' END||'.'||act||'.workspace')
 AND (act IN('economics.view','economics.manage','economics.approve') OR (EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techfinance.provisions.'||split_part(act,'.',2)||'.workspace') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techfinance.provisions.view.workspace') AND (act<>'provisions.approve' OR EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techfinance.provisions.manage.workspace'))))
$$;
-- Private canonical reads for amounts: contract record and, for professionals, the person record.
CREATE FUNCTION public.hiring_econ_private_ok(w uuid,r public.hiring_preparation_requests,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT work_record_access('techcontracts.contracts',k,'view') AND (r.kind='supplier' OR (r.person_id IS NOT NULL AND hr_record_access('people','view',r.person_id)))
 AND NOT EXISTS(SELECT 1 FROM (VALUES('contracts','total_value'),('contracts','monthly_value'),('financial_entries','amount'),('project_rates','amount')) protected(t,f) WHERE shared_field_mode_for(shared_field_context()->'rules',protected.t,protected.f) IN('hidden','masked'))
 AND (r.kind='supplier' OR NOT EXISTS(SELECT 1 FROM (VALUES('monthly_cost'),('cost_hour')) protected(f) WHERE shared_field_mode_for(shared_field_context()->'rules','people',protected.f) IN('hidden','masked')))
$$;
CREATE FUNCTION public.hiring_econ_actor(w uuid,i uuid,act text,write boolean) RETURNS public.hiring_preparation_requests LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 IF auth.uid() IS NULL OR r.id IS NULL OR (write AND is_read_only_view()) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
  OR NOT hiring_preparation_access(w,r.kind,'view') OR NOT hiring_econ_subject(w,auth.uid(),r.kind,act) OR NOT hiring_econ_subject(w,auth.uid(),r.kind,'economics.view')
  OR (s.id IS NOT NULL AND NOT hiring_econ_private_ok(w,r,s.contract_id)) THEN RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';END IF;
 RETURN r;
END $$;
-- Current proof: batch B proof (start, unchanged revision, intact signature) + unchanged area policy + active WK entity with CNPJ.
CREATE FUNCTION public.hiring_econ_proof_problem(w uuid,i uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;p jsonb;problem text;
BEGIN
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RETURN problem;END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 SELECT to_jsonb(x) INTO p FROM hiring_area_policies x WHERE x.workspace_id=w AND x.area_id=r.area_id;
 IF p IS NULL OR (p->>'revision') IS DISTINCT FROM (s.policy_snapshot->>'revision') THEN RETURN 'A alçada da área mudou depois do início; revalide os responsáveis antes de aprovar plano ou provisão.';END IF;
 IF s.legal_entity_id IS DISTINCT FROM r.legal_entity_id OR NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=s.legal_entity_id AND workspace_id=w AND active AND hiring_ops_digits(cnpj) IS NOT NULL) THEN RETURN 'Entidade WK do início indisponível, inativa ou sem CNPJ.';END IF;
 RETURN NULL;
END $$;

-- Validates and normalizes explicit components. Never infers modality from the demand default.
CREATE FUNCTION public.hiring_econ_normalize(w uuid,i uuid,k text,p_modality text,p_components jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;t text;out jsonb:='[]';types text[]:='{}';sources text[]:='{}';deliveries uuid[]:='{}';projects text[]:='{}';n int:=0;amt numeric;due int;dv hiring_execution_delivery_versions;src text;
BEGIN
 IF p_modality IS NULL OR p_modality NOT IN('delivery','hourly','monthly','mixed') THEN RAISE EXCEPTION 'Informe a modalidade explicitamente.';END IF;
 IF p_components IS NULL OR jsonb_typeof(p_components)<>'array' OR jsonb_array_length(p_components) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Informe de 1 a 20 componentes.';END IF;
 FOR c IN SELECT * FROM jsonb_array_elements(p_components) LOOP
  n:=n+1;
  IF jsonb_typeof(c)<>'object' OR c - ARRAY['type','amount','source_clause','due_days','delivery_id','delivery_version','project_id','proration'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Componente % com campos inválidos.',n;END IF;
  t:=coalesce(c->>'type','');src:=btrim(coalesce(c->>'source_clause',''));
  IF t NOT IN('delivery','hourly','monthly') THEN RAISE EXCEPTION 'Componente % sem tipo válido.',n;END IF;
  IF jsonb_typeof(c->'amount') IS DISTINCT FROM 'number' OR (c->>'amount')::numeric<=0 OR (c->>'amount')::numeric>99999999 OR scale((c->>'amount')::numeric)>4 THEN RAISE EXCEPTION 'Componente % exige valor/taxa explícito e positivo.',n;END IF;
  amt:=(c->>'amount')::numeric;
  IF t IN('delivery','monthly') AND (scale(amt)>2 OR round(amt,2)<=0) THEN RAISE EXCEPTION 'Preço fechado exige valor monetário positivo com até duas casas decimais.';END IF;
  IF jsonb_typeof(c->'source_clause') IS DISTINCT FROM 'string' OR length(src) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Componente % exige a cláusula/fonte conferida no instrumento assinado.',n;END IF;
  IF lower(src)=ANY(sources) THEN RAISE EXCEPTION 'Componentes não podem compartilhar a mesma fonte (dupla contagem).';END IF;
  IF jsonb_typeof(c->'due_days') IS DISTINCT FROM 'number' OR (c->>'due_days')::numeric<>floor((c->>'due_days')::numeric) OR (c->>'due_days')::int NOT BETWEEN 0 AND 120 THEN RAISE EXCEPTION 'Componente % exige vencimento em dias (0 a 120) após a competência.',n;END IF;
  due:=(c->>'due_days')::int;
  IF t='delivery' THEN
   SELECT v.* INTO dv FROM hiring_execution_delivery_versions v JOIN hiring_execution_deliveries d ON d.id=v.delivery_id AND d.workspace_id=w AND d.request_id=i
    WHERE v.delivery_id=(c->>'delivery_id')::uuid AND v.version=(c->>'delivery_version')::int;
   IF dv.id IS NULL THEN RAISE EXCEPTION 'Componente % deve apontar a versão exata de uma entrega desta solicitação.',n;END IF;
   IF dv.delivery_id=ANY(deliveries) THEN RAISE EXCEPTION 'A mesma entrega não pode ser precificada duas vezes.';END IF;
   IF c ? 'project_id' OR c ? 'proration' THEN RAISE EXCEPTION 'Componente % de entrega não usa projeto/pró-rata.',n;END IF;
   deliveries:=deliveries||dv.delivery_id;
   out:=out||jsonb_build_object('type',t,'amount',amt,'source_clause',src,'due_days',due,'delivery_id',dv.delivery_id,'delivery_version',dv.version,'delivery_hash',dv.content_hash);
  ELSIF t='hourly' THEN
   IF k<>'professional' THEN RAISE EXCEPTION 'Horas canônicas exigem profissional com vínculo e alocação.';END IF;
   IF c ? 'delivery_id' OR c ? 'delivery_version' OR c ? 'proration' THEN RAISE EXCEPTION 'Componente % por hora com campos inválidos.',n;END IF;
   IF coalesce(c->>'project_id','*')=ANY(projects) OR (array_length(projects,1)>0 AND (c->>'project_id' IS NULL OR '*'=ANY(projects))) THEN RAISE EXCEPTION 'Componentes por hora precisam de projetos distintos e explícitos.';END IF;
   IF c->>'project_id' IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM projects WHERE id=(c->>'project_id')::uuid AND workspace_id=w) OR NOT hiring_delivery_reference_visible((c->>'project_id')::uuid,NULL)) THEN RAISE EXCEPTION 'Projeto do componente % indisponível.',n;END IF;
   projects:=projects||coalesce(c->>'project_id','*');
   out:=out||jsonb_build_object('type',t,'amount',amt,'source_clause',src,'due_days',due,'project_id',c->>'project_id');
  ELSE
   IF 'monthly'=ANY(types) THEN RAISE EXCEPTION 'Apenas um componente mensal por versão.';END IF;
   IF coalesce(c->>'proration','') NOT IN('full_month','calendar_days') THEN RAISE EXCEPTION 'Mensal exige regra explícita: mês integral ou pró-rata por dias corridos do calendário.';END IF;
   IF c ? 'delivery_id' OR c ? 'delivery_version' OR c ? 'project_id' THEN RAISE EXCEPTION 'Componente % mensal com campos inválidos.',n;END IF;
   out:=out||jsonb_build_object('type',t,'amount',amt,'source_clause',src,'due_days',due,'proration',c->>'proration');
  END IF;
  types:=types||t;sources:=sources||lower(src);
 END LOOP;
 IF p_modality<>'mixed' AND EXISTS(SELECT 1 FROM unnest(types) x WHERE x<>p_modality) THEN RAISE EXCEPTION 'Componentes não correspondem à modalidade escolhida.';END IF;
 IF p_modality='mixed' AND (SELECT count(DISTINCT x) FROM unnest(types) x)<2 THEN RAISE EXCEPTION 'Misto exige componentes de tipos distintos.';END IF;
 IF p_modality='mixed' AND 'monthly'=ANY(types) AND '*'=ANY(projects) THEN RAISE EXCEPTION 'Misto com mensal exige horas restritas a projeto explícito (sem dupla contagem).';END IF;
 RETURN out;
END $$;

CREATE FUNCTION public.hiring_econ_save(w uuid,i uuid,p_plan uuid,p_version integer,p_modality text,p_currency text,p_from date,p_to date,p_components jsonb,p_source text,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;pl hiring_economic_plans;v hiring_economic_plan_versions;problem text;nv int;h text;norm jsonb;
BEGIN
 r:=hiring_econ_actor(w,i,'economics.manage',true);
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Operação obrigatória.';END IF;
 PERFORM hiring_formalization_lock(i);
 norm:=hiring_econ_normalize(w,i,r.kind,p_modality,p_components);
 SELECT * INTO v FROM hiring_economic_plan_versions WHERE operation_id=p_operation;
 IF v.id IS NOT NULL THEN
  IF v.workspace_id<>w OR v.created_by<>auth.uid() OR NOT EXISTS(SELECT 1 FROM hiring_economic_plans replay_plan WHERE replay_plan.id=v.plan_id AND replay_plan.request_id=i) OR (p_plan IS NOT NULL AND p_plan<>v.plan_id) OR coalesce(p_version,0)<>v.version-1 OR ROW(v.modality,v.currency,v.effective_from,v.effective_to,v.components,v.source_reference) IS DISTINCT FROM ROW(p_modality,p_currency,p_from,p_to,norm,btrim(p_source)) OR (v.version>1 AND v.change_reason IS DISTINCT FROM btrim(p_reason)) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;
  RETURN v.plan_id;
 END IF;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Informe a moeda (ISO, ex.: BRL).';END IF;
 IF p_currency IS DISTINCT FROM (SELECT currency FROM contracts WHERE id=s.contract_id AND workspace_id=w) THEN RAISE EXCEPTION 'Moeda do plano diverge do instrumento assinado.';END IF;
 IF p_from IS NULL OR p_from<s.starts_at OR (s.ends_at IS NOT NULL AND (p_to IS NULL OR p_to>s.ends_at)) OR (p_to IS NOT NULL AND p_to<p_from) THEN RAISE EXCEPTION 'Vigência do plano fora do início autorizado.';END IF;
 IF length(btrim(coalesce(p_source,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Informe a cláusula/seção conferida no instrumento assinado.';END IF;
 norm:=hiring_econ_normalize(w,i,r.kind,p_modality,p_components);
 IF p_plan IS NULL THEN
  IF EXISTS(SELECT 1 FROM hiring_economic_plans WHERE request_id=i) THEN RAISE EXCEPTION 'REVISION_CONFLICT: o plano já existe; recarregue.';END IF;
  INSERT INTO hiring_economic_plans(workspace_id,request_id,start_id,kind,created_by) VALUES(w,i,s.id,r.kind,auth.uid()) RETURNING * INTO pl;
  nv:=1;
 ELSE
  SELECT * INTO pl FROM hiring_economic_plans WHERE workspace_id=w AND id=p_plan AND request_id=i FOR UPDATE;
  IF pl.id IS NULL THEN RAISE EXCEPTION 'Plano indisponível.';END IF;
  IF p_version IS DISTINCT FROM pl.version THEN RAISE EXCEPTION 'REVISION_CONFLICT: recarregue o plano.';END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Justifique a alteração do plano (5 a 2000 caracteres).';END IF;
  nv:=pl.version+1;
 END IF;
 h:=hiring_ops_hash(jsonb_build_object('plan',pl.id,'version',nv,'modality',p_modality,'currency',p_currency,'from',p_from,'to',p_to,'components',norm,'source',btrim(p_source),
   'legal_entity',s.legal_entity_id,'contract',s.contract_id,'contract_hash',s.contract_hash,'revision',s.request_revision,'start',s.id,'release_condition',r.release_condition)::text);
 INSERT INTO hiring_economic_plan_versions(workspace_id,plan_id,version,modality,currency,effective_from,effective_to,components,source_reference,legal_entity_id,contract_id,contract_hash,request_revision,release_condition,content_hash,change_reason,operation_id,created_by)
 VALUES(w,pl.id,nv,p_modality,p_currency,p_from,p_to,norm,btrim(p_source),s.legal_entity_id,s.contract_id,s.contract_hash,s.request_revision,r.release_condition,h,CASE WHEN nv>1 THEN btrim(p_reason) END,p_operation,auth.uid());
 UPDATE hiring_economic_plans SET version=nv,status='draft',updated_at=now() WHERE id=pl.id;
 RETURN pl.id;
END $$;

CREATE FUNCTION public.hiring_econ_transition(w uuid,i uuid,p_plan uuid,p_version integer,p_hash text,p_action text,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;pl hiring_economic_plans;v hiring_economic_plan_versions;e hiring_economic_plan_events;problem text;fin uuid;eid uuid;
BEGIN
 IF p_action NOT IN('submitted','approved','rejected') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 r:=hiring_econ_actor(w,i,CASE WHEN p_action='submitted' THEN 'economics.manage' ELSE 'economics.approve' END,true);
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Operação obrigatória.';END IF;
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO e FROM hiring_economic_plan_events WHERE operation_id=p_operation;
 IF e.id IS NOT NULL THEN
  IF e.workspace_id<>w OR e.actor_id<>auth.uid() OR ROW(e.plan_id,e.version,e.content_hash,e.kind,e.reason) IS DISTINCT FROM ROW(p_plan,p_version,p_hash,p_action,btrim(p_reason)) OR NOT EXISTS(SELECT 1 FROM hiring_economic_plans replay_plan WHERE replay_plan.id=e.plan_id AND replay_plan.request_id=i) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;
  RETURN e.id;
 END IF;
 SELECT * INTO pl FROM hiring_economic_plans WHERE workspace_id=w AND id=p_plan AND request_id=i FOR UPDATE;
 IF pl.id IS NULL THEN RAISE EXCEPTION 'Plano indisponível.';END IF;
 IF p_version IS DISTINCT FROM pl.version THEN RAISE EXCEPTION 'REVISION_CONFLICT: o plano mudou; recarregue.';END IF;
 SELECT * INTO v FROM hiring_economic_plan_versions WHERE plan_id=pl.id AND version=pl.version;
 IF p_hash IS DISTINCT FROM v.content_hash THEN RAISE EXCEPTION 'STALE: conteúdo do plano diverge da versão conferida.';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Registre o motivo (5 a 2000 caracteres).';END IF;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF v.contract_hash IS DISTINCT FROM (SELECT contract_hash FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i) OR v.request_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'STALE: plano vinculado a outra revisão/instrumento.';END IF;
 IF p_action='submitted' THEN
  IF pl.status<>'draft' THEN RAISE EXCEPTION 'Somente rascunho pode ser enviado para revisão.';END IF;
 ELSE
  IF pl.status<>'in_review' THEN RAISE EXCEPTION 'Plano não está em revisão.';END IF;
  SELECT finance_user_id INTO fin FROM contract_handoff_settings WHERE workspace_id=w AND enabled;
  IF fin IS NULL THEN RAISE EXCEPTION 'Configure o responsável Financeiro nas configurações contratuais existentes.';END IF;
  IF fin<>auth.uid() THEN RAISE EXCEPTION 'Somente o responsável Financeiro configurado decide este plano.' USING ERRCODE='42501';END IF;
  IF v.created_by=auth.uid() OR EXISTS(SELECT 1 FROM hiring_economic_plan_events x WHERE x.plan_id=pl.id AND x.version=v.version AND x.kind='submitted' AND x.actor_id=auth.uid()) THEN RAISE EXCEPTION 'Quem montou ou enviou o plano não pode decidi-lo.' USING ERRCODE='42501';END IF;
 END IF;
 INSERT INTO hiring_economic_plan_events(workspace_id,plan_id,version,kind,content_hash,reason,finance_user_id,operation_id,actor_id)
 VALUES(w,pl.id,v.version,p_action,v.content_hash,btrim(p_reason),fin,p_operation,auth.uid()) RETURNING id INTO eid;
 UPDATE hiring_economic_plans SET status=CASE p_action WHEN 'submitted' THEN 'in_review' ELSE p_action END,updated_at=now() WHERE id=pl.id;
 RETURN eid;
END $$;

-- One-record RLS probe: inherit the caller's JWT through the non-BYPASSRLS writer.
CREATE FUNCTION public.hiring_econ_visible_times(p_entries uuid[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT id FROM project_time_entries WHERE id=ANY(p_entries) $$;
DO $time_owner$ DECLARE had_create boolean:=has_schema_privilege('techerp_request_writer','public','CREATE');BEGIN
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO techerp_request_writer;END IF;
 ALTER FUNCTION public.hiring_econ_visible_times(uuid[]) OWNER TO techerp_request_writer;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM techerp_request_writer;END IF;
END $time_owner$;
REVOKE ALL ON FUNCTION public.hiring_econ_visible_times(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hiring_econ_time_eligible(w uuid,p_start uuid,p_entry uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_execution_starts execution_start JOIN hiring_preparation_requests request ON request.id=execution_start.request_id AND request.workspace_id=w
 JOIN project_time_entries entry ON entry.id=p_entry AND entry.workspace_id=w AND entry.person_id=request.person_id
 JOIN people_allocations allocation ON allocation.id=entry.allocation_id AND allocation.workspace_id=w AND allocation.hiring_engagement_id=execution_start.engagement_id AND allocation.person_id=request.person_id AND allocation.project_id=entry.project_id AND allocation.purchase_contract_id=execution_start.contract_id
 JOIN project_period_closings closing ON closing.id=entry.period_closing_id AND closing.workspace_id=w AND closing.status='closed'
 WHERE execution_start.id=p_start AND execution_start.workspace_id=w AND entry.status::text='approved' AND entry.source::text NOT IN('import','locked_import') AND entry.duration_seconds>0 AND entry.approved_at IS NOT NULL AND entry.approved_by IS NOT NULL
 AND entry.entry_date<=current_date AND entry.entry_date BETWEEN allocation.starts_at AND coalesce(allocation.ends_at,'infinity'::date)
 AND entry.entry_date BETWEEN closing.period_from AND closing.period_to
 AND ((closing.scope='project' AND closing.project_id=entry.project_id) OR (closing.scope='person' AND closing.user_id=entry.user_id))
 AND closing.entries_snapshot @> jsonb_build_array(jsonb_build_object('id',entry.id,'revision',entry.revision,'seconds',entry.duration_seconds,'user_id',entry.user_id,'project_id',entry.project_id,'entry_date',entry.entry_date)))
$$;
REVOKE ALL ON FUNCTION public.hiring_econ_time_eligible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

-- Private calculator for one competence month. Pure read. Requires the current approved plan version.
CREATE FUNCTION public.hiring_econ_compute(w uuid,i uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;pl hiring_economic_plans;v hiring_economic_plan_versions;c jsonb;lo date;hi date;a date;b date;lines jsonb:='[]';
 x record;secs bigint;excl jsonb;days int;
BEGIN
 lo:=date_trunc('month',p_month)::date;hi:=(lo+interval '1 month - 1 day')::date;
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 SELECT * INTO pl FROM hiring_economic_plans WHERE workspace_id=w AND request_id=i;
 IF pl.id IS NULL OR pl.status<>'approved' THEN RAISE EXCEPTION 'Provisão exige plano econômico aprovado pelo Financeiro.';END IF;
 SELECT * INTO v FROM hiring_economic_plan_versions WHERE plan_id=pl.id AND version=pl.version;
 IF NOT EXISTS(SELECT 1 FROM hiring_economic_plan_events approval_event JOIN contract_handoff_settings configured ON configured.workspace_id=w AND configured.enabled AND configured.finance_user_id=approval_event.actor_id WHERE approval_event.plan_id=pl.id AND approval_event.version=v.version AND approval_event.kind='approved' AND approval_event.content_hash=v.content_hash AND hiring_econ_subject(w,approval_event.actor_id,r.kind,'economics.approve')) THEN RAISE EXCEPTION 'Versão aprovada não confere ou aprovador Financeiro não está autorizado atualmente.';END IF;
 a:=greatest(lo,v.effective_from,s.starts_at);b:=least(hi,coalesce(v.effective_to,hi),coalesce(s.ends_at,hi));
 FOR c IN SELECT * FROM jsonb_array_elements(v.components) LOOP
  IF c->>'type'='delivery' THEN
   SELECT k.id decision_id,k.decided_at,k.content_hash,dv.content_hash version_hash,dv.period_start,dv.period_end,d.version current_version INTO x
    FROM hiring_execution_deliveries d JOIN hiring_execution_delivery_versions dv ON dv.delivery_id=d.id AND dv.version=(c->>'delivery_version')::int
    LEFT JOIN hiring_execution_delivery_decisions k ON k.delivery_id=d.id AND k.version=dv.version AND k.decision='accepted'
    WHERE d.id=(c->>'delivery_id')::uuid AND d.request_id=i;
   IF x.period_end IS NOT NULL AND x.period_end NOT BETWEEN a AND b THEN CONTINUE;END IF;
   IF x.version_hash IS DISTINCT FROM c->>'delivery_hash' OR x.current_version IS DISTINCT FROM (c->>'delivery_version')::int THEN
    lines:=lines||jsonb_build_object('type','delivery','delivery_id',c->>'delivery_id','amount',NULL,'issue','delivery_version_changed','source_clause',c->>'source_clause');
   ELSIF x.decision_id IS NULL OR x.content_hash IS DISTINCT FROM x.version_hash THEN
    IF lo<=date_trunc('month',current_date)::date THEN lines:=lines||jsonb_build_object('type','delivery','delivery_id',c->>'delivery_id','amount',NULL,'issue','not_accepted','source_clause',c->>'source_clause');END IF;
   ELSE
    lines:=lines||jsonb_build_object('type','delivery','delivery_id',c->>'delivery_id','delivery_version',(c->>'delivery_version')::int,'decision_id',x.decision_id,'amount',(c->>'amount')::numeric,
     'competence',lo,'from',x.period_start,'to',x.period_end,'accepted_at',x.decided_at,'due_on',((x.decided_at AT TIME ZONE 'America/Sao_Paulo')::date+(c->>'due_days')::int),'source_clause',c->>'source_clause');
   END IF;
  ELSIF c->>'type'='monthly' THEN
   IF a<=b THEN
    days:=b-a+1;
    lines:=lines||jsonb_build_object('type','monthly','from',a,'to',b,'days',days,'month_days',hi-lo+1,'proration',c->>'proration',
     'amount',round(CASE WHEN c->>'proration'='full_month' THEN (c->>'amount')::numeric ELSE (c->>'amount')::numeric*days/(hi-lo+1) END,2),
     'competence',lo,'due_on',hi+(c->>'due_days')::int,'source_clause',c->>'source_clause');
   END IF;
  ELSE
   -- Approved, non-imported entries inside a closed period of this engagement's allocations only. Sales invoice fields are only read, never written.
   -- Materialize source eligibility once; evaluate caller RLS in one bounded set, not one query per entry.
   WITH candidate AS MATERIALIZED (
    SELECT t.*,CASE WHEN t.status::text='approved' AND t.source::text NOT IN('import','locked_import') AND t.duration_seconds>0 THEN hiring_econ_time_eligible(w,s.id,t.id) ELSE false END eligible
    FROM project_time_entries t WHERE t.workspace_id=w AND t.person_id=r.person_id AND t.entry_date BETWEEN a AND b AND (c->>'project_id' IS NULL OR t.project_id=(c->>'project_id')::uuid) AND (t.allocation_id IS NULL OR EXISTS(SELECT 1 FROM people_allocations source_allocation WHERE source_allocation.id=t.allocation_id AND source_allocation.workspace_id=w AND source_allocation.hiring_engagement_id=s.engagement_id))
   )
   SELECT coalesce(sum(t.duration_seconds) FILTER(WHERE eligible),0) secs,
    coalesce(array_agg(t.id),'{}'::uuid[]) ids,
    coalesce(array_agg(DISTINCT t.project_id),'{}'::uuid[]) projects,
    coalesce(jsonb_agg(jsonb_build_object('id',t.id,'revision',t.revision,'closing',t.period_closing_id,'seconds',t.duration_seconds,'allocation_id',t.allocation_id,'entry_date',t.entry_date,'project_id',t.project_id,'approved_at',t.approved_at,'approved_by',t.approved_by) ORDER BY t.id) FILTER(WHERE eligible),'[]') src,
    jsonb_build_object('count',count(*) FILTER(WHERE NOT eligible),'seconds',coalesce(sum(t.duration_seconds) FILTER(WHERE NOT eligible),0),'pending_count',count(*) FILTER(WHERE NOT eligible AND t.status::text<>'rejected')) excluded
    INTO x FROM candidate t;
   IF cardinality(x.ids)<>(SELECT count(*) FROM hiring_econ_visible_times(x.ids)) OR EXISTS(SELECT 1 FROM unnest(x.projects) source_project WHERE NOT hiring_delivery_reference_visible(source_project,NULL)) THEN RAISE EXCEPTION 'Fontes de horas indisponíveis para o seu usuário; cálculo não realizado.' USING ERRCODE='42501';END IF;
   excl:=x.excluded;
   IF a<=b THEN
    lines:=lines||jsonb_build_object('type','hourly','project_id',c->>'project_id','seconds',x.secs,'entries',x.src,'rate',(c->>'amount')::numeric,
     'amount',round(x.secs*(c->>'amount')::numeric/3600,2),'excluded',excl,'issue',CASE WHEN (excl->>'pending_count')::int>0 THEN 'pending_time_sources' END,'competence',lo,'due_on',hi+(c->>'due_days')::int,'source_clause',c->>'source_clause');
   END IF;
  END IF;
 END LOOP;
 c:=jsonb_build_object('policy','hiring-econ-cost-v1','kind','cost','request_id',i,'start_id',s.id,'plan_id',pl.id,'plan_version',v.version,'plan_hash',v.content_hash,
  'contract_id',s.contract_id,'contract_hash',s.contract_hash,'request_revision',s.request_revision,'legal_entity_id',s.legal_entity_id,'currency',v.currency,'from',lo,'to',hi,
  'release_condition',v.release_condition,'lines',lines,
  'totals',jsonb_build_object('known',(SELECT coalesce(sum((l->>'amount')::numeric),0) FROM jsonb_array_elements(lines) l),'unknown_lines',(SELECT count(*) FROM jsonb_array_elements(lines) l WHERE l->>'amount' IS NULL OR l->>'issue' IS NOT NULL)),
  'notice','Previsão/custo gerencial por competência. Não é título, exigibilidade nem autorização de pagamento.');
 RETURN c||jsonb_build_object('hash',hiring_ops_hash(c::text));
END $$;

CREATE FUNCTION public.hiring_econ_provision_preview(w uuid,i uuid,p_month date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;problem text;
BEGIN
 r:=hiring_econ_actor(w,i,'provisions.manage',false);
 IF NOT hiring_econ_subject(w,auth.uid(),r.kind,'economics.view') THEN RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';END IF;
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF p_month IS NULL OR date_trunc('month',p_month)>date_trunc('month',current_date) THEN RAISE EXCEPTION 'Competência futura não tem prévia de custo realizado.';END IF;
 RETURN hiring_econ_compute(w,i,p_month);
END $$;

CREATE FUNCTION public.hiring_econ_provision_close(w uuid,i uuid,p_month date,p_hash text,p_previous uuid,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;v jsonb;lo date;prev hiring_monthly_provisions;nid uuid;problem text;
BEGIN
 r:=hiring_econ_actor(w,i,'provisions.approve',true);
 IF NOT EXISTS(SELECT 1 FROM hiring_formalizations configured WHERE configured.workspace_id=w AND configured.request_id=i AND configured.finance_user=auth.uid()) THEN RAISE EXCEPTION 'Somente o responsável Financeiro vigente pode fechar a provisão.' USING ERRCODE='42501';END IF;
 IF NOT hiring_econ_subject(w,auth.uid(),r.kind,'economics.view') THEN RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';END IF;
 lo:=date_trunc('month',p_month)::date;
 IF lo IS NULL OR lo>=date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Feche apenas mês encerrado.';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Justifique o fechamento (10 a 2000 caracteres).';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring_econ_provision:'||s.contract_id||':'||lo,0));
 problem:=hiring_econ_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 v:=hiring_econ_compute(w,i,lo);
 IF p_hash IS DISTINCT FROM v->>'hash' THEN RAISE EXCEPTION 'STALE: as fontes mudaram desde a prévia; recalcule.';END IF;
 IF jsonb_array_length(v->'lines')=0 THEN RAISE EXCEPTION 'Sem linhas desta competência para fechar.';END IF;
 IF (v->'totals'->>'unknown_lines')::int>0 THEN RAISE EXCEPTION 'Há linhas sem valor conferido ou fontes de horas pendentes; revise entrega, versão e fechamento antes de fechar.';END IF;
 SELECT * INTO prev FROM hiring_monthly_provisions WHERE kind='cost' AND contract_id=s.contract_id AND period_from=lo ORDER BY revision DESC LIMIT 1;
 IF prev.id IS NOT NULL AND prev.source_hash=v->>'hash' AND prev.closed_by=auth.uid() AND prev.reason=btrim(p_reason) THEN RETURN prev.id;END IF;
 IF prev.id IS DISTINCT FROM p_previous THEN RAISE EXCEPTION 'REVISION_CONFLICT: informe a última revisão desta competência.';END IF;
 IF prev.id IS NOT NULL AND prev.source_hash=v->>'hash' THEN RAISE EXCEPTION 'Nada mudou desde a última revisão.';END IF;
 INSERT INTO hiring_monthly_provisions(workspace_id,config_id,kind,contract_id,legal_entity_id,period_from,period_to,currency,revision,supersedes_id,snapshot,source_hash,closed_by,reason)
 VALUES(w,NULL,'cost',s.contract_id,s.legal_entity_id,lo,(v->>'to')::date,v->>'currency',coalesce(prev.revision,0)+1,prev.id,v,v->>'hash',auth.uid(),btrim(p_reason)) RETURNING id INTO nid;
 RETURN nid;
END $$;

CREATE FUNCTION public.hiring_econ_context(w uuid,i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;pl hiring_economic_plans;u uuid:=auth.uid();ro boolean:=is_read_only_view();vw boolean;mg boolean;ap boolean;pm boolean;pa boolean;fin uuid;versions jsonb;events jsonb;provs jsonb;cur hiring_economic_plan_versions;deliv jsonb;projs jsonb;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF u IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND active_workspace_id=w) OR NOT hiring_preparation_access(w,r.kind,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 SELECT * INTO pl FROM hiring_economic_plans WHERE workspace_id=w AND request_id=i;
 vw:=s.id IS NOT NULL AND hiring_econ_subject(w,u,r.kind,'economics.view') AND hiring_econ_private_ok(w,r,s.contract_id);
 mg:=vw AND NOT ro AND hiring_econ_subject(w,u,r.kind,'economics.manage');
 SELECT finance_user_id INTO fin FROM contract_handoff_settings WHERE workspace_id=w AND enabled;
 ap:=vw AND NOT ro AND pl.status='in_review' AND fin=u AND hiring_econ_subject(w,u,r.kind,'economics.approve');
 pm:=vw AND hiring_econ_subject(w,u,r.kind,'provisions.manage');
 pa:=vw AND NOT ro AND hiring_econ_subject(w,u,r.kind,'provisions.approve');
 IF vw AND pl.id IS NOT NULL THEN
  SELECT * INTO cur FROM hiring_economic_plan_versions WHERE plan_id=pl.id AND version=pl.version;
  ap:=ap AND cur.created_by<>u AND NOT EXISTS(SELECT 1 FROM hiring_economic_plan_events x WHERE x.plan_id=pl.id AND x.version=cur.version AND x.kind='submitted' AND x.actor_id=u);
  SELECT coalesce(jsonb_agg(jsonb_build_object('version',x.version,'modality',x.modality,'currency',x.currency,'effective_from',x.effective_from,'effective_to',x.effective_to,'components',x.components,
   'source_reference',x.source_reference,'content_hash',x.content_hash,'change_reason',x.change_reason,'at',x.created_at,'by',(SELECT full_name FROM profiles WHERE id=x.created_by),'by_me',x.created_by=u) ORDER BY x.version),'[]') INTO versions
   FROM hiring_economic_plan_versions x WHERE x.plan_id=pl.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('version',e.version,'kind',e.kind,'reason',e.reason,'at',e.created_at,'by',(SELECT full_name FROM profiles WHERE id=e.actor_id)) ORDER BY e.created_at),'[]') INTO events
   FROM hiring_economic_plan_events e WHERE e.plan_id=pl.id;
 END IF;
 IF vw AND (pm OR pa) THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'period_from',p.period_from,'revision',p.revision,'supersedes_id',p.supersedes_id,'currency',p.currency,'known',p.snapshot->'totals'->>'known','reason',p.reason,'closed_at',p.closed_at,
   'closed_by',(SELECT full_name FROM profiles WHERE id=p.closed_by)) ORDER BY p.period_from DESC,p.revision DESC),'[]') INTO provs
   FROM (SELECT * FROM hiring_monthly_provisions WHERE kind='cost' AND contract_id=s.contract_id AND workspace_id=w AND snapshot->>'policy'='hiring-econ-cost-v1' ORDER BY period_from DESC,revision DESC LIMIT 60) p;
 END IF;
 IF mg THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'version',d.version,'status',d.status,'title',(SELECT title FROM hiring_execution_delivery_versions v WHERE v.delivery_id=d.id AND v.version=d.version)) ORDER BY d.created_at),'[]') INTO deliv
   FROM hiring_execution_deliveries d WHERE d.workspace_id=w AND d.request_id=i;
  -- Only projects of this engagement's own allocations (no broad project listing).
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',p.id,'name',p.name)),'[]') INTO projs
   FROM people_allocations a JOIN projects p ON p.id=a.project_id AND p.workspace_id=w WHERE a.workspace_id=w AND s.engagement_id IS NOT NULL AND a.hiring_engagement_id=s.engagement_id AND hiring_delivery_reference_visible(p.id,NULL);
 END IF;
 RETURN jsonb_build_object('started',s.id IS NOT NULL,'proof_problem',CASE WHEN s.id IS NULL THEN NULL ELSE hiring_econ_proof_problem(w,i) END,'kind',r.kind,'regime',r.regime,'release_condition',r.release_condition,
  'period',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at) END,
  'can_view',vw,'can_manage',mg,'can_decide',coalesce(ap,false),'can_preview',coalesce(pm,false),'can_close',coalesce(pa,false),'finance_configured',fin IS NOT NULL,
  'finance_name',CASE WHEN vw THEN (SELECT full_name FROM profiles WHERE id=fin) END,
  'plan',CASE WHEN vw AND pl.id IS NOT NULL THEN jsonb_build_object('id',pl.id,'version',pl.version,'status',pl.status) END,
  'versions',coalesce(versions,'[]'),'events',coalesce(events,'[]'),'provisions',coalesce(provs,'[]'),'deliveries',coalesce(deliv,'[]'),'projects',coalesce(projs,'[]'));
END $$;

DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['hiring_econ_plan_guard()','hiring_econ_subject(uuid,uuid,text,text)','hiring_econ_private_ok(uuid,public.hiring_preparation_requests,uuid)','hiring_econ_actor(uuid,uuid,text,boolean)',
  'hiring_econ_proof_problem(uuid,uuid)','hiring_econ_normalize(uuid,uuid,text,text,jsonb)','hiring_econ_compute(uuid,uuid,date)',
  'hiring_econ_save(uuid,uuid,uuid,integer,text,text,date,date,jsonb,text,text,uuid)','hiring_econ_transition(uuid,uuid,uuid,integer,text,text,text,uuid)',
  'hiring_econ_provision_preview(uuid,uuid,date)','hiring_econ_provision_close(uuid,uuid,date,text,uuid,text)','hiring_econ_context(uuid,uuid)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer';
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.hiring_econ_save(uuid,uuid,uuid,integer,text,text,date,date,jsonb,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_econ_transition(uuid,uuid,uuid,integer,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_econ_provision_preview(uuid,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_econ_provision_close(uuid,uuid,date,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_econ_context(uuid,uuid) TO authenticated;

CREATE FUNCTION public.hiring_econ_provision_row_access(w uuid,k uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE request_id uuid;r hiring_preparation_requests;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) OR NOT is_workspace_member(w,auth.uid()) OR NOT work_record_access('techcontracts.contracts',k,'view') THEN RETURN false;END IF;
 SELECT hiring_request_origin INTO request_id FROM contracts WHERE id=k AND workspace_id=w;
 IF request_id IS NULL THEN RETURN true;END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE id=request_id AND workspace_id=w;
 RETURN auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) AND hiring_econ_subject(w,auth.uid(),r.kind,'economics.view') AND user_has_permission(auth.uid(),w,'techfinance.provisions.view.workspace') AND hiring_econ_private_ok(w,r,k);
END $$;
REVOKE ALL ON FUNCTION public.hiring_econ_provision_row_access(uuid,uuid) FROM PUBLIC,anon,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_econ_provision_row_access(uuid,uuid) TO authenticated;
ALTER TABLE public.hiring_monthly_provisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY hiring_econ_provision_private ON public.hiring_monthly_provisions AS RESTRICTIVE FOR SELECT TO authenticated USING(public.hiring_econ_provision_row_access(workspace_id,contract_id));
CREATE FUNCTION public.hiring_econ_legacy_provision_block(w uuid,k uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM contracts c WHERE c.workspace_id=w AND c.hiring_request_origin IS NOT NULL AND (c.id=k OR c.id=(SELECT contract_id FROM project_billing_configs WHERE id=k AND workspace_id=w))) THEN RAISE EXCEPTION 'Use o plano econômico e a provisão da solicitação de contratação de origem.';END IF;
END $$;
REVOKE ALL ON FUNCTION public.hiring_econ_legacy_provision_block(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
DO $legacy_provision$ DECLARE signature text;definition text;marker text;line text;BEGIN
 FOREACH signature IN ARRAY ARRAY['public.hiring_provision_preview(uuid,uuid,date,text)','public.hiring_provision_close(uuid,uuid,date,text,uuid,text,text)','public.hiring_provision_context(uuid,uuid,date,uuid)'] LOOP
  IF to_regprocedure(signature) IS NULL THEN CONTINUE;END IF;
  SELECT pg_get_functiondef(to_regprocedure(signature)) INTO definition;
  marker:=NULL;
  FOR line IN SELECT unnest(string_to_array(definition,E'\n')) LOOP
   IF strpos(line,'IF NOT public.hiring_provision_access')>0 AND strpos(line,'END IF;')>0 THEN marker:=line;EXIT;END IF;
  END LOOP;
  IF marker IS NULL THEN RAISE EXCEPTION 'Unexpected legacy provision boundary: %',signature;END IF;
  definition:=replace(definition,marker,marker||E'\n PERFORM public.hiring_econ_legacy_provision_block(w,k);');
  EXECUTE definition;
 END LOOP;
END $legacy_provision$;
