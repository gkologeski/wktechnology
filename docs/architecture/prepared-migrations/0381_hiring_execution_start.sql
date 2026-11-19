-- Package 4 batch A (INICIO-EXECUCAO): governed start/execution for approved, signed hiring requests.
-- PREPARED FOR REVIEW ONLY: outside the drizzle journal; never applied by this batch.
-- Direct professional origin reuses hiring_engagements/people_allocations without fake ATS job/application.
-- No IAM grant, invite, finance entry or payment is created here.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.execution.approve.workspace','techpeople','hiring_requests.execution','approve','workspace','Autorizar início de profissional','Gestor da área autoriza o início após assinatura íntegra; não concede acessos, convites nem financeiro.',true),
('techcontracts.supplier_requests.execution.approve.workspace','techcontracts','supplier_requests.execution','approve','workspace','Autorizar início de fornecedor','Gestor da área autoriza o início do fornecedor após assinatura íntegra; não cria pessoa, vínculo nem financeiro.',true)
ON CONFLICT(key) DO NOTHING;

-- Direct origin: job/model stay mandatory for every ATS engagement; direct rows carry the request instead.
ALTER TABLE public.hiring_engagements ALTER COLUMN job_id DROP NOT NULL, ALTER COLUMN model_version_id DROP NOT NULL;
ALTER TABLE public.hiring_engagements ADD COLUMN hiring_request_id uuid REFERENCES public.hiring_preparation_requests(id);
ALTER TABLE public.hiring_engagements ADD CONSTRAINT hiring_engagement_origin CHECK(
 (hiring_request_id IS NULL AND job_id IS NOT NULL AND model_version_id IS NOT NULL)
 OR (hiring_request_id IS NOT NULL AND job_id IS NULL AND application_id IS NULL));
CREATE UNIQUE INDEX hiring_engagement_one_request ON public.hiring_engagements(hiring_request_id) WHERE hiring_request_id IS NOT NULL;
COMMENT ON COLUMN public.hiring_engagements.model_version_id IS 'ATS origin: approved access model. Direct request origin: NULL until a separate administrator model/invite action (no IAM here).';

CREATE TABLE public.hiring_execution_starts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('professional','supplier')),
 request_revision integer NOT NULL,
 approval_id uuid NOT NULL,
 contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id),
 contract_hash text NOT NULL,
 evidence_id uuid NOT NULL REFERENCES public.hiring_contract_evidence(id),
 legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id),
 policy_snapshot jsonb NOT NULL,
 starts_at date NOT NULL,
 ends_at date,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 engagement_id uuid UNIQUE REFERENCES public.hiring_engagements(id),
 operation_id uuid NOT NULL UNIQUE,
 authorized_by uuid NOT NULL,
 authorized_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,approval_id) REFERENCES public.hiring_preparation_approvals(workspace_id,id),
 UNIQUE(request_id),
 CHECK(ends_at IS NULL OR ends_at>=starts_at),
 CHECK((kind='professional')=(engagement_id IS NOT NULL))
);
REVOKE ALL ON public.hiring_execution_starts FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT SELECT ON public.hiring_execution_starts TO authenticated;
GRANT ALL ON public.hiring_execution_starts TO service_role;
ALTER TABLE public.hiring_execution_starts ENABLE ROW LEVEL SECURITY;
CREATE POLICY hiring_execution_start_read ON public.hiring_execution_starts FOR SELECT TO authenticated
 USING(public.hiring_preparation_access(workspace_id,kind,'view') AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.workspace_id=hiring_execution_starts.workspace_id AND r.id=request_id));
CREATE TRIGGER hiring_execution_start_immutable BEFORE UPDATE OR DELETE ON public.hiring_execution_starts FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();

-- Current area manager only: principal, or explicit substitute when the principal authored the demand. CEO is never a fallback.
CREATE FUNCTION public.hiring_execution_manager(w uuid,i uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p.manager_id=r.created_by THEN p.manager_delegate_id ELSE p.manager_id END
 FROM hiring_preparation_requests r JOIN hiring_area_policies p ON p.workspace_id=r.workspace_id AND p.area_id=r.area_id
 WHERE r.workspace_id=w AND r.id=i
$$;
CREATE FUNCTION public.hiring_execution_subject(w uuid,u uuid,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u IS NOT NULL AND hiring_preparation_approval_subject(w,u,k,'view') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x=CASE k WHEN 'professional' THEN 'techpeople.hiring_requests' ELSE 'techcontracts.supplier_requests' END||'.execution.approve.workspace')
$$;

-- Readiness. Pure read; returns NULL when start may be authorized.
CREATE FUNCTION public.hiring_execution_problem(w uuid,i uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;f hiring_formalizations;c contracts;co contracts;m uuid;pe jsonb;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF r.id IS NULL OR r.status<>'ready' THEN RETURN 'Solicitação sem revisão pronta e aprovada.';END IF;
 SELECT * INTO f FROM hiring_formalizations WHERE workspace_id=w AND request_id=i;
 IF f.request_id IS NULL THEN RETURN 'Instrumento ainda não preparado.';END IF;
 IF NOT hiring_formalization_current(w,i) THEN RETURN 'Aprovação gestor/CEO não está vigente para a revisão atual ou a alçada mudou; repita a aprovação.';END IF;
 IF NOT hiring_formalization_valid(i) THEN RETURN 'Formalização não está íntegra para a revisão aprovada; prepare nova versão.';END IF;
 SELECT * INTO c FROM contracts WHERE id=f.contract_id AND workspace_id=w;
 IF c.id IS NULL OR c.hiring_request_origin IS DISTINCT FROM i OR c.role::text<>'client' OR c.contracting_legal_entity_id IS DISTINCT FROM r.legal_entity_id THEN RETURN 'Instrumento sem origem, papel de compra ou CNPJ WK coerentes.';END IF;
 IF NOT hiring_formalization_signed(w,c.id) THEN RETURN 'Assinatura completa e verificável ainda não registrada para a versão atual.';END IF;
 IF c.starts_at IS NULL THEN RETURN 'Instrumento assinado sem início de vigência; corrija por aditivo, sem sobrescrever o assinado.';END IF;
 IF r.kind='professional' THEN
  IF r.person_id IS NULL OR coalesce(to_jsonb(r)->>'selection_mode','defined')<>'defined' THEN RETURN 'Profissional ainda não definido.';END IF;
  SELECT to_jsonb(p) INTO pe FROM people p WHERE p.id=r.person_id AND p.workspace_id=w;
  IF pe IS NULL OR coalesce((pe->>'archived')::boolean,false) THEN RETURN 'Pessoa canônica indisponível.';END IF;
  IF pe ? 'employment_type' AND pe->>'employment_type' IS NOT NULL AND pe->>'employment_type'<>(CASE r.regime WHEN 'clt' THEN 'clt' WHEN 'pj' THEN 'pj' ELSE 'contractor' END) THEN RETURN 'Regime da pessoa difere do regime aprovado; ajuste a demanda (nova aprovação), sem alteração implícita.';END IF;
 END IF;
 IF r.purpose='client' THEN
  SELECT * INTO co FROM contracts WHERE id=r.commercial_contract_id AND workspace_id=w;
  IF co.id IS NULL OR hiring_contract_signature_reason(co.id,w,co.deal_id) IS NOT NULL OR co.contracting_legal_entity_id IS DISTINCT FROM r.legal_entity_id THEN RETURN 'Contrato comercial de origem sem assinatura válida ou com CNPJ WK divergente.';END IF;
 END IF;
 m:=hiring_execution_manager(w,i);
 IF m IS NULL OR m=r.created_by THEN RETURN 'Gestor da área ausente ou autor da demanda, sem substituto explícito configurado.';END IF;
 IF NOT hiring_execution_subject(w,m,r.kind) THEN RETURN 'Gestor da área sem permissão de autorizar início, sem acesso ou inativo. Solicite regularização ao administrador autorizado.';END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION public.hiring_execution_activation_ok(w uuid,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_execution_starts s WHERE s.workspace_id=w AND s.contract_id=k AND s.contract_hash=hiring_contract_fingerprint(k)) AND hiring_formalization_signed(w,k) AND EXISTS(SELECT 1 FROM hiring_formalizations f JOIN hiring_execution_starts s ON s.request_id=f.request_id AND s.workspace_id=f.workspace_id JOIN hiring_preparation_requests r ON r.id=f.request_id AND r.workspace_id=f.workspace_id WHERE f.workspace_id=w AND f.contract_id=k AND s.request_revision=r.revision AND s.approval_id=f.approval_id AND hiring_formalization_valid(f.request_id))
$$;

CREATE FUNCTION public.hiring_execution_start(w uuid,i uuid,rev integer,p_start date,p_end date,p_reason text,p_operation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;f hiring_formalizations;c contracts;co contracts;s hiring_execution_starts;a hiring_preparation_approvals;ev uuid;e uuid;problem text;sid uuid;
BEGIN
 IF auth.uid() IS NULL OR p_operation IS NULL OR is_read_only_view() OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) THEN RAISE EXCEPTION 'Sem permissão para autorizar início.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF r.id IS NULL OR NOT hiring_preparation_access(w,r.kind,'view') OR NOT hiring_execution_subject(w,auth.uid(),r.kind) THEN RAISE EXCEPTION 'Sem permissão para autorizar início.' USING ERRCODE='42501';END IF;
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO s FROM hiring_execution_starts WHERE request_id=i;
 IF s.id IS NOT NULL THEN
  IF s.operation_id=p_operation OR (s.starts_at=p_start AND s.ends_at IS NOT DISTINCT FROM p_end AND s.authorized_by=auth.uid()) THEN RETURN s.id;END IF;
  RAISE EXCEPTION 'Início já autorizado para esta solicitação; alterações exigem aditivo e fluxo próprio.';
 END IF;
 IF rev IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'REVISION_CONFLICT: recarregue a solicitação.';END IF;
 IF hiring_execution_manager(w,i) IS DISTINCT FROM auth.uid() OR auth.uid()=r.created_by THEN RAISE EXCEPTION 'Somente o gestor da área atualmente autorizado pode autorizar o início.' USING ERRCODE='42501';END IF;
 problem:=hiring_execution_problem(w,i);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Justifique o início (10 a 2000 caracteres).';END IF;
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i;
 SELECT * INTO c FROM contracts WHERE id=f.contract_id;
 IF p_start IS NULL OR p_start<c.starts_at OR (p_end IS NOT NULL AND p_end<p_start) OR (c.ends_at IS NOT NULL AND (p_end IS NULL OR p_end>c.ends_at)) THEN RAISE EXCEPTION 'Período fora da vigência do instrumento assinado.';END IF;
 IF r.purpose='client' THEN
  SELECT * INTO co FROM contracts WHERE id=r.commercial_contract_id AND workspace_id=w;
  IF co.starts_at IS NULL OR p_start<co.starts_at OR (co.ends_at IS NOT NULL AND (p_end IS NULL OR p_end>co.ends_at)) THEN RAISE EXCEPTION 'Período fora da vigência do contrato comercial de origem.';END IF;
 END IF;
 SELECT * INTO a FROM hiring_preparation_approvals WHERE id=f.approval_id;
 SELECT x.id INTO ev FROM hiring_contract_evidence x WHERE x.workspace_id=w AND x.contract_id=c.id AND x.revoked_at IS NULL AND x.contract_hash=hiring_contract_fingerprint(c.id) ORDER BY x.id LIMIT 1;
 IF r.kind='professional' THEN
  INSERT INTO hiring_engagements(workspace_id,person_id,hiring_request_id,purpose,employment_type,legal_entity_id,commercial_contract_id,purchase_contract_id,starts_at,ends_at,status,created_by)
  VALUES(w,r.person_id,i,r.purpose,(CASE r.regime WHEN 'clt' THEN 'clt' WHEN 'pj' THEN 'pj' ELSE 'contractor' END)::people_employment_type,r.legal_entity_id,CASE WHEN r.purpose='client' THEN r.commercial_contract_id END,c.id,p_start,p_end,'active',auth.uid()) RETURNING id INTO e;
  INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e,auth.uid(),'direct_start_authorized',jsonb_build_object('request_id',i,'revision',r.revision,'contract_id',c.id,'starts_at',p_start,'ends_at',p_end));
 END IF;
 INSERT INTO hiring_execution_starts(workspace_id,request_id,kind,request_revision,approval_id,contract_id,contract_hash,evidence_id,legal_entity_id,policy_snapshot,starts_at,ends_at,reason,engagement_id,operation_id,authorized_by)
 VALUES(w,i,r.kind,r.revision,a.id,c.id,hiring_contract_fingerprint(c.id),ev,r.legal_entity_id,a.policy_snapshot,p_start,p_end,btrim(p_reason),e,p_operation,auth.uid()) RETURNING id INTO sid;
 UPDATE contracts SET status='active' WHERE id=c.id AND workspace_id=w;
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,actor_id,kind) VALUES(w,i,f.cycle,auth.uid(),'execution_started');
 RETURN sid;
END $$;

-- Direct-origin allocation checks; legacy ATS branch in hiring_allocation_guard is unchanged byte-for-byte.
CREATE FUNCTION public.hiring_execution_allocation_assert(w uuid,p_engagement uuid,p_allocation uuid,p_project uuid,p_contract uuid,p_start date,p_end date,p_pct numeric,p_override text,p_relevant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;s hiring_execution_starts;pc contracts;co contracts;pr projects;used numeric;
BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring_alloc:'||e.person_id::text,0));
 SELECT * INTO s FROM hiring_execution_starts WHERE engagement_id=e.id AND workspace_id=w;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Alocação depende do início autorizado pelo gestor da área.';END IF;
 SELECT * INTO pc FROM contracts WHERE id=s.contract_id AND workspace_id=w FOR SHARE;
 IF pc.status::text NOT IN('active','renewing') OR NOT hiring_execution_activation_ok(w,pc.id) OR s.contract_hash<>hiring_contract_fingerprint(pc.id) THEN RAISE EXCEPTION 'Instrumento sem assinatura íntegra atual ou não ativo; alocação bloqueada.';END IF;
 IF pc.hiring_person_id IS DISTINCT FROM e.person_id OR pc.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR e.purchase_contract_id IS DISTINCT FROM pc.id THEN RAISE EXCEPTION 'Instrumento, pessoa e CNPJ WK do vínculo divergem.';END IF;
 IF EXISTS(SELECT 1 FROM people p WHERE p.id=e.person_id AND (to_jsonb(p)->>'hire_date')::date>p_start) THEN RAISE EXCEPTION 'Alocação não pode iniciar antes da admissão efetiva da pessoa.';END IF;
 IF p_start<e.starts_at OR (e.ends_at IS NOT NULL AND (p_end IS NULL OR p_end>e.ends_at)) OR (p_end IS NOT NULL AND p_end<p_start) THEN RAISE EXCEPTION 'Alocação fora do período do vínculo.';END IF;
 IF p_start<pc.starts_at OR (pc.ends_at IS NOT NULL AND (p_end IS NULL OR p_end>pc.ends_at)) THEN RAISE EXCEPTION 'Alocação fora da vigência do instrumento assinado.';END IF;
 IF e.purpose='client' THEN
  SELECT * INTO co FROM contracts WHERE id=e.commercial_contract_id AND workspace_id=w FOR SHARE;
  IF co.id IS NULL OR hiring_contract_signature_reason(co.id,w,co.deal_id) IS NOT NULL OR co.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR p_contract IS DISTINCT FROM co.id THEN RAISE EXCEPTION 'Cliente e prestador devem usar o mesmo CNPJ WK e contrato comercial de origem assinado.';END IF;
  IF p_start<co.starts_at OR (co.ends_at IS NOT NULL AND (p_end IS NULL OR p_end>co.ends_at)) THEN RAISE EXCEPTION 'Alocação fora da vigência do contrato comercial.';END IF;
 END IF;
 IF p_project IS NOT NULL THEN
  SELECT * INTO pr FROM projects WHERE id=p_project AND workspace_id=w;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'Projeto indisponível no workspace.';END IF;
  IF EXISTS(SELECT 1 FROM contracts x WHERE x.id=pr.contract_id AND x.workspace_id=w AND x.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id) THEN RAISE EXCEPTION 'Entidade WK do projeto diverge do vínculo; exige análise explícita, sem trocar o empregador automaticamente.';END IF;
  IF e.purpose='client' AND pr.contract_id IS DISTINCT FROM e.commercial_contract_id THEN RAISE EXCEPTION 'Projeto não corresponde ao contrato de origem.';END IF;
 END IF;
 -- Capacity is the peak simultaneous load, not a sum of sequential allocations.
 WITH overlapping AS (
  SELECT a.starts_at,a.ends_at,a.allocation_pct FROM people_allocations a
  WHERE a.workspace_id=w AND a.person_id=e.person_id AND a.status='active' AND a.id IS DISTINCT FROM p_allocation
   AND daterange(a.starts_at,coalesce(a.ends_at,'infinity'::date),'[]') && daterange(p_start,coalesce(p_end,'infinity'::date),'[]')
 ), points AS (SELECT p_start AS point_date UNION SELECT greatest(starts_at,p_start) FROM overlapping)
 SELECT coalesce(max((SELECT coalesce(sum(a.allocation_pct),0) FROM overlapping a WHERE a.starts_at<=points.point_date AND (a.ends_at IS NULL OR a.ends_at>=points.point_date))),0) INTO used FROM points;
 IF used+coalesce(p_pct,0)>100 THEN RAISE EXCEPTION 'Capacidade da pessoa excedida no período (máximo 100%%).';END IF;
 IF p_relevant AND (p_start IS DISTINCT FROM e.starts_at OR p_end IS DISTINCT FROM e.ends_at) AND length(btrim(coalesce(p_override,'')))<10 THEN RAISE EXCEPTION 'Justifique o período diferente do vínculo (mínimo 10 caracteres).';END IF;
END $$;

-- Read-only context for the request page. No writes, no secrets, no reference values.
CREATE FUNCTION public.hiring_execution_context(w uuid,i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;s hiring_execution_starts;f hiring_formalizations;c contracts;m uuid;problem text;allocs jsonb:='[]';eng jsonb;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 IF auth.uid() IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) OR NOT hiring_preparation_access(w,r.kind,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM hiring_execution_starts WHERE request_id=i AND workspace_id=w;
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i AND workspace_id=w;
 SELECT * INTO c FROM contracts WHERE id=f.contract_id AND workspace_id=w;
 m:=hiring_execution_manager(w,i);
 IF s.id IS NULL THEN problem:=hiring_execution_problem(w,i);END IF;
 IF s.engagement_id IS NOT NULL AND hiring_employment_access(w,'techpeople.employment.view.workspace') THEN
  SELECT jsonb_build_object('id',e.id,'status',e.status,'starts_at',e.starts_at,'ends_at',e.ends_at) INTO eng FROM hiring_engagements e WHERE e.id=s.engagement_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'project_name',(SELECT name FROM projects WHERE id=a.project_id AND workspace_id=w),'allocation_pct',a.allocation_pct,'starts_at',a.starts_at,'ends_at',a.ends_at,'status',a.status) ORDER BY a.starts_at),'[]') INTO allocs FROM people_allocations a WHERE a.hiring_engagement_id=s.engagement_id AND a.workspace_id=w;
 END IF;
 RETURN jsonb_build_object(
  'status',CASE WHEN s.id IS NOT NULL THEN 'started' WHEN problem IS NULL THEN 'ready' ELSE 'blocked' END,
  'problem',problem,
  'manager_name',(SELECT full_name FROM profiles WHERE id=m),
  'can_start',s.id IS NULL AND problem IS NULL AND m=auth.uid() AND m<>r.created_by AND NOT is_read_only_view() AND hiring_execution_subject(w,auth.uid(),r.kind),
  'contract',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'status',c.status,'starts_at',c.starts_at,'ends_at',c.ends_at) END,
  'start',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'reason',s.reason,'revision',s.request_revision,'authorized_at',s.authorized_at,'authorized_by_name',(SELECT full_name FROM profiles WHERE id=s.authorized_by),'signature_intact',hiring_execution_activation_ok(w,s.contract_id)) END,
  'engagement',eng,'allocations',allocs,'revision',r.revision);
END $$;

CREATE OR REPLACE FUNCTION public.hiring_allocation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;co contracts;pc contracts;pr projects;enabled boolean;relevant boolean;BEGIN
 IF TG_OP='UPDATE' AND NEW.hiring_engagement_id IS DISTINCT FROM OLD.hiring_engagement_id THEN RAISE EXCEPTION 'A origem da alocação é imutável; conciliação histórica usa fluxo separado.';END IF;
 SELECT employment_gate_enabled INTO enabled FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id;
 relevant:=TG_OP='INSERT' OR (to_jsonb(NEW)-ARRAY['status','notes','updated_at','can_track_time']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['status','notes','updated_at','can_track_time']);
 IF NOT coalesce(enabled,false) AND NEW.hiring_engagement_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.hiring_engagement_id IS NULL AND NEW.hiring_engagement_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.status='ended' AND NOT relevant THEN RETURN NEW;END IF;
 IF NOT relevant AND NEW.status<>'active' THEN RETURN NEW;END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=NEW.hiring_engagement_id AND workspace_id=NEW.workspace_id FOR SHARE;
 IF e.id IS NULL OR e.person_id<>NEW.person_id OR e.status<>'active' THEN RAISE EXCEPTION 'Selecione um vínculo de contratação ativo da pessoa.';END IF;
 IF e.hiring_request_id IS NOT NULL THEN
  PERFORM public.hiring_execution_allocation_assert(NEW.workspace_id,e.id,NEW.id,NEW.project_id,NEW.contract_id,NEW.starts_at,NEW.ends_at,NEW.allocation_pct,NEW.period_override_reason,relevant);
  NEW.purchase_contract_id:=e.purchase_contract_id;RETURN NEW;
 END IF;
 IF e.purpose='client' AND e.commercial_contract_id IS DISTINCT FROM(SELECT hiring_contract_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=e.workspace_id) THEN RAISE EXCEPTION 'A origem comercial mudou; revise o vínculo.';END IF;
 IF public.hiring_recruitment_reason(e.workspace_id,e.job_id) IS NOT NULL THEN RAISE EXCEPTION '%',public.hiring_recruitment_reason(e.workspace_id,e.job_id);END IF;
 IF EXISTS(SELECT 1 FROM people WHERE id=e.person_id AND hire_date>NEW.starts_at) THEN RAISE EXCEPTION 'Alocação não pode iniciar antes da admissão efetiva da pessoa.';END IF;
 IF NEW.starts_at<e.starts_at OR(e.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>e.ends_at)) THEN RAISE EXCEPTION 'Alocação fora do período do vínculo.';END IF;
 IF e.purchase_contract_id IS NULL THEN RAISE EXCEPTION 'Vincule o contrato de compra/contratação antes de alocar.';END IF;
 SELECT * INTO pc FROM contracts WHERE id=e.purchase_contract_id AND workspace_id=e.workspace_id FOR SHARE;
 IF pc.role::text<>'client' OR pc.hiring_person_id IS DISTINCT FROM e.person_id OR pc.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR pc.status::text NOT IN('active','renewing') OR pc.starts_at IS NULL OR NEW.starts_at<pc.starts_at OR(pc.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>pc.ends_at)) THEN RAISE EXCEPTION 'Contrato de compra deve estar ativo, vinculado à pessoa e ao mesmo CNPJ WK, com vigência suficiente.';END IF;
 NEW.purchase_contract_id:=pc.id;
 IF e.purpose='client' THEN
  SELECT * INTO co FROM contracts WHERE id=e.commercial_contract_id AND workspace_id=e.workspace_id FOR SHARE;
  IF public.hiring_contract_signature_reason(co.id,e.workspace_id,co.deal_id) IS NOT NULL THEN RAISE EXCEPTION 'Contrato comercial sem assinatura válida.';END IF;
  IF co.contracting_legal_entity_id IS DISTINCT FROM pc.contracting_legal_entity_id OR NEW.contract_id IS DISTINCT FROM co.id THEN RAISE EXCEPTION 'Cliente e prestador devem usar o mesmo CNPJ WK e contrato comercial de origem.';END IF;
  IF NEW.starts_at<co.starts_at OR(co.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>co.ends_at)) THEN RAISE EXCEPTION 'Alocação fora da vigência do contrato comercial.';END IF;
 END IF;
 IF NEW.project_id IS NOT NULL AND EXISTS(SELECT 1 FROM projects x JOIN contracts c ON c.id=x.contract_id AND c.workspace_id=x.workspace_id WHERE x.id=NEW.project_id AND x.workspace_id=e.workspace_id AND c.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id) THEN RAISE EXCEPTION 'Entidade WK do projeto diverge do vínculo; exige análise explícita, sem trocar o empregador automaticamente.';END IF;
 IF NEW.project_id IS NOT NULL THEN SELECT * INTO pr FROM projects WHERE id=NEW.project_id AND workspace_id=e.workspace_id;IF pr.id IS NULL OR(e.purpose='client' AND(pr.contract_id IS DISTINCT FROM e.commercial_contract_id OR pr.deal_id IS DISTINCT FROM co.deal_id)) THEN RAISE EXCEPTION 'Projeto não corresponde ao contrato/negócio de origem.';END IF;END IF;
 IF relevant AND(NEW.starts_at IS DISTINCT FROM e.starts_at OR NEW.ends_at IS DISTINCT FROM e.ends_at) AND length(trim(coalesce(NEW.period_override_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o período diferente do vínculo (mínimo 10 caracteres).';END IF;
 RETURN NEW;
END $$;

-- Contract activation only through hiring_execution_start (replaces the package-3 hard block).
CREATE OR REPLACE FUNCTION public.hiring_formalization_origin_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;i uuid;
BEGIN
 i:=NEW.hiring_request_origin;
 IF TG_OP='UPDATE' AND NEW.hiring_request_origin IS DISTINCT FROM OLD.hiring_request_origin THEN RAISE EXCEPTION 'Origem de contratação imutável.';END IF;
 IF i IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE id=i AND workspace_id=NEW.workspace_id;
 IF r.id IS NULL OR (TG_OP='INSERT' AND (coalesce(current_setting('app.hiring_formalization_factory',true),'')<>i::text OR NOT hiring_formalization_access(NEW.workspace_id,i,'manage') OR NOT hiring_formalization_current(NEW.workspace_id,i))) THEN RAISE EXCEPTION 'Origem de contratação não autorizada.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='contracts' THEN
 IF NEW.role::text<>'client' OR NEW.deal_id IS NOT NULL OR NEW.proposal_id IS NOT NULL OR NEW.document_kind<>'main' OR NEW.hiring_person_id IS DISTINCT FROM r.person_id OR NEW.counterparty_company_id IS DISTINCT FROM r.company_id OR NEW.contracting_legal_entity_id IS DISTINCT FROM r.legal_entity_id THEN RAISE EXCEPTION 'Partes ou origem do instrumento incompatíveis.';END IF;
 IF NEW.status::text IN('active','renewing') AND (TG_OP='INSERT' OR (OLD.status::text NOT IN('active','renewing') AND ((to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) OR NOT public.hiring_execution_activation_ok(OLD.workspace_id,OLD.id)))) THEN RAISE EXCEPTION 'Ativação somente pela autorização de início governada, após assinatura íntegra.' USING ERRCODE='42501';END IF;
 ELSE
 IF NEW.deal_id IS NOT NULL OR NEW.proposal_id IS NOT NULL OR NEW.public_token IS NOT NULL OR NEW.status IN('approved','accepted','sent') THEN RAISE EXCEPTION 'Use o fluxo de formalização com aceite externo verificado; sem bypass interno.';END IF;
 END IF;RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.hiring_execution_manager(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_subject(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_problem(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_activation_ok(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_allocation_assert(uuid,uuid,uuid,uuid,uuid,date,date,numeric,text,boolean) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_start(uuid,uuid,integer,date,date,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_execution_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_allocation_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hiring_formalization_origin_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_execution_start(uuid,uuid,integer,date,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_execution_context(uuid,uuid) TO authenticated;

-- Preserve the canonical person panel and its record gates; direct engagements have no IAM model.
DO $direct_context$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.hiring_employment_context(uuid,uuid,uuid,text)'::regprocedure) INTO definition;
 IF strpos(definition,'JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE e.workspace_id=w')=0 THEN
  RAISE EXCEPTION 'Unexpected employment context; review direct-origin projection before migrating';
 END IF;
 definition:=replace(definition,'JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE e.workspace_id=w','LEFT JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE (e.hiring_request_id IS NOT NULL OR v.id IS NOT NULL) AND e.workspace_id=w');
 EXECUTE definition;
END $direct_context$;
