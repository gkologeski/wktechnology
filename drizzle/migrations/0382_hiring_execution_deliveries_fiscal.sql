-- Provision the private bucket in the reviewed schema transaction, never while preparing code.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('hiring-fiscal-documents','hiring-fiscal-documents',false,10485760,ARRAY['application/pdf','application/xml','text/xml','image/png','image/jpeg']) ON CONFLICT(id) DO NOTHING;
DO $bucket$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='hiring-fiscal-documents' AND (public OR file_size_limit IS NULL OR file_size_limit>10485760)) THEN RAISE EXCEPTION 'Revise a configuração privada do bucket fiscal antes da migração.';END IF;
END $bucket$;

-- Package 4 batch B (ENTREGA-FISCAL): versioned deliveries with explicit human acceptance and a private fiscal-document trail.
-- Reviewed release migration; apply through the journal after green CI. No business records are seeded.
-- Reuses hiring_execution_starts (0381) and the current signature proof. Creates no title, payable, payment, invite or IAM.
-- Never updates project/milestone billing fields, sold services or signed contract attachments.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.deliveries.manage.workspace','techpeople','hiring_requests.deliveries','manage','workspace','Registrar entregas do profissional','Define critérios, período, responsável e evidência de entregas após o início autorizado.',true),
('techpeople.hiring_requests.deliveries.approve.workspace','techpeople','hiring_requests.deliveries','approve','workspace','Aceitar entregas do profissional','Responsável nomeado aceita ou rejeita a versão submetida; não gera título nem pagamento.',true),
('techpeople.hiring_requests.fiscal_documents.create.workspace','techpeople','hiring_requests.fiscal_documents','create','workspace','Enviar documento fiscal/folha do profissional','Envia documento privado (folha, NF ou documento do freelance) após o início autorizado.',true),
('techpeople.hiring_requests.fiscal_documents.view.workspace','techpeople','hiring_requests.fiscal_documents','view','workspace','Ver documentos fiscais do profissional','Lista e baixa documentos fiscais privados, com valores e CNPJs.',true),
('techpeople.hiring_requests.fiscal_documents.approve.workspace','techpeople','hiring_requests.fiscal_documents','approve','workspace','Conferir documento fiscal do profissional (Financeiro)','Conferência humana do Financeiro; não autentica o documento na prefeitura/SEFAZ e não gera pagamento.',true),
('techcontracts.supplier_requests.deliveries.manage.workspace','techcontracts','supplier_requests.deliveries','manage','workspace','Registrar entregas do fornecedor','Define critérios, período, responsável e evidência de entregas após o início autorizado.',true),
('techcontracts.supplier_requests.deliveries.approve.workspace','techcontracts','supplier_requests.deliveries','approve','workspace','Aceitar entregas do fornecedor','Responsável nomeado aceita ou rejeita a versão submetida; não gera título nem pagamento.',true),
('techcontracts.supplier_requests.fiscal_documents.create.workspace','techcontracts','supplier_requests.fiscal_documents','create','workspace','Enviar nota fiscal do fornecedor','Envia NF privada após o início autorizado.',true),
('techcontracts.supplier_requests.fiscal_documents.view.workspace','techcontracts','supplier_requests.fiscal_documents','view','workspace','Ver notas fiscais do fornecedor','Lista e baixa notas fiscais privadas, com valores e CNPJs.',true),
('techcontracts.supplier_requests.fiscal_documents.approve.workspace','techcontracts','supplier_requests.fiscal_documents','approve','workspace','Conferir nota fiscal do fornecedor (Financeiro)','Conferência humana do Financeiro; não autentica o documento externamente e não gera pagamento.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.hiring_execution_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 start_id uuid NOT NULL REFERENCES public.hiring_execution_starts(id),
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','submitted','accepted','rejected')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id)
);
CREATE TABLE public.hiring_execution_delivery_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 delivery_id uuid NOT NULL,
 version integer NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 200),
 criteria text NOT NULL CHECK(length(btrim(criteria)) BETWEEN 10 AND 5000),
 period_start date NOT NULL,
 period_end date NOT NULL,
 responsible_id uuid NOT NULL,
 project_id uuid REFERENCES public.projects(id),
 milestone_id uuid,
 contract_hash text NOT NULL,
 content_hash text NOT NULL,
 change_reason text CHECK(change_reason IS NULL OR length(btrim(change_reason)) BETWEEN 5 AND 2000),
 operation_id uuid NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(delivery_id,version),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES public.hiring_execution_deliveries(workspace_id,id),
 CHECK(period_end>=period_start),
 CHECK(milestone_id IS NULL OR project_id IS NOT NULL)
);
CREATE TABLE public.hiring_execution_delivery_submissions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 delivery_id uuid NOT NULL,
 version integer NOT NULL,
 evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 10 AND 5000),
 evidence_hash text NOT NULL,
 operation_id uuid NOT NULL UNIQUE,
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES public.hiring_execution_deliveries(workspace_id,id),
 FOREIGN KEY(delivery_id,version) REFERENCES public.hiring_execution_delivery_versions(delivery_id,version)
);
CREATE TABLE public.hiring_execution_delivery_decisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 delivery_id uuid NOT NULL,
 version integer NOT NULL,
 submission_id uuid NOT NULL UNIQUE REFERENCES public.hiring_execution_delivery_submissions(id),
 content_hash text NOT NULL,
 contract_hash text NOT NULL,
 decision text NOT NULL CHECK(decision IN('accepted','rejected')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 2000),
 operation_id uuid NOT NULL UNIQUE,
 decided_by uuid NOT NULL,
 decided_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES public.hiring_execution_deliveries(workspace_id,id),
 FOREIGN KEY(delivery_id,version) REFERENCES public.hiring_execution_delivery_versions(delivery_id,version)
);

CREATE TABLE public.hiring_fiscal_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 start_id uuid NOT NULL REFERENCES public.hiring_execution_starts(id),
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 regime text CHECK(regime IN('clt','pj','freelance')),
 doc_type text NOT NULL CHECK(doc_type IN('payroll_evidence','nfse','nfe','freelance_document')),
 modality text CHECK(modality IS NULL OR modality IN('nfse','rpa','recibo')),
 delivery_id uuid,
 storage_path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 200),
 mime_type text NOT NULL CHECK(mime_type IN('application/pdf','application/xml','text/xml','image/png','image/jpeg')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256 text CHECK(sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
 server_sha256 text CHECK(server_sha256 IS NULL OR server_sha256 ~ '^[0-9a-f]{64}$'),
 server_attested_at timestamptz,
 issuer_tax_id text CHECK(issuer_tax_id IS NULL OR issuer_tax_id ~ '^([0-9]{11}|[0-9]{14})$'),
 taker_tax_id text CHECK(taker_tax_id IS NULL OR taker_tax_id ~ '^[0-9]{14}$'),
 amount numeric(14,2) CHECK(amount IS NULL OR amount>0),
 currency text CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
 document_number text CHECK(document_number IS NULL OR length(btrim(document_number)) BETWEEN 1 AND 60),
 issued_on date,
 status text NOT NULL DEFAULT 'pending_upload' CHECK(status IN('pending_upload','registered','verified','rejected')),
 operation_id uuid NOT NULL UNIQUE,
 uploaded_by uuid NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 registered_at timestamptz,
 reviewed_at timestamptz,
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,delivery_id) REFERENCES public.hiring_execution_deliveries(workspace_id,id),
 CHECK(status='pending_upload' OR (sha256 IS NOT NULL AND issuer_tax_id IS NOT NULL AND amount IS NOT NULL AND currency IS NOT NULL AND document_number IS NOT NULL AND issued_on IS NOT NULL AND registered_at IS NOT NULL)),
 CHECK((doc_type='freelance_document')=(modality IS NOT NULL))
);
-- Duplicate identity: same issuer/type/number or same bytes cannot be registered twice (rejected ones may be resubmitted).
CREATE UNIQUE INDEX hiring_fiscal_identity ON public.hiring_fiscal_documents(workspace_id,issuer_tax_id,doc_type,lower(btrim(document_number))) WHERE status IN('registered','verified');
CREATE UNIQUE INDEX hiring_fiscal_bytes ON public.hiring_fiscal_documents(workspace_id,sha256) WHERE status IN('registered','verified');
CREATE TABLE public.hiring_fiscal_document_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 document_id uuid NOT NULL UNIQUE,
 sha256 text NOT NULL,
 decision text NOT NULL CHECK(decision IN('verified','rejected')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 2000),
 operation_id uuid NOT NULL UNIQUE,
 reviewed_by uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,document_id) REFERENCES public.hiring_fiscal_documents(workspace_id,id)
);
CREATE TABLE public.hiring_fiscal_document_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 document_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('reserved','registered','downloaded','verified','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,document_id) REFERENCES public.hiring_fiscal_documents(workspace_id,id)
);

-- Every read goes through definer RPCs: no direct table grants, so values, tax ids and paths never leak via the Data API.
REVOKE ALL ON public.hiring_execution_deliveries,public.hiring_execution_delivery_versions,public.hiring_execution_delivery_submissions,public.hiring_execution_delivery_decisions,public.hiring_fiscal_documents,public.hiring_fiscal_document_reviews,public.hiring_fiscal_document_events FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT ALL ON public.hiring_execution_deliveries,public.hiring_execution_delivery_versions,public.hiring_execution_delivery_submissions,public.hiring_execution_delivery_decisions,public.hiring_fiscal_documents,public.hiring_fiscal_document_reviews,public.hiring_fiscal_document_events TO service_role;
ALTER TABLE public.hiring_execution_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_execution_delivery_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_execution_delivery_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_execution_delivery_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_fiscal_document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_fiscal_document_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER hiring_delivery_version_immutable BEFORE UPDATE OR DELETE ON public.hiring_execution_delivery_versions FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_delivery_submission_immutable BEFORE UPDATE OR DELETE ON public.hiring_execution_delivery_submissions FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_delivery_decision_immutable BEFORE UPDATE OR DELETE ON public.hiring_execution_delivery_decisions FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_fiscal_review_immutable BEFORE UPDATE OR DELETE ON public.hiring_fiscal_document_reviews FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE TRIGGER hiring_fiscal_event_immutable BEFORE UPDATE OR DELETE ON public.hiring_fiscal_document_events FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();

-- Registered documents keep identity/bytes; only registered -> verified/rejected may change. Never deleted.
CREATE FUNCTION public.hiring_fiscal_document_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Documento fiscal é imutável; registre nova conferência.';END IF;
 IF OLD.status='pending_upload' THEN RETURN NEW;END IF;
 IF OLD.status<>'registered' OR NEW.status NOT IN('verified','rejected') OR (to_jsonb(NEW)-ARRAY['status','reviewed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reviewed_at']) THEN RAISE EXCEPTION 'Documento fiscal registrado é imutável.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_fiscal_document_guard BEFORE UPDATE OR DELETE ON public.hiring_fiscal_documents FOR EACH ROW EXECUTE FUNCTION public.hiring_fiscal_document_guard();

CREATE FUNCTION public.hiring_ops_subject(w uuid,u uuid,k text,act text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u IS NOT NULL AND act IN('deliveries.manage','deliveries.approve','fiscal_documents.create','fiscal_documents.view','fiscal_documents.approve')
 AND hiring_preparation_approval_subject(w,u,k,'view')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x=CASE k WHEN 'professional' THEN 'techpeople.hiring_requests' ELSE 'techcontracts.supplier_requests' END||'.'||act||'.workspace')
$$;
-- Caller in its active workspace, active member, request access and the specific key. Writes also refuse "ver como".
CREATE FUNCTION public.hiring_ops_actor(w uuid,i uuid,act text,write boolean) RETURNS public.hiring_preparation_requests LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF auth.uid() IS NULL OR r.id IS NULL OR (write AND is_read_only_view()) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
  OR NOT hiring_preparation_access(w,r.kind,'view') OR NOT hiring_ops_subject(w,auth.uid(),r.kind,act) THEN RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';END IF;
 RETURN r;
END $$;
-- Current proof: immutable start, unchanged approved revision, same signed hash and intact signature.
CREATE FUNCTION public.hiring_ops_proof_problem(w uuid,i uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 IF s.id IS NULL THEN RETURN 'Entregas e documentos fiscais dependem do início autorizado pelo gestor da área.';END IF;
 IF r.revision IS DISTINCT FROM s.request_revision OR r.status<>'ready' THEN RETURN 'A solicitação mudou depois do início autorizado; novos aceites e documentos ficam bloqueados até nova formalização.';END IF;
 IF NOT hiring_execution_activation_ok(w,s.contract_id) THEN
  IF NOT hiring_formalization_current(w,i) THEN RETURN 'A aprovação ou alçada da área mudou; revalide a formalização antes de novas operações.';END IF;
  IF NOT EXISTS(SELECT 1 FROM contract_handoff_settings WHERE workspace_id=w AND enabled AND finance_user_id IS NOT NULL) THEN RETURN 'Configure o responsável Financeiro e revalide a formalização.';END IF;
  IF NOT hiring_formalization_valid(i) THEN RETURN 'Os responsáveis ou a autorização da formalização mudaram; revalide o instrumento.';END IF;
  RETURN 'Instrumento sem assinatura íntegra atual; novos aceites e documentos ficam bloqueados.';
 END IF;
 RETURN NULL;
END $$;
-- Canonical project/milestone visibility evaluated under the caller's RLS (owner is the non-BYPASSRLS writer role).
CREATE FUNCTION public.hiring_delivery_reference_visible(p uuid,m uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT (p IS NULL OR EXISTS(SELECT 1 FROM projects x WHERE x.id=p)) AND (m IS NULL OR EXISTS(SELECT 1 FROM project_milestones x WHERE x.id=m AND x.project_id=p))
$$;
DO $reference_owner$ DECLARE had_create boolean:=has_schema_privilege('techerp_request_writer','public','CREATE');BEGIN
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO techerp_request_writer;END IF;
 ALTER FUNCTION public.hiring_delivery_reference_visible(uuid,uuid) OWNER TO techerp_request_writer;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM techerp_request_writer;END IF;
END $reference_owner$;
CREATE FUNCTION public.hiring_ops_digits(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT nullif(regexp_replace(coalesce(t,''),'[^0-9]','','g'),'') $$;
CREATE FUNCTION public.hiring_ops_hash(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(t,'UTF8')),'hex') $$;

CREATE FUNCTION public.hiring_delivery_save(w uuid,i uuid,p_delivery uuid,p_version integer,p_title text,p_criteria text,p_start date,p_end date,p_responsible uuid,p_project uuid,p_milestone uuid,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;d hiring_execution_deliveries;v hiring_execution_delivery_versions;problem text;pr jsonb;nv integer;h text;
BEGIN
 r:=hiring_ops_actor(w,i,'deliveries.manage',true);
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Operação obrigatória.';END IF;
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO v FROM hiring_execution_delivery_versions WHERE operation_id=p_operation;
 IF v.id IS NOT NULL THEN
  IF v.workspace_id<>w OR v.created_by<>auth.uid() OR NOT EXISTS(SELECT 1 FROM hiring_execution_deliveries prior_delivery WHERE prior_delivery.id=v.delivery_id AND prior_delivery.request_id=i) OR (p_delivery IS NOT NULL AND p_delivery<>v.delivery_id) OR ROW(v.title,v.criteria,v.period_start,v.period_end,v.responsible_id,v.project_id,v.milestone_id) IS DISTINCT FROM ROW(btrim(p_title),btrim(p_criteria),p_start,p_end,p_responsible,p_project,p_milestone) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;
  RETURN v.delivery_id;
 END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_start<s.starts_at OR (s.ends_at IS NOT NULL AND p_end>s.ends_at) THEN RAISE EXCEPTION 'Período da entrega fora do início autorizado.';END IF;
 IF p_responsible IS NULL OR NOT hiring_ops_subject(w,p_responsible,r.kind,'deliveries.approve') THEN RAISE EXCEPTION 'Responsável pelo aceite sem permissão de aceitar entregas, sem acesso ou inativo.';END IF;
 IF p_responsible=auth.uid() THEN RAISE EXCEPTION 'Quem registra a entrega não pode ser o responsável pelo aceite.';END IF;
 IF p_milestone IS NOT NULL AND p_project IS NULL THEN RAISE EXCEPTION 'Marco exige projeto.';END IF;
 IF p_project IS NOT NULL THEN
  SELECT to_jsonb(x) INTO pr FROM projects x WHERE x.id=p_project AND x.workspace_id=w;
  IF pr IS NULL OR NOT hiring_delivery_reference_visible(p_project,p_milestone) THEN RAISE EXCEPTION 'Projeto ou marco indisponível para o seu usuário.';END IF;
  IF pr->>'legal_entity_id' IS NOT NULL AND (pr->>'legal_entity_id')::uuid IS DISTINCT FROM r.legal_entity_id THEN RAISE EXCEPTION 'Entidade WK do projeto diverge da solicitação.';END IF;
  IF EXISTS(SELECT 1 FROM contracts project_contract WHERE project_contract.workspace_id=w AND project_contract.id=(pr->>'contract_id')::uuid AND project_contract.contracting_legal_entity_id IS DISTINCT FROM r.legal_entity_id) THEN RAISE EXCEPTION 'Entidade WK do projeto diverge da solicitação.';END IF;
  IF r.purpose='client' AND (pr->>'contract_id')::uuid IS DISTINCT FROM r.commercial_contract_id THEN RAISE EXCEPTION 'Projeto não corresponde ao contrato comercial de origem.';END IF;
 END IF;
 IF p_delivery IS NULL THEN
  INSERT INTO hiring_execution_deliveries(workspace_id,request_id,start_id,kind,created_by) VALUES(w,i,s.id,r.kind,auth.uid()) RETURNING * INTO d;
  nv:=1;
 ELSE
  SELECT * INTO d FROM hiring_execution_deliveries WHERE workspace_id=w AND id=p_delivery AND request_id=i FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Entrega indisponível.';END IF;
  IF p_version IS DISTINCT FROM d.version THEN RAISE EXCEPTION 'REVISION_CONFLICT: recarregue a entrega.';END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Justifique a alteração da entrega (5 a 2000 caracteres).';END IF;
  nv:=d.version+1;
 END IF;
 h:=hiring_ops_hash(jsonb_build_object('delivery',d.id,'version',nv,'title',btrim(p_title),'criteria',btrim(p_criteria),'start',p_start,'end',p_end,'responsible',p_responsible,'project',p_project,'milestone',p_milestone,'contract_hash',s.contract_hash,'revision',s.request_revision)::text);
 INSERT INTO hiring_execution_delivery_versions(workspace_id,delivery_id,version,title,criteria,period_start,period_end,responsible_id,project_id,milestone_id,contract_hash,content_hash,change_reason,operation_id,created_by)
 VALUES(w,d.id,nv,btrim(p_title),btrim(p_criteria),p_start,p_end,p_responsible,p_project,p_milestone,s.contract_hash,h,CASE WHEN nv>1 THEN btrim(p_reason) END,p_operation,auth.uid());
 UPDATE hiring_execution_deliveries SET version=nv,status='open',updated_at=now() WHERE id=d.id;
 RETURN d.id;
END $$;

CREATE FUNCTION public.hiring_delivery_submit(w uuid,i uuid,p_delivery uuid,p_version integer,p_evidence text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;d hiring_execution_deliveries;x hiring_execution_delivery_submissions;problem text;sid uuid;
BEGIN
 r:=hiring_ops_actor(w,i,'deliveries.manage',true);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO x FROM hiring_execution_delivery_submissions WHERE operation_id=p_operation;
 IF x.id IS NOT NULL THEN IF x.submitted_by<>auth.uid() OR x.workspace_id<>w OR x.delivery_id IS DISTINCT FROM p_delivery OR x.version IS DISTINCT FROM p_version OR x.evidence IS DISTINCT FROM btrim(p_evidence) OR NOT EXISTS(SELECT 1 FROM hiring_execution_deliveries prior_delivery WHERE prior_delivery.id=x.delivery_id AND prior_delivery.request_id=i) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;RETURN x.id;END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO d FROM hiring_execution_deliveries WHERE workspace_id=w AND id=p_delivery AND request_id=i FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Entrega indisponível.';END IF;
 IF p_version IS DISTINCT FROM d.version THEN RAISE EXCEPTION 'REVISION_CONFLICT: recarregue a entrega.';END IF;
 IF d.status NOT IN('open','rejected') THEN RAISE EXCEPTION 'Entrega já submetida ou aceita nesta versão.';END IF;
 IF length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 10 AND 5000 THEN RAISE EXCEPTION 'Descreva a evidência da entrega (10 a 5000 caracteres).';END IF;
 INSERT INTO hiring_execution_delivery_submissions(workspace_id,delivery_id,version,evidence,evidence_hash,operation_id,submitted_by)
 VALUES(w,d.id,d.version,btrim(p_evidence),hiring_ops_hash(btrim(p_evidence)),p_operation,auth.uid()) RETURNING id INTO sid;
 UPDATE hiring_execution_deliveries SET status='submitted',updated_at=now() WHERE id=d.id;
 RETURN sid;
END $$;

-- Explicit human acceptance by the named responsible of the exact submitted version/hash; never the submitter.
CREATE FUNCTION public.hiring_delivery_decide(w uuid,i uuid,p_delivery uuid,p_version integer,p_hash text,p_decision text,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;d hiring_execution_deliveries;v hiring_execution_delivery_versions;x hiring_execution_delivery_submissions;k hiring_execution_delivery_decisions;s hiring_execution_starts;problem text;did uuid;
BEGIN
 r:=hiring_ops_actor(w,i,'deliveries.approve',true);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO k FROM hiring_execution_delivery_decisions WHERE operation_id=p_operation;
 IF k.id IS NOT NULL THEN IF k.decided_by<>auth.uid() OR k.workspace_id<>w OR ROW(k.delivery_id,k.version,k.content_hash,k.decision,k.reason) IS DISTINCT FROM ROW(p_delivery,p_version,p_hash,p_decision,btrim(p_reason)) OR NOT EXISTS(SELECT 1 FROM hiring_execution_deliveries prior_delivery WHERE prior_delivery.id=k.delivery_id AND prior_delivery.request_id=i) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;RETURN k.id;END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO d FROM hiring_execution_deliveries WHERE workspace_id=w AND id=p_delivery AND request_id=i FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Entrega indisponível.';END IF;
 IF p_version IS DISTINCT FROM d.version OR d.status<>'submitted' THEN RAISE EXCEPTION 'STALE: a entrega mudou ou não está submetida; recarregue antes de decidir.';END IF;
 SELECT * INTO v FROM hiring_execution_delivery_versions WHERE delivery_id=d.id AND version=d.version;
 SELECT * INTO s FROM hiring_execution_starts WHERE id=d.start_id;
 IF p_hash IS DISTINCT FROM v.content_hash OR v.contract_hash<>s.contract_hash THEN RAISE EXCEPTION 'STALE: conteúdo da versão difere do que foi conferido.';END IF;
 IF v.responsible_id<>auth.uid() THEN RAISE EXCEPTION 'Somente o responsável nomeado nesta versão pode decidir.' USING ERRCODE='42501';END IF;
 SELECT * INTO x FROM hiring_execution_delivery_submissions WHERE delivery_id=d.id AND version=d.version AND NOT EXISTS(SELECT 1 FROM hiring_execution_delivery_decisions z WHERE z.submission_id=hiring_execution_delivery_submissions.id) ORDER BY submitted_at DESC LIMIT 1;
 IF x.id IS NULL THEN RAISE EXCEPTION 'Sem submissão pendente.';END IF;
 IF x.submitted_by=auth.uid() OR v.created_by=auth.uid() THEN RAISE EXCEPTION 'Quem registrou ou submeteu a entrega não pode aceitá-la.' USING ERRCODE='42501';END IF;
 IF p_decision NOT IN('accepted','rejected') THEN RAISE EXCEPTION 'Decisão inválida.';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Motivo obrigatório (5 a 2000 caracteres).';END IF;
 INSERT INTO hiring_execution_delivery_decisions(workspace_id,delivery_id,version,submission_id,content_hash,contract_hash,decision,reason,operation_id,decided_by)
 VALUES(w,d.id,d.version,x.id,v.content_hash,s.contract_hash,p_decision,btrim(p_reason),p_operation,auth.uid()) RETURNING id INTO did;
 UPDATE hiring_execution_deliveries SET status=p_decision,updated_at=now() WHERE id=d.id;
 RETURN did;
END $$;

-- Fiscal upload step 1: reserve a private path bound to the caller (storage INSERT policy requires it).
CREATE FUNCTION public.hiring_fiscal_reserve(w uuid,i uuid,p_file_name text,p_mime text,p_size bigint,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;f hiring_fiscal_documents;problem text;id uuid:=gen_random_uuid();
BEGIN
 r:=hiring_ops_actor(w,i,'fiscal_documents.create',true);
 SELECT * INTO f FROM hiring_fiscal_documents WHERE operation_id=p_operation;
 IF f.id IS NOT NULL THEN IF f.uploaded_by<>auth.uid() OR f.workspace_id<>w OR f.request_id<>i OR f.mime_type IS DISTINCT FROM p_mime OR f.size_bytes IS DISTINCT FROM p_size OR f.file_name IS DISTINCT FROM left(regexp_replace(coalesce(p_file_name,'documento'),'[^A-Za-z0-9._ -]','_','g'),200) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;RETURN jsonb_build_object('id',f.id,'path',f.storage_path);END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF p_mime NOT IN('application/pdf','application/xml','text/xml','image/png','image/jpeg') THEN RAISE EXCEPTION 'Tipo de arquivo não aceito (PDF, XML, PNG ou JPEG).';END IF;
 IF p_size IS NULL OR p_size NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Arquivo deve ter até 10 MB.';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 INSERT INTO hiring_fiscal_documents(id,workspace_id,request_id,start_id,kind,regime,doc_type,modality,storage_path,file_name,mime_type,size_bytes,operation_id,uploaded_by)
 VALUES(id,w,i,s.id,r.kind,r.regime,'nfse',NULL,w::text||'/'||i::text||'/'||id::text,left(regexp_replace(coalesce(p_file_name,'documento'),'[^A-Za-z0-9._ -]','_','g'),200),p_mime,p_size,p_operation,auth.uid());
 INSERT INTO hiring_fiscal_document_events(workspace_id,document_id,actor_id,kind) VALUES(w,id,auth.uid(),'reserved');
 RETURN jsonb_build_object('id',id,'path',w::text||'/'||i::text||'/'||id::text);
END $$;
-- Service-only proof after reading/hash/type validation of actual stored bytes. Never callable with a user's JWT.
CREATE FUNCTION public.hiring_fiscal_attest(w uuid,i uuid,p_doc uuid,p_actor uuid,p_sha256 text,p_size bigint,p_mime text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_fiscal_documents;problem text;
BEGIN
 IF coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Confirmação de arquivo restrita ao servidor.' USING ERRCODE='42501';END IF;
 SELECT * INTO f FROM hiring_fiscal_documents WHERE id=p_doc AND workspace_id=w AND request_id=i FOR UPDATE;
 IF f.id IS NULL OR f.uploaded_by IS DISTINCT FROM p_actor OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND active_workspace_id=w) OR NOT hiring_ops_subject(w,p_actor,f.kind,'fiscal_documents.create') THEN RAISE EXCEPTION 'Envio indisponível para confirmação.' USING ERRCODE='42501';END IF;
 problem:=hiring_ops_proof_problem(w,i);IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' OR p_size IS DISTINCT FROM f.size_bytes OR p_mime IS DISTINCT FROM f.mime_type OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='hiring-fiscal-documents' AND name=f.storage_path) THEN RAISE EXCEPTION 'Arquivo armazenado não confere com a reserva.';END IF;
 IF f.server_sha256 IS NOT NULL THEN IF f.server_sha256=p_sha256 THEN RETURN;END IF;RAISE EXCEPTION 'Confirmação de arquivo imutável.';END IF;
 IF f.status<>'pending_upload' THEN RAISE EXCEPTION 'Documento não está pendente de confirmação.';END IF;
 UPDATE hiring_fiscal_documents SET server_sha256=p_sha256,server_attested_at=now() WHERE id=f.id;
END $$;
REVOKE ALL ON FUNCTION public.hiring_fiscal_attest(uuid,uuid,uuid,uuid,text,bigint,text) FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_attest(uuid,uuid,uuid,uuid,text,bigint,text) TO service_role;

-- Step 2: register metadata after the server hashed the real bytes and the object exists in the private bucket.
CREATE FUNCTION public.hiring_fiscal_register(w uuid,i uuid,p_doc uuid,p_sha256 text,p_doc_type text,p_modality text,p_issuer text,p_taker text,p_amount numeric,p_currency text,p_number text,p_issued date,p_delivery uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;f hiring_fiscal_documents;problem text;wk text;exp text;iss text:=hiring_ops_digits(p_issuer);tak text:=hiring_ops_digits(p_taker);t text;
BEGIN
 r:=hiring_ops_actor(w,i,'fiscal_documents.create',true);
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO f FROM hiring_fiscal_documents WHERE workspace_id=w AND id=p_doc AND request_id=i FOR UPDATE;
 IF f.id IS NULL OR f.uploaded_by<>auth.uid() THEN RAISE EXCEPTION 'Envio indisponível.' USING ERRCODE='42501';END IF;
 IF f.status<>'pending_upload' THEN IF ROW(f.sha256,f.doc_type,f.modality,f.issuer_tax_id,f.taker_tax_id,f.amount,f.currency,f.document_number,f.issued_on,f.delivery_id) IS NOT DISTINCT FROM ROW(p_sha256,p_doc_type,p_modality,iss,tak,round(p_amount,2),p_currency,btrim(p_number),p_issued,p_delivery) THEN RETURN f.id;END IF;RAISE EXCEPTION 'Documento já registrado.';END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Hash SHA-256 inválido.';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='hiring-fiscal-documents' AND o.name=f.storage_path AND coalesce((to_jsonb(o)->'metadata'->>'size')::bigint,f.size_bytes)=f.size_bytes) THEN RAISE EXCEPTION 'Upload não concluído ou tamanho divergente.';END IF;
 IF f.server_sha256 IS DISTINCT FROM p_sha256 OR f.server_attested_at IS NULL THEN RAISE EXCEPTION 'Arquivo ainda não confirmado pelo servidor.';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE id=f.start_id;
 SELECT hiring_ops_digits(to_jsonb(l)->>'cnpj') INTO wk FROM legal_entities l WHERE l.id=r.legal_entity_id AND l.workspace_id=w;
 IF wk IS NULL OR length(wk)<>14 THEN RAISE EXCEPTION 'CNPJ da entidade WK não cadastrado; regularize o cadastro canônico.';END IF;
 t:=p_doc_type;
 IF r.kind='supplier' THEN
  IF t NOT IN('nfse','nfe') OR p_modality IS NOT NULL THEN RAISE EXCEPTION 'Fornecedor exige NFS-e ou NF-e.';END IF;
  SELECT hiring_ops_digits(to_jsonb(c)->>'cnpj') INTO exp FROM companies c WHERE c.id=r.company_id AND c.workspace_id=w;
 ELSIF r.regime='clt' THEN
  IF t<>'payroll_evidence' OR p_modality IS NOT NULL THEN RAISE EXCEPTION 'CLT exige evidência de folha de pagamento.';END IF;
  exp:=wk;
 ELSIF r.regime='pj' THEN
  IF t NOT IN('nfse','nfe') OR p_modality IS NOT NULL THEN RAISE EXCEPTION 'PJ exige NFS-e ou NF-e.';END IF;
  IF r.company_id IS NOT NULL THEN SELECT hiring_ops_digits(to_jsonb(c)->>'cnpj') INTO exp FROM companies c WHERE c.id=r.company_id AND c.workspace_id=w;
  ELSE SELECT hiring_ops_digits(to_jsonb(p)->>'cnpj') INTO exp FROM people p WHERE p.id=r.person_id AND p.workspace_id=w;END IF;
 ELSE
  -- Freelance: the modality is an explicit user choice; no fiscal policy is inferred.
  IF t<>'freelance_document' OR p_modality NOT IN('nfse','rpa','recibo') THEN RAISE EXCEPTION 'Freelance exige modalidade explícita (NFS-e, RPA ou recibo).';END IF;
  SELECT CASE WHEN p_modality='nfse' THEN coalesce(hiring_ops_digits(to_jsonb(p)->>'cnpj'),hiring_ops_digits(to_jsonb(p)->'personal_doc'->>'cpf')) ELSE hiring_ops_digits(to_jsonb(p)->'personal_doc'->>'cpf') END INTO exp FROM people p WHERE p.id=r.person_id AND p.workspace_id=w;
  IF exp IS NULL OR length(exp) NOT IN(11,14) THEN RAISE EXCEPTION 'Identificador fiscal canônico do profissional não cadastrado.';END IF;
 END IF;
 IF r.kind='supplier' OR r.regime='pj' THEN IF exp IS NULL OR length(exp)<>14 THEN RAISE EXCEPTION 'CNPJ canônico do emitente não cadastrado; regularize o cadastro.';END IF;END IF;
 IF iss IS NULL OR length(iss) NOT IN(11,14) THEN RAISE EXCEPTION 'CPF/CNPJ do emitente inválido.';END IF;
 IF exp IS NOT NULL AND iss<>exp THEN RAISE EXCEPTION 'CNPJ do emitente diverge do cadastro canônico.';END IF;
 IF t='payroll_evidence' THEN IF tak IS NOT NULL THEN RAISE EXCEPTION 'Evidência de folha não tem tomador.';END IF;
 ELSIF tak IS DISTINCT FROM wk THEN RAISE EXCEPTION 'CNPJ do tomador deve ser o da entidade WK contratante.';END IF;
 IF p_amount IS NULL OR p_amount::text IN('NaN','Infinity','-Infinity') OR round(p_amount,2)<=0 OR p_amount>999999999999.99 OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Informe valor positivo e moeda (ISO, ex.: BRL).';END IF;
 IF length(btrim(coalesce(p_number,''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Informe o número/competência do documento.';END IF;
 IF p_issued IS NULL OR p_issued>current_date OR p_issued<s.starts_at THEN RAISE EXCEPTION 'Data de emissão fora do período executado.';END IF;
 IF p_delivery IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hiring_execution_deliveries d WHERE d.workspace_id=w AND d.id=p_delivery AND d.request_id=i) THEN RAISE EXCEPTION 'Entrega indisponível.';END IF;
 IF EXISTS(SELECT 1 FROM hiring_fiscal_documents x WHERE x.workspace_id=w AND x.status IN('registered','verified') AND (x.sha256=p_sha256 OR (x.issuer_tax_id=iss AND x.doc_type=t AND lower(btrim(x.document_number))=lower(btrim(p_number))))) THEN RAISE EXCEPTION 'Documento duplicado: mesmo arquivo ou mesma identidade (emitente, tipo e número) já registrado.';END IF;
 UPDATE hiring_fiscal_documents SET sha256=p_sha256,doc_type=t,modality=p_modality,issuer_tax_id=iss,taker_tax_id=tak,amount=round(p_amount,2),currency=p_currency,document_number=btrim(p_number),issued_on=p_issued,delivery_id=p_delivery,status='registered',registered_at=now() WHERE id=f.id;
 INSERT INTO hiring_fiscal_document_events(workspace_id,document_id,actor_id,kind) VALUES(w,f.id,auth.uid(),'registered');
 RETURN f.id;
END $$;
-- Explicit Finance check of the exact bytes. Human conference only: no external fiscal authentication, no title or payment.
CREATE FUNCTION public.hiring_fiscal_review(w uuid,i uuid,p_doc uuid,p_sha256 text,p_decision text,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;f hiring_fiscal_documents;x hiring_fiscal_document_reviews;problem text;rid uuid;
BEGIN
 r:=hiring_ops_actor(w,i,'fiscal_documents.approve',true);
 IF NOT hiring_ops_subject(w,auth.uid(),r.kind,'fiscal_documents.view') THEN RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';END IF;
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO x FROM hiring_fiscal_document_reviews WHERE operation_id=p_operation;
 IF x.id IS NOT NULL THEN IF x.reviewed_by<>auth.uid() OR x.workspace_id<>w OR ROW(x.document_id,x.sha256,x.decision,x.reason) IS DISTINCT FROM ROW(p_doc,p_sha256,p_decision,btrim(p_reason)) OR NOT EXISTS(SELECT 1 FROM hiring_fiscal_documents prior_document WHERE prior_document.id=x.document_id AND prior_document.request_id=i) THEN RAISE EXCEPTION 'Operação já utilizada com outros dados.';END IF;RETURN x.id;END IF;
 problem:=hiring_ops_proof_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO f FROM hiring_fiscal_documents WHERE workspace_id=w AND id=p_doc AND request_id=i FOR UPDATE;
 IF f.id IS NULL OR f.status<>'registered' THEN RAISE EXCEPTION 'STALE: documento não está aguardando conferência.';END IF;
 IF p_sha256 IS DISTINCT FROM f.sha256 THEN RAISE EXCEPTION 'STALE: hash conferido difere do arquivo registrado.';END IF;
 IF f.uploaded_by=auth.uid() THEN RAISE EXCEPTION 'Quem enviou o documento não pode conferi-lo.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM hiring_formalizations configured_finance WHERE configured_finance.request_id=i AND configured_finance.workspace_id=w AND configured_finance.finance_user=auth.uid()) THEN RAISE EXCEPTION 'Somente o responsável Financeiro vigente pode conferir o documento.' USING ERRCODE='42501';END IF;
 IF p_decision NOT IN('verified','rejected') OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Decisão e motivo (5 a 2000 caracteres) obrigatórios.';END IF;
 INSERT INTO hiring_fiscal_document_reviews(workspace_id,document_id,sha256,decision,reason,operation_id,reviewed_by) VALUES(w,f.id,f.sha256,p_decision,btrim(p_reason),p_operation,auth.uid()) RETURNING id INTO rid;
 UPDATE hiring_fiscal_documents SET status=p_decision,reviewed_at=now() WHERE id=f.id;
 INSERT INTO hiring_fiscal_document_events(workspace_id,document_id,actor_id,kind) VALUES(w,f.id,auth.uid(),p_decision);
 RETURN rid;
END $$;
-- Authenticated download: returns the private path and expected hash only to holders of the view key and records the access.
CREATE FUNCTION public.hiring_fiscal_open(w uuid,i uuid,p_doc uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;f hiring_fiscal_documents;
BEGIN
 r:=hiring_ops_actor(w,i,'fiscal_documents.view',false);
 SELECT * INTO f FROM hiring_fiscal_documents WHERE workspace_id=w AND id=p_doc AND request_id=i AND status<>'pending_upload';
 IF f.id IS NULL THEN RAISE EXCEPTION 'Documento indisponível.';END IF;
 IF NOT is_read_only_view() THEN INSERT INTO hiring_fiscal_document_events(workspace_id,document_id,actor_id,kind) VALUES(w,f.id,auth.uid(),'downloaded');END IF;
 RETURN jsonb_build_object('path',f.storage_path,'sha256',f.sha256,'file_name',f.file_name,'mime_type',f.mime_type);
END $$;
-- Storage policy helpers (boolean only).
CREATE FUNCTION public.hiring_fiscal_storage_write(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_fiscal_documents f JOIN profiles pr ON pr.id=auth.uid() AND pr.active_workspace_id=f.workspace_id
  WHERE f.storage_path=p AND f.status='pending_upload' AND f.server_attested_at IS NULL AND f.uploaded_by=auth.uid() AND f.reserved_at>now()-interval '1 hour'
  AND NOT is_read_only_view() AND hiring_ops_subject(f.workspace_id,auth.uid(),f.kind,'fiscal_documents.create'))
$$;
CREATE FUNCTION public.hiring_fiscal_storage_read(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_fiscal_documents f JOIN profiles pr ON pr.id=auth.uid() AND pr.active_workspace_id=f.workspace_id
  WHERE f.storage_path=p AND hiring_ops_subject(f.workspace_id,auth.uid(),f.kind,'fiscal_documents.view')
  AND (f.status<>'pending_upload' OR f.uploaded_by=auth.uid()))
$$;
CREATE POLICY hiring_fiscal_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='hiring-fiscal-documents' AND public.hiring_fiscal_storage_write(name));
CREATE POLICY hiring_fiscal_objects_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hiring-fiscal-documents' AND public.hiring_fiscal_storage_read(name));
-- Restrictive policies also contain any broader existing/future permissive policy.
CREATE POLICY hiring_fiscal_objects_insert_bound ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'hiring-fiscal-documents' OR public.hiring_fiscal_storage_write(name));
CREATE POLICY hiring_fiscal_objects_read_bound ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'hiring-fiscal-documents' OR public.hiring_fiscal_storage_read(name));
CREATE POLICY hiring_fiscal_objects_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'hiring-fiscal-documents') WITH CHECK(bucket_id<>'hiring-fiscal-documents');
CREATE POLICY hiring_fiscal_objects_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'hiring-fiscal-documents');
-- No UPDATE/DELETE policy: stored fiscal bytes are never replaced or removed by users.

-- Read-only context; fiscal values/tax ids only with the fiscal view key.
CREATE FUNCTION public.hiring_execution_ops_context(w uuid,i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;u uuid:=auth.uid();ro boolean:=is_read_only_view();fv boolean;manage boolean;deliveries jsonb;fiscal jsonb;eligible jsonb:='[]';
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF u IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=u AND active_workspace_id=w) OR NOT hiring_preparation_access(w,r.kind,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE workspace_id=w AND request_id=i;
 fv:=hiring_ops_subject(w,u,r.kind,'fiscal_documents.view');
 manage:=NOT ro AND hiring_ops_subject(w,u,r.kind,'deliveries.manage');
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',d.id,'version',d.version,'status',d.status,
  'current',(SELECT jsonb_build_object('title',v.title,'criteria',v.criteria,'period_start',v.period_start,'period_end',v.period_end,'responsible_id',v.responsible_id,
    'responsible_name',(SELECT full_name FROM profiles WHERE id=v.responsible_id),'project_id',v.project_id,'milestone_id',v.milestone_id,
    'project_name',(SELECT name FROM projects WHERE id=v.project_id AND workspace_id=w),'content_hash',v.content_hash) FROM hiring_execution_delivery_versions v WHERE v.delivery_id=d.id AND v.version=d.version),
  'can_decide',NOT ro AND d.status='submitted' AND hiring_ops_subject(w,u,r.kind,'deliveries.approve')
    AND EXISTS(SELECT 1 FROM hiring_execution_delivery_versions v WHERE v.delivery_id=d.id AND v.version=d.version AND v.responsible_id=u AND v.created_by<>u)
    AND NOT EXISTS(SELECT 1 FROM hiring_execution_delivery_submissions x WHERE x.delivery_id=d.id AND x.version=d.version AND x.submitted_by=u),
  'history',(SELECT coalesce(jsonb_agg(e ORDER BY e->>'at'),'[]') FROM (
     SELECT jsonb_build_object('type','version','version',v.version,'at',v.created_at,'by',(SELECT full_name FROM profiles WHERE id=v.created_by),'text',coalesce(v.change_reason,'Entrega definida'),'title',v.title) e FROM hiring_execution_delivery_versions v WHERE v.delivery_id=d.id
     UNION ALL SELECT jsonb_build_object('type','submission','version',x.version,'at',x.submitted_at,'by',(SELECT full_name FROM profiles WHERE id=x.submitted_by),'text',x.evidence) FROM hiring_execution_delivery_submissions x WHERE x.delivery_id=d.id
     UNION ALL SELECT jsonb_build_object('type',k.decision,'version',k.version,'at',k.decided_at,'by',(SELECT full_name FROM profiles WHERE id=k.decided_by),'text',k.reason) FROM hiring_execution_delivery_decisions k WHERE k.delivery_id=d.id) h)
 ) ORDER BY d.created_at),'[]') INTO deliveries FROM hiring_execution_deliveries d WHERE d.workspace_id=w AND d.request_id=i;
 IF fv THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'status',f.status,'doc_type',f.doc_type,'modality',f.modality,'file_name',f.file_name,'mime_type',f.mime_type,'size_bytes',f.size_bytes,'sha256',f.sha256,
   'issuer_tax_id',f.issuer_tax_id,'taker_tax_id',f.taker_tax_id,'amount',f.amount,'currency',f.currency,'document_number',f.document_number,'issued_on',f.issued_on,'delivery_id',f.delivery_id,
   'uploaded_by_name',(SELECT full_name FROM profiles WHERE id=f.uploaded_by),'registered_at',f.registered_at,
   'review',(SELECT jsonb_build_object('decision',v.decision,'reason',v.reason,'at',v.reviewed_at,'by',(SELECT full_name FROM profiles WHERE id=v.reviewed_by)) FROM hiring_fiscal_document_reviews v WHERE v.document_id=f.id),
   'can_review',NOT ro AND f.status='registered' AND f.uploaded_by<>u AND hiring_ops_subject(w,u,r.kind,'fiscal_documents.approve') AND EXISTS(SELECT 1 FROM hiring_formalizations z WHERE z.request_id=i AND z.workspace_id=w AND z.finance_user=u)) ORDER BY f.reserved_at),'[]')
  INTO fiscal FROM hiring_fiscal_documents f WHERE f.workspace_id=w AND f.request_id=i AND f.status<>'pending_upload';
 END IF;
 IF manage THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.full_name) ORDER BY p.full_name),'[]') INTO eligible
  FROM (SELECT DISTINCT user_id FROM workspace_members WHERE workspace_id=w AND status='active' AND user_id<>u LIMIT 200) m JOIN profiles p ON p.id=m.user_id
  WHERE hiring_ops_subject(w,m.user_id,r.kind,'deliveries.approve');
 END IF;
 RETURN jsonb_build_object('started',s.id IS NOT NULL,'proof_problem',hiring_ops_proof_problem(w,i),'kind',r.kind,'regime',r.regime,
  'period',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at) END,
  'can_manage_deliveries',manage,'can_register_fiscal',NOT ro AND hiring_ops_subject(w,u,r.kind,'fiscal_documents.create'),'can_view_fiscal',fv,
  'deliveries',deliveries,'fiscal',fiscal,'eligible_responsibles',eligible);
END $$;

REVOKE ALL ON FUNCTION public.hiring_fiscal_document_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_ops_subject(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_ops_actor(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_ops_proof_problem(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_delivery_reference_visible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hiring_ops_digits(text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_ops_hash(text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_delivery_save(uuid,uuid,uuid,integer,text,text,date,date,uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_delivery_submit(uuid,uuid,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_delivery_decide(uuid,uuid,uuid,integer,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_reserve(uuid,uuid,text,text,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_register(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_review(uuid,uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_open(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_storage_write(text) FROM PUBLIC,anon,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_fiscal_storage_read(text) FROM PUBLIC,anon,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_ops_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_delivery_reference_visible(uuid,uuid) TO techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_delivery_save(uuid,uuid,uuid,integer,text,text,date,date,uuid,uuid,uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_delivery_submit(uuid,uuid,uuid,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_delivery_decide(uuid,uuid,uuid,integer,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_reserve(uuid,uuid,text,text,bigint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_register(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_review(uuid,uuid,uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_open(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_storage_write(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_fiscal_storage_read(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_execution_ops_context(uuid,uuid) TO authenticated;
