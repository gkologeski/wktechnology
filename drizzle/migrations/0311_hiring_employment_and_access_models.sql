-- Etapa 4: vínculos explícitos e modelos versionados; sem concessão retroativa.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.employment.view.workspace','techpeople','employment','view','workspace','Ver vínculos de contratação','Exige também escopo da pessoa ou candidatura.',true),
('techpeople.employment.manage.workspace','techpeople','employment','manage','workspace','Gerenciar vínculos de contratação','Admitir, vincular contrato e encerrar vínculo com origem.',true),
('system.hiring_access.view.workspace','system','hiring_access','view','workspace','Ver modelos de acesso de contratação','Configuração de cargo e versões de acesso.',true),
('system.hiring_access.manage.workspace','system','hiring_access','manage','workspace','Gerenciar modelos de acesso de contratação','Exige administrador ativo e gestão de cargos.',true)
ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.hiring_workspace_settings ADD COLUMN employment_gate_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.ats_jobs ADD COLUMN hiring_role_id uuid REFERENCES public.job_roles(id);
ALTER TABLE public.people ADD COLUMN hiring_legal_entity_id uuid REFERENCES public.legal_entities(id);
ALTER TABLE public.contracts ADD COLUMN hiring_person_id uuid REFERENCES public.people(id);
-- A nova FK é metadado de origem, sem alterar a versão jurídica já assinada.
CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
 'contract',to_jsonb(c)-ARRAY['hiring_person_id','status','updated_at','created_at','owner_id','assigned_to','public_token','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','import_confidence','imported_from'],
 'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=c.workspace_id),
 'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s)-ARRAY['updated_at','created_at','owner_id','assigned_to','delivery_owner_id','next_billing_at','metadata'] ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'))::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
CREATE TABLE public.hiring_access_models(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),role_id uuid REFERENCES public.job_roles(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 160),revision integer NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT false,
 allocation_only boolean NOT NULL DEFAULT true,permission_keys text[] NOT NULL DEFAULT '{}',updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,name)
);
CREATE TABLE public.hiring_access_model_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),model_id uuid NOT NULL REFERENCES public.hiring_access_models(id),workspace_id uuid NOT NULL,revision integer NOT NULL,role_id uuid,name text NOT NULL,allocation_only boolean NOT NULL,permission_keys text[] NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(model_id,revision));
CREATE TABLE public.hiring_engagements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),person_id uuid NOT NULL REFERENCES public.people(id),application_id uuid UNIQUE REFERENCES public.ats_applications(id),job_id uuid NOT NULL REFERENCES public.ats_jobs(id),
 purpose text NOT NULL CHECK(purpose IN('client','internal','shared_management')),employment_type public.people_employment_type NOT NULL,
 legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id),commercial_contract_id uuid REFERENCES public.contracts(id),purchase_contract_id uuid REFERENCES public.contracts(id),model_version_id uuid NOT NULL REFERENCES public.hiring_access_model_versions(id),
 starts_at date NOT NULL,ends_at date,status text NOT NULL DEFAULT 'active' CHECK(status IN('active','ended')),revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),ended_by uuid,ended_at timestamptz,end_reason text, CHECK(ends_at IS NULL OR ends_at>=starts_at)
);
CREATE TABLE public.hiring_employment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,engagement_id uuid NOT NULL REFERENCES public.hiring_engagements(id),actor_id uuid NOT NULL,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.people_allocations ADD COLUMN hiring_engagement_id uuid REFERENCES public.hiring_engagements(id),ADD COLUMN period_override_reason text;
ALTER TABLE public.workspace_invites ADD COLUMN hiring_engagement_id uuid REFERENCES public.hiring_engagements(id);
CREATE UNIQUE INDEX hiring_pending_invite ON public.workspace_invites(hiring_engagement_id) WHERE hiring_engagement_id IS NOT NULL AND accepted_at IS NULL;
CREATE TABLE public.hiring_access_grants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,engagement_id uuid NOT NULL REFERENCES public.hiring_engagements(id),user_id uuid NOT NULL REFERENCES public.profiles(id),set_id uuid NOT NULL UNIQUE REFERENCES public.permission_sets(id),assignment_id uuid UNIQUE REFERENCES public.user_permission_sets(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz);
CREATE UNIQUE INDEX hiring_engagement_active_grant ON public.hiring_access_grants(engagement_id) WHERE revoked_at IS NULL;
CREATE INDEX hiring_engagement_person ON public.hiring_engagements(workspace_id,person_id,status);
CREATE INDEX hiring_grants_actor ON public.hiring_access_grants(user_id,workspace_id) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.hiring_employment_access(w uuid,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) AND public.is_workspace_member(w,auth.uid())
 AND public.user_has_permission(auth.uid(),w,k) AND (k IN('techpeople.employment.view.workspace','system.hiring_access.view.workspace') OR NOT public.is_read_only_view()),false)
$$;
REVOKE ALL ON FUNCTION public.hiring_employment_access(uuid,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.hiring_employment_access(uuid,text) TO authenticated;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['hiring_access_models','hiring_access_model_versions','hiring_engagements','hiring_employment_events','hiring_access_grants'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;END $$;
CREATE POLICY hiring_models_read ON public.hiring_access_models FOR SELECT TO authenticated USING(public.hiring_employment_access(workspace_id,'system.hiring_access.view.workspace'));
CREATE POLICY hiring_model_versions_read ON public.hiring_access_model_versions FOR SELECT TO authenticated USING(public.hiring_employment_access(workspace_id,'system.hiring_access.view.workspace'));
CREATE POLICY hiring_engagement_read ON public.hiring_engagements FOR SELECT TO authenticated USING(public.hiring_employment_access(workspace_id,'techpeople.employment.view.workspace') AND public.hr_record_access('people','view',person_id));
CREATE POLICY hiring_employment_event_read ON public.hiring_employment_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.hiring_engagements e WHERE e.id=engagement_id AND e.workspace_id=hiring_employment_events.workspace_id));
CREATE POLICY hiring_grant_read ON public.hiring_access_grants FOR SELECT TO authenticated USING(public.hiring_employment_access(workspace_id,'system.hiring_access.view.workspace'));

CREATE OR REPLACE FUNCTION public.hiring_model_save(w uuid,p_id uuid,p_revision integer,p_role uuid,p_name text,p_keys text[],p_allocation boolean,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.hiring_access_models;r uuid;BEGIN
 IF NOT public.hiring_employment_access(w,'system.hiring_access.manage.workspace') OR NOT public.is_workspace_admin_v2(w,auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'system.roles.manage.workspace') THEN RAISE EXCEPTION 'Somente administrador autorizado pode alterar modelos.' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 160 OR cardinality(p_keys)>300 OR p_keys IS NULL OR EXISTS(SELECT 1 FROM unnest(p_keys) k WHERE NOT EXISTS(SELECT 1 FROM permissions WHERE key=k)) THEN RAISE EXCEPTION 'Modelo ou permissões inválidos.';END IF;
 IF cardinality(p_keys)<>(SELECT count(DISTINCT k) FROM unnest(p_keys)k) THEN RAISE EXCEPTION 'Não repita permissões no modelo.';END IF;
 IF p_role IS NOT NULL AND NOT EXISTS(SELECT 1 FROM job_roles WHERE id=p_role AND (workspace_id=w OR workspace_id IS NULL)) THEN RAISE EXCEPTION 'Cargo fora do workspace.';END IF;
 IF p_active AND(p_role IS NULL OR cardinality(p_keys)=0) THEN RAISE EXCEPTION 'Escolha o cargo e revise as permissões antes de ativar.';END IF;
 IF p_allocation AND EXISTS(SELECT 1 FROM unnest(p_keys) k WHERE k NOT IN('techprojects.projects.view.workspace','techprojects.tasks.view.workspace','techprojects.time_entries.view.own','techprojects.time_entries.create.own','techprojects.time_entries.update.own','techprojects.time_entries.delete.own','techprojects.timesheet.view.own','techprojects.timesheet.create.own','techprojects.timesheet.update.own','techpeople.people.view.own','techpeople.people.update.own')) THEN RAISE EXCEPTION 'Modelo por alocação aceita somente dados próprios, horas próprias e leitura de projetos/tarefas alocados.';END IF;
 IF p_id IS NULL THEN INSERT INTO hiring_access_models(workspace_id,role_id,name,permission_keys,allocation_only,active,updated_by) VALUES(w,p_role,trim(p_name),p_keys,p_allocation,p_active,auth.uid()) RETURNING id INTO r;
 ELSE SELECT * INTO m FROM hiring_access_models WHERE id=p_id AND workspace_id=w FOR UPDATE;IF m.id IS NULL OR m.revision<>p_revision THEN RAISE EXCEPTION 'Modelo alterado. Recarregue.';END IF;
 UPDATE hiring_access_models SET role_id=p_role,name=trim(p_name),permission_keys=p_keys,allocation_only=p_allocation,active=p_active,revision=revision+1,updated_by=auth.uid(),updated_at=now() WHERE id=m.id RETURNING id INTO r;END IF;
 INSERT INTO hiring_access_model_versions(model_id,workspace_id,revision,role_id,name,allocation_only,permission_keys,created_by) SELECT id,workspace_id,revision,role_id,name,allocation_only,permission_keys,auth.uid() FROM hiring_access_models WHERE id=r;RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_model_context(w uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.hiring_employment_access(w,'system.hiring_access.view.workspace') THEN RAISE EXCEPTION 'Sem permissão para modelos.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM legal_entities WHERE workspace_id=w AND active),'[]'),'models',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.name) FROM hiring_access_models m WHERE workspace_id=w),'[]'),
 'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM job_roles WHERE workspace_id=w OR workspace_id IS NULL),'[]'),
 'permissions',coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'label',label_pt) ORDER BY key) FROM permissions),'[]'));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_admit(w uuid,p_application uuid,p_person uuid,p_model uuid,p_entity uuid,p_start date,p_end date,p_reason text,p_employment text,p_hire_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.ats_applications;j public.ats_jobs;c public.ats_candidates;pe public.people;m public.hiring_access_models;co public.contracts;r uuid;v uuid;pid uuid;d date;ed date;matches integer;hd date;BEGIN
 IF NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('applications','view',p_application) OR NOT public.hr_record_access('application_hiring','update',p_application) THEN RAISE EXCEPTION 'Sem permissão para admitir esta candidatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM ats_applications WHERE id=p_application AND workspace_id=w FOR UPDATE;IF a.id IS NULL THEN RAISE EXCEPTION 'Candidatura indisponível.';END IF;
 SELECT * INTO j FROM ats_jobs WHERE id=a.job_id AND workspace_id=w FOR UPDATE;
 IF NOT j.hiring_governed OR NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND employment_gate_enabled) THEN RAISE EXCEPTION 'Salve a demanda no fluxo governado antes de admitir por esta ação.';END IF;
 IF public.hiring_recruitment_reason(w,j.id) IS NOT NULL THEN RAISE EXCEPTION '%',public.hiring_recruitment_reason(w,j.id);END IF;
 IF p_employment IS DISTINCT FROM (CASE j.employment_type WHEN 'clt' THEN 'clt' WHEN 'pj' THEN 'pj' WHEN 'contract' THEN 'contractor' WHEN 'internship' THEN 'intern' WHEN 'temporary' THEN 'other' END) THEN RAISE EXCEPTION 'Regime deve corresponder à demanda aprovada; altere e aprove novamente a demanda.';END IF;
 IF a.status<>'hired' THEN RAISE EXCEPTION 'Registre primeiro o desfecho de contratação da candidatura.';END IF;
 IF a.hiring_details->>'model'='hunting' OR coalesce((public.hiring_workflow_recruitment_check(w,a.id)->>'hunting')::boolean,false) OR EXISTS(SELECT 1 FROM deal_role_profiles WHERE ats_job_id=j.id AND modality='hunting') THEN RAISE EXCEPTION 'Hunting registra contratação pelo cliente, sem admissão WK.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring-person:'||w::text||':'||a.candidate_id::text,0));
 SELECT id INTO r FROM hiring_engagements WHERE application_id=a.id AND workspace_id=w;IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO m FROM hiring_access_models WHERE id=p_model AND workspace_id=w AND active FOR SHARE;IF m.id IS NULL OR m.role_id IS NULL THEN RAISE EXCEPTION 'Selecione modelo de acesso ativo e revisado para o cargo.';END IF;
 IF j.hiring_role_id IS NULL OR j.hiring_role_id IS DISTINCT FROM m.role_id THEN RAISE EXCEPTION 'Modelo deve corresponder ao cargo da demanda aprovada. Defina o cargo na demanda e obtenha nova aprovação.';END IF;
 SELECT id INTO v FROM hiring_access_model_versions WHERE model_id=m.id AND revision=m.revision AND workspace_id=w;IF v IS NULL THEN RAISE EXCEPTION 'Versão de acesso não encontrada.';END IF;
 IF NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=p_entity AND workspace_id=w AND active AND nullif(trim(cnpj),'') IS NOT NULL) THEN RAISE EXCEPTION 'Selecione uma entidade WK ativa com CNPJ.';END IF;
 IF j.hiring_purpose='client' THEN SELECT * INTO co FROM contracts WHERE id=j.hiring_contract_id AND workspace_id=w FOR SHARE;IF co.contracting_legal_entity_id IS DISTINCT FROM p_entity THEN RAISE EXCEPTION 'A entidade WK deve ser a mesma do contrato comercial.';END IF;END IF;
 d:=coalesce(p_start,co.starts_at,CASE WHEN j.hiring_purpose<>'client' THEN nullif(a.hiring_details->>'start_date','')::date END);ed:=coalesce(p_end,co.ends_at);
 IF d IS NULL OR(ed IS NOT NULL AND ed<d) THEN RAISE EXCEPTION 'Informe período válido.';END IF;
 IF j.hiring_purpose='client' AND (d<co.starts_at OR (co.ends_at IS NOT NULL AND (ed IS NULL OR ed>co.ends_at))) THEN RAISE EXCEPTION 'Período fora da vigência comercial. Ajuste o contrato e obtenha nova aprovação.';END IF;
 IF j.hiring_purpose='client' AND (d IS DISTINCT FROM co.starts_at OR ed IS DISTINCT FROM co.ends_at) AND length(trim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique a alteração do período herdado (mínimo 10 caracteres).';END IF;
 SELECT * INTO c FROM ats_candidates WHERE id=a.candidate_id AND workspace_id=w;IF c.id IS NULL THEN RAISE EXCEPTION 'Candidato fora do workspace.';END IF;
 IF p_person IS NULL THEN SELECT count(*) INTO matches FROM people WHERE candidate_id=c.id AND workspace_id=w AND NOT archived;IF matches>1 THEN RAISE EXCEPTION 'Há mais de uma pessoa vinculada ao candidato. Escolha explicitamente o cadastro correto.';END IF;SELECT * INTO pe FROM people WHERE candidate_id=c.id AND workspace_id=w AND NOT archived;ELSE SELECT * INTO pe FROM people WHERE id=p_person AND workspace_id=w AND NOT archived FOR UPDATE;IF pe.id IS NULL OR NOT public.hr_record_access('people','update',pe.id) THEN RAISE EXCEPTION 'Pessoa existente indisponível.' USING ERRCODE='42501';END IF;END IF;
 PERFORM set_config('app.hiring_admit','on',true);
 IF pe.id IS NOT NULL THEN
  IF NOT public.hr_record_access('people','update',pe.id) THEN RAISE EXCEPTION 'Sem permissão para reutilizar pessoa.' USING ERRCODE='42501';END IF;
  IF pe.hiring_legal_entity_id IS NOT NULL AND pe.hiring_legal_entity_id<>p_entity THEN RAISE EXCEPTION 'Pessoa possui outro empregador/contratante WK; faça análise explícita antes de mudar a entidade.';END IF;
  IF pe.employment_type::text IS DISTINCT FROM p_employment THEN RAISE EXCEPTION 'Regime da pessoa existente difere da demanda aprovada.';END IF;
  IF pe.status::text<>'active' THEN RAISE EXCEPTION 'Reative a pessoa explicitamente antes de reutilizar o vínculo.';END IF;
  pid:=pe.id;UPDATE people SET hiring_legal_entity_id=p_entity WHERE id=pid AND hiring_legal_entity_id IS NULL;
 ELSE
  IF NOT(public.user_has_permission(auth.uid(),w,'techpeople.people.create.workspace') OR public.user_has_permission(auth.uid(),w,'techpeople.people.create.own')) THEN RAISE EXCEPTION 'Sem permissão para criar pessoa.' USING ERRCODE='42501';END IF;
  IF p_employment NOT IN('pj','clt','contractor','intern','other') THEN RAISE EXCEPTION 'Vínculo profissional inválido.';END IF;
  hd:=coalesce(p_hire_date,nullif(a.hiring_details->>'start_date','')::date);IF hd IS NULL THEN RAISE EXCEPTION 'Informe a data efetiva de admissão da nova pessoa, separada da vigência comercial.';END IF;
  INSERT INTO people(workspace_id,owner_id,assigned_to,created_by,candidate_id,full_name,email,phone,location,employment_type,status,role_title,hire_date,hiring_legal_entity_id)
  VALUES(w,w,auth.uid(),auth.uid(),c.id,c.full_name,c.email,c.phone,c.location,p_employment::people_employment_type,'active',j.title,hd,p_entity) RETURNING id INTO pid;
 END IF;
 PERFORM set_config('app.hiring_admit','off',true);
 INSERT INTO hiring_engagements(workspace_id,person_id,application_id,job_id,purpose,employment_type,legal_entity_id,commercial_contract_id,model_version_id,starts_at,ends_at,created_by)
 VALUES(w,pid,a.id,j.id,j.hiring_purpose,coalesce(pe.employment_type,p_employment::people_employment_type),p_entity,CASE WHEN j.hiring_purpose='client' THEN j.hiring_contract_id END,v,d,ed,auth.uid()) RETURNING id INTO r;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,r,auth.uid(),'admitted',jsonb_build_object('existing_person',pe.id IS NOT NULL,'hire_date',coalesce(pe.hire_date,hd),'period_reason',nullif(trim(p_reason),''),'model_version',v,'entity',p_entity,'job_revision',j.hiring_revision));RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_contract(w uuid,p_engagement uuid,p_contract uuid,p_options jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;c public.contracts;pe public.people;r uuid;monthly numeric;document_body text;document_title text;template_id uuid;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.user_has_permission(auth.uid(),w,'techcontracts.contracts.create.workspace') THEN RAISE EXCEPTION 'Sem permissão para contrato do vínculo.' USING ERRCODE='42501';END IF;
 IF e.purpose='client' AND e.commercial_contract_id IS DISTINCT FROM(SELECT hiring_contract_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=w) THEN RAISE EXCEPTION 'A origem comercial mudou; revise o vínculo antes de novas operações.';END IF;
 IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL THEN RAISE EXCEPTION '%',public.hiring_recruitment_reason(w,e.job_id);END IF;
 IF e.purchase_contract_id IS NOT NULL THEN RETURN e.purchase_contract_id;END IF;
 SELECT * INTO pe FROM people WHERE id=e.person_id AND workspace_id=w;
 PERFORM set_config('app.hiring_purchase','on',true);
 IF p_contract IS NOT NULL THEN
  SELECT * INTO c FROM contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
  IF c.id IS NULL OR NOT public.work_record_access('techcontracts.contracts',c.id,'update') OR c.role::text<>'client' OR c.document_kind<>'main' OR c.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR(c.hiring_person_id IS NOT NULL AND c.hiring_person_id<>pe.id) THEN RAISE EXCEPTION 'Contrato de compra incompatível com pessoa ou entidade WK.';END IF;
  IF c.counterparty_company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=w AND nullif(regexp_replace(to_jsonb(x)->>'cnpj','[^0-9]','','g'),'')=nullif(regexp_replace(pe.cnpj,'[^0-9]','','g'),'')) THEN RAISE EXCEPTION 'CNPJ do prestador não corresponde à contraparte do contrato de compra.';END IF;
  UPDATE contracts SET hiring_person_id=pe.id WHERE id=c.id; r:=c.id;
 ELSE
  IF coalesce(p_options->>'status','draft')<>'draft' THEN RAISE EXCEPTION 'O contrato de contratação nasce em rascunho. Ativação e assinatura usam o fluxo contratual.';END IF;
  monthly:=nullif(p_options->>'monthly_value','')::numeric;IF monthly<0 THEN RAISE EXCEPTION 'Valor mensal inválido.';END IF;
  -- A permissão de criação e os gatilhos shared_field_write_guard existentes protegem os valores configurados do contrato.

  template_id:=nullif(p_options->>'template_id','')::uuid;
  IF template_id IS NOT NULL AND NOT public.work_record_access('techcontracts.contract_templates',template_id,'view') THEN RAISE EXCEPTION 'Modelo contratual indisponível.' USING ERRCODE='42501';END IF;
  document_body:=nullif(p_options->>'body_html','');IF template_id IS NOT NULL AND document_body IS NULL THEN RAISE EXCEPTION 'Renderize o modelo contratual antes de preparar o documento.';END IF;
  document_title:=coalesce(nullif(trim(p_options->>'title'),''),'Compra — '||pe.full_name);
  INSERT INTO contracts(workspace_id,owner_id,assigned_to,role,document_kind,title,status,starts_at,ends_at,contracting_legal_entity_id,hiring_person_id,body_html,monthly_value,metadata)
  VALUES(w,w,auth.uid(),'client','main',left(document_title,255),'draft',e.starts_at,e.ends_at,e.legal_entity_id,pe.id,document_body,monthly,jsonb_build_object('person_id',pe.id,'hiring_engagement_id',e.id,'source','hiring_stage4')) RETURNING id INTO r;
 END IF;
 PERFORM set_config('app.hiring_purchase','off',true);
 UPDATE hiring_engagements SET purchase_contract_id=r,revision=revision+1 WHERE id=e.id;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'purchase_contract_linked',jsonb_build_object('contract_id',r,'existing',p_contract IS NOT NULL));RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_end(w uuid,p_engagement uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) THEN RAISE EXCEPTION 'Sem permissão para encerrar vínculo.' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Informe motivo do encerramento.';END IF;
 IF e.status='ended' THEN RETURN;END IF;
 UPDATE people_allocations SET status='ended',can_track_time=false WHERE hiring_engagement_id=e.id;
 DELETE FROM user_permission_sets ups USING hiring_access_grants g WHERE g.engagement_id=e.id AND ups.id=g.assignment_id AND ups.user_id=g.user_id AND ups.set_id=g.set_id AND ups.workspace_id=w;
 UPDATE hiring_access_grants SET revoked_at=now() WHERE engagement_id=e.id AND revoked_at IS NULL;
 UPDATE workspace_invites SET expires_at=least(expires_at,now()) WHERE hiring_engagement_id=e.id AND accepted_at IS NULL;
 UPDATE hiring_engagements SET status='ended',ended_at=now(),ended_by=auth.uid(),end_reason=trim(p_reason),revision=revision+1 WHERE id=e.id;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'ended',jsonb_build_object('reason',trim(p_reason)));
 -- Não desativa pessoa, membership, contratos ou concessões de outras origens.
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_context(w uuid,p_person uuid,p_candidate uuid DEFAULT NULL,p_search text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.hiring_employment_access(w,'techpeople.employment.view.workspace') OR (p_person IS NOT NULL AND NOT public.hr_record_access('people','view',p_person)) OR(p_candidate IS NOT NULL AND NOT public.hr_record_access('candidates','view',p_candidate)) OR(p_person IS NULL AND p_candidate IS NULL) THEN RAISE EXCEPTION 'Sem permissão para vínculos.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('engagements',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('person_name',pe.full_name,'model_name',v.name,'allocation_only',v.allocation_only,'invite_pending',EXISTS(SELECT 1 FROM workspace_invites i WHERE i.hiring_engagement_id=e.id AND i.accepted_at IS NULL AND i.expires_at>now()))) FROM hiring_engagements e JOIN people pe ON pe.id=e.person_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE e.workspace_id=w AND(e.person_id=p_person OR (p_candidate IS NOT NULL AND EXISTS(SELECT 1 FROM ats_applications a WHERE a.id=e.application_id AND a.candidate_id=p_candidate))) AND public.hr_record_access('people','view',e.person_id)),'[]'),
 'models',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM hiring_access_models WHERE workspace_id=w AND active),'[]'),
 'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM legal_entities WHERE workspace_id=w AND active),'[]'),
 'applications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'job_id',j.id,'title',j.title,'status',a.status,'purpose',j.hiring_purpose,'employment',j.employment_type,'hire_date',a.hiring_details->>'start_date','entity_id',c.contracting_legal_entity_id,'starts_at',c.starts_at,'ends_at',c.ends_at,'reason',public.hiring_recruitment_reason(w,j.id))) FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id LEFT JOIN contracts c ON c.id=j.hiring_contract_id AND c.workspace_id=w WHERE a.workspace_id=w AND a.candidate_id=p_candidate AND public.hr_record_access('applications','view',a.id)),'[]'),
 'contracts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title)) FROM (SELECT id,title FROM contracts WHERE workspace_id=w AND role='client' AND document_kind='main' AND title ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.work_record_access('techcontracts.contracts',id,'view') ORDER BY title,id LIMIT 50)x),'[]'),
 'projects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM (SELECT id,name FROM projects WHERE workspace_id=w AND name ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.work_record_access('techprojects.projects',id,'view') ORDER BY name,id LIMIT 50)x),'[]'),
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name)) FROM (SELECT id,full_name FROM people WHERE p_candidate IS NOT NULL AND workspace_id=w AND NOT archived AND full_name ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.hr_record_access('people','update',id) ORDER BY full_name,id LIMIT 50)x),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.hiring_model_save(uuid,uuid,integer,uuid,text,text[],boolean,boolean),public.hiring_model_context(uuid),public.hiring_employment_admit(uuid,uuid,uuid,uuid,uuid,date,date,text,text,date),public.hiring_employment_contract(uuid,uuid,uuid,jsonb),public.hiring_employment_end(uuid,uuid,text),public.hiring_employment_context(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_model_save(uuid,uuid,integer,uuid,text,text[],boolean,boolean),public.hiring_model_context(uuid),public.hiring_employment_admit(uuid,uuid,uuid,uuid,uuid,date,date,text,text,date),public.hiring_employment_contract(uuid,uuid,uuid,jsonb),public.hiring_employment_end(uuid,uuid,text),public.hiring_employment_context(uuid,uuid,uuid,text) TO authenticated;
