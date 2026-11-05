-- Etapa 2: finalidade e alçadas. Não admite pessoas, não concede acesso e não fatura.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techhire.hiring_demands.view.workspace','techhire','hiring_demands','view','workspace','Ver demandas e aprovações','Exige também acesso à vaga.',true),
('techhire.hiring_demands.update.workspace','techhire','hiring_demands','update','workspace','Editar demandas de contratação','Alterar dados invalida a aprovação anterior.',true),
('techhire.hiring_demands.create.workspace','techhire','hiring_demands','create','workspace','Solicitar aprovação da demanda','Encaminhar ao gestor e CEO configurados.',true),
('techhire.hiring_demands.approve.workspace','techhire','hiring_demands','approve','workspace','Decidir aprovação da demanda','Somente aprovador nomeado, nunca solicitante.',true),
('techhire.hiring_policies.manage.workspace','techhire','hiring_policies','manage','workspace','Configurar alçadas de contratação','Administrador ativo configura gestores e CEO por área.',true)
ON CONFLICT(key) DO NOTHING;

ALTER TABLE public.service_catalog ADD COLUMN staffing_kind text CHECK(staffing_kind IN('none','hunting','outsourcing','squad'));
ALTER TABLE public.ats_jobs
 ADD COLUMN hiring_governed boolean NOT NULL DEFAULT false,
 ADD COLUMN hiring_purpose text CHECK(hiring_purpose IN('client','internal','shared_management')),
 ADD COLUMN hiring_area_id uuid REFERENCES public.user_groups(id),
 ADD COLUMN hiring_billing_model text CHECK(hiring_billing_model IN('not_applicable','per_hour','fixed_recurring','package','milestone','success_fixed','success_percent','headcount_month')),
 ADD COLUMN hiring_revision integer NOT NULL DEFAULT 1,
 ADD COLUMN hiring_approval_status text NOT NULL DEFAULT 'not_requested' CHECK(hiring_approval_status IN('not_requested','pending','approved','rejected'));
-- Opt-in por workspace; ausência de alçada não autoriza demanda de workspace ativado.
CREATE TABLE public.hiring_workspace_settings(workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id),enabled boolean NOT NULL DEFAULT false,updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.hiring_workspace_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_workspace_settings FROM PUBLIC,anon,authenticated;
CREATE TABLE public.hiring_policy_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,area_id uuid NOT NULL,revision integer NOT NULL,actor_id uuid NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.hiring_policy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_policy_versions FROM PUBLIC,anon,authenticated;

CREATE TABLE public.hiring_area_policies(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 area_id uuid PRIMARY KEY REFERENCES public.user_groups(id),
 manager_id uuid NOT NULL,ceo_id uuid NOT NULL,
 manager_delegate_id uuid,ceo_delegate_id uuid,
 revision integer NOT NULL DEFAULT 1,
 updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hiring_demand_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 job_id uuid NOT NULL REFERENCES public.ats_jobs(id),revision integer NOT NULL,
 requested_by uuid NOT NULL,policy_revision integer NOT NULL,
 status text NOT NULL CHECK(status IN('pending','approved','rejected','superseded')),
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(job_id,revision)
);
CREATE TABLE public.hiring_demand_steps(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.hiring_demand_requests(id),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),stage text NOT NULL CHECK(stage IN('manager','ceo')),
 position integer NOT NULL,approver_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 decided_by uuid,decided_at timestamptz,note text,UNIQUE(request_id,stage)
);
CREATE TABLE public.hiring_demand_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 job_id uuid NOT NULL REFERENCES public.ats_jobs(id),request_id uuid REFERENCES public.hiring_demand_requests(id),
 actor_id uuid NOT NULL,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hiring_requests_workspace_job ON public.hiring_demand_requests(workspace_id,job_id,created_at DESC);
CREATE INDEX hiring_steps_request ON public.hiring_demand_steps(request_id,position);
CREATE INDEX hiring_events_job ON public.hiring_demand_events(workspace_id,job_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.hiring_stage2_access(p_ws uuid,p_action text,p_job uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();k text;
BEGIN
 IF u IS NULL OR NOT public.is_workspace_member(p_ws,u)
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=u AND status='active')
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u AND active_workspace_id=p_ws) THEN RETURN false;END IF;
 IF p_action NOT IN('view','update','request','approve','manage') THEN RETURN false;END IF;
 k:=CASE WHEN p_action='manage' THEN 'techhire.hiring_policies.manage.workspace' ELSE 'techhire.hiring_demands.'||CASE WHEN p_action='request' THEN 'create' ELSE p_action END||'.workspace' END;
 IF NOT public.user_has_permission(u,p_ws,k) THEN RETURN false;END IF;
 IF p_action<>'view' AND public.is_read_only_view() THEN RETURN false;END IF;
 IF p_action='manage' THEN RETURN EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=u AND status='active' AND role IN('owner','admin'));END IF;
 IF p_job IS NULL OR NOT EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws) THEN RETURN false;END IF;
 RETURN public.hr_record_access('jobs',CASE WHEN p_action IN('update','request') THEN 'update' ELSE 'view' END,p_job);
END $$;
REVOKE ALL ON FUNCTION public.hiring_stage2_access(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_stage2_access(uuid,text,uuid) TO authenticated;

ALTER TABLE public.hiring_area_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_demand_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_demand_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_demand_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_area_policies,public.hiring_demand_requests,public.hiring_demand_steps,public.hiring_demand_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hiring_area_policies,public.hiring_demand_requests,public.hiring_demand_steps,public.hiring_demand_events TO authenticated;
CREATE POLICY hiring_policy_read ON public.hiring_area_policies FOR SELECT TO authenticated USING(public.hiring_stage2_access(workspace_id,'manage'));
CREATE POLICY hiring_request_read ON public.hiring_demand_requests FOR SELECT TO authenticated USING(public.hiring_stage2_access(workspace_id,'view',job_id));
CREATE POLICY hiring_step_read ON public.hiring_demand_steps FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.hiring_demand_requests r WHERE r.id=request_id AND r.workspace_id=hiring_demand_steps.workspace_id AND public.hiring_stage2_access(r.workspace_id,'view',r.job_id)));
CREATE POLICY hiring_event_read ON public.hiring_demand_events FOR SELECT TO authenticated USING(public.hiring_stage2_access(workspace_id,'view',job_id));

CREATE OR REPLACE FUNCTION public.hiring_area_policy_save(p_ws uuid,p_area uuid,p_manager uuid,p_ceo uuid,p_manager_delegate uuid DEFAULT NULL,p_ceo_delegate uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'manage') THEN RAISE EXCEPTION 'Sem permissão para configurar alçadas.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_groups WHERE id=p_area AND workspace_id=p_ws) THEN RAISE EXCEPTION 'Área fora do workspace.';END IF;
 IF p_manager IS NULL OR p_ceo IS NULL THEN RAISE EXCEPTION 'Defina gestor e CEO.';END IF;
 FOREACH u IN ARRAY ARRAY[p_manager,p_ceo,p_manager_delegate,p_ceo_delegate] LOOP
  IF u IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=u AND status='active') THEN RAISE EXCEPTION 'Aprovador não é membro ativo desta empresa.';END IF;
 END LOOP;
 PERFORM id FROM public.ats_jobs WHERE workspace_id=p_ws AND hiring_area_id=p_area ORDER BY id FOR UPDATE;
 INSERT INTO public.hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,ceo_delegate_id,updated_by)
 VALUES(p_ws,p_area,p_manager,p_ceo,p_manager_delegate,p_ceo_delegate,auth.uid())
 ON CONFLICT(area_id) DO UPDATE SET manager_id=excluded.manager_id,ceo_id=excluded.ceo_id,manager_delegate_id=excluded.manager_delegate_id,ceo_delegate_id=excluded.ceo_delegate_id,revision=hiring_area_policies.revision+1,updated_by=auth.uid(),updated_at=now();
 INSERT INTO public.hiring_policy_versions(workspace_id,area_id,revision,actor_id,snapshot) SELECT p_ws,p_area,revision,auth.uid(),to_jsonb(x) FROM public.hiring_area_policies x WHERE area_id=p_area;
 INSERT INTO public.hiring_workspace_settings(workspace_id,enabled,updated_by) VALUES(p_ws,true,auth.uid()) ON CONFLICT(workspace_id) DO UPDATE SET enabled=true,updated_by=auth.uid(),updated_at=now();
 -- A política é versionada: pedidos pendentes anteriores não podem usar alçada revogada.
 UPDATE public.hiring_demand_requests SET status='superseded' WHERE workspace_id=p_ws AND status IN('pending','approved') AND job_id IN(SELECT id FROM public.ats_jobs WHERE hiring_area_id=p_area);
 PERFORM set_config('app.hiring_stage2','on',true);
 UPDATE public.ats_jobs SET hiring_approval_status='not_requested',hiring_revision=hiring_revision+1,status=CASE WHEN hiring_governed AND status='published' THEN 'on_hold' ELSE status END WHERE workspace_id=p_ws AND hiring_area_id=p_area;
 PERFORM set_config('app.hiring_stage2','off',true);
END $$;

CREATE OR REPLACE FUNCTION public.hiring_demand_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE changed boolean;trusted boolean:=coalesce(current_setting('app.hiring_stage2',true),'')='on';
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.hiring_governed:=EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND enabled);NEW.hiring_revision:=1;NEW.hiring_approval_status:='not_requested';
 ELSE
  IF NEW.hiring_governed IS DISTINCT FROM OLD.hiring_governed AND NOT trusted THEN RAISE EXCEPTION 'Use o fluxo da demanda.' USING ERRCODE='42501';END IF;
  IF NOT trusted AND (NEW.hiring_revision IS DISTINCT FROM OLD.hiring_revision OR NEW.hiring_approval_status IS DISTINCT FROM OLD.hiring_approval_status) THEN RAISE EXCEPTION 'Use a decisão de aprovação da demanda.' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='UPDATE' AND NOT trusted AND (NEW.hiring_purpose IS DISTINCT FROM OLD.hiring_purpose OR NEW.hiring_area_id IS DISTINCT FROM OLD.hiring_area_id OR NEW.hiring_billing_model IS DISTINCT FROM OLD.hiring_billing_model) AND NOT public.hiring_stage2_access(NEW.workspace_id,'update',NEW.id) THEN RAISE EXCEPTION 'Sem permissão para editar demanda.' USING ERRCODE='42501';END IF;
 IF NEW.hiring_purpose IS NOT NULL AND ((NEW.hiring_purpose='client' AND NEW.hiring_billing_model='not_applicable') OR (NEW.hiring_purpose<>'client' AND NEW.hiring_billing_model IS DISTINCT FROM 'not_applicable')) THEN RAISE EXCEPTION 'Cobrança não corresponde à finalidade.';END IF;
 IF NEW.hiring_area_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_groups WHERE id=NEW.hiring_area_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Área fora do workspace.';END IF;
 IF NEW.hiring_purpose='client' AND (NEW.deal_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.deals WHERE id=NEW.deal_id AND workspace_id=NEW.workspace_id AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'Demanda de cliente exige negócio da mesma empresa.';END IF;
 IF NEW.hiring_purpose IN('internal','shared_management') AND NEW.deal_id IS NOT NULL THEN RAISE EXCEPTION 'Demanda interna ou compartilhada não usa negócio.';END IF;
 IF TG_OP='UPDATE' THEN
  changed:=(to_jsonb(NEW)-ARRAY['updated_at','hiring_revision','hiring_approval_status','status','opened_at','filled_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','hiring_revision','hiring_approval_status','status','opened_at','filled_at']);
  IF changed THEN
   NEW.hiring_revision:=OLD.hiring_revision+1;NEW.hiring_approval_status:='not_requested';
   UPDATE public.hiring_demand_requests SET status='superseded' WHERE job_id=NEW.id AND status IN('pending','approved');
   IF NEW.status='published' AND NEW.hiring_governed THEN NEW.status:='on_hold';END IF;
  END IF;
 END IF;
 IF NEW.hiring_governed AND NEW.status='published' AND NEW.hiring_approval_status<>'approved' THEN RAISE EXCEPTION 'A demanda precisa de aprovação do gestor e CEO antes da publicação.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_hiring_demand_guard BEFORE INSERT OR UPDATE ON public.ats_jobs FOR EACH ROW EXECUTE FUNCTION public.hiring_demand_guard();

CREATE OR REPLACE FUNCTION public.hiring_demand_save(p_ws uuid,p_job uuid,p_revision integer,p_purpose text,p_area uuid,p_regime text,p_billing text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'update',p_job) THEN RAISE EXCEPTION 'Sem permissão para editar demanda.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws FOR UPDATE;
 IF j.hiring_revision<>p_revision THEN RAISE EXCEPTION 'Demanda alterada por outra pessoa. Recarregue.';END IF;
 IF p_purpose IS NULL OR p_purpose NOT IN('client','internal','shared_management') OR p_area IS NULL OR p_regime IS NULL OR p_regime NOT IN('clt','pj','contract','internship','temporary') OR p_billing IS NULL THEN RAISE EXCEPTION 'Preencha finalidade, área, vínculo e cobrança.';END IF;
 IF (p_purpose='client' AND p_billing='not_applicable') OR (p_purpose<>'client' AND p_billing<>'not_applicable') THEN RAISE EXCEPTION 'Cobrança não corresponde à finalidade.';END IF;
 PERFORM set_config('app.hiring_stage2','on',true);
 UPDATE public.ats_jobs SET hiring_governed=true,hiring_purpose=p_purpose,hiring_area_id=p_area,employment_type=p_regime,hiring_billing_model=p_billing WHERE id=j.id;
 PERFORM set_config('app.hiring_stage2','off',true);
 INSERT INTO public.hiring_demand_events(workspace_id,job_id,actor_id,kind,detail) VALUES(p_ws,j.id,auth.uid(),'updated',jsonb_build_object('previous_revision',j.hiring_revision,'purpose',p_purpose,'area_id',p_area,'regime',p_regime,'billing',p_billing));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_demand_notify(p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_demand_requests;s record;
BEGIN
 SELECT * INTO r FROM public.hiring_demand_requests WHERE id=p_request;
 FOR s IN SELECT x.* FROM public.hiring_demand_steps x WHERE x.request_id=r.id AND x.status='pending' AND NOT EXISTS(SELECT 1 FROM public.hiring_demand_steps prev WHERE prev.request_id=r.id AND prev.position<x.position AND prev.status<>'approved') LOOP
  INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(r.workspace_id,s.approver_id,s.approver_id,'hiring_approval','Demanda de contratação para aprovação','Revise a demanda e registre sua decisão.','/jobs/'||r.job_id::text||'?tab=hiring','ats_job',r.job_id,'hiring:'||s.id::text)
  ON CONFLICT(dedupe_key) DO NOTHING;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_demand_request(p_ws uuid,p_job uuid,p_revision integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;p public.hiring_area_policies;r uuid;m uuid;c uuid;u uuid;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'request',p_job) OR NOT public.hiring_stage2_access(p_ws,'view',p_job) THEN RAISE EXCEPTION 'Sem permissão para solicitar aprovação.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws FOR UPDATE;
 IF j.hiring_revision<>p_revision THEN RAISE EXCEPTION 'Demanda alterada. Recarregue.';END IF;
 SELECT id INTO r FROM public.hiring_demand_requests WHERE job_id=p_job AND revision=p_revision AND status IN('pending','approved');IF r IS NOT NULL THEN RETURN r;END IF;
 IF NOT j.hiring_governed THEN RAISE EXCEPTION 'Salve a demanda antes de solicitar.';END IF;
 IF EXISTS(SELECT 1 FROM public.hiring_demand_requests WHERE job_id=p_job AND revision=p_revision) THEN RAISE EXCEPTION 'Edite a demanda para abrir uma nova revisão após rejeição.';END IF;
 IF j.hiring_purpose IS NULL OR j.hiring_area_id IS NULL OR j.employment_type IS NULL OR j.hiring_billing_model IS NULL THEN RAISE EXCEPTION 'Preencha e salve os dados da demanda.';END IF;
 SELECT * INTO p FROM public.hiring_area_policies WHERE area_id=j.hiring_area_id AND workspace_id=p_ws FOR SHARE;
 IF p.area_id IS NULL THEN RAISE EXCEPTION 'Configure o gestor e CEO desta área antes de solicitar.';END IF;
 m:=CASE WHEN p.manager_id=auth.uid() THEN p.manager_delegate_id ELSE p.manager_id END;
 c:=CASE WHEN p.ceo_id=auth.uid() THEN p.ceo_delegate_id ELSE p.ceo_id END;
 FOREACH u IN ARRAY ARRAY[m,c] LOOP
  IF u IS NULL OR u=auth.uid() OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=u AND status='active') THEN RAISE EXCEPTION 'Aprovador ausente, inativo ou solicitante. Configure substituto autorizado.';END IF;
  IF NOT public.user_has_permission(u,p_ws,'techhire.hiring_demands.approve.workspace') THEN RAISE EXCEPTION 'Aprovador sem permissão para decidir demandas.';END IF;
 END LOOP;
 INSERT INTO public.hiring_demand_requests(workspace_id,job_id,revision,requested_by,policy_revision,status,snapshot)
 VALUES(p_ws,p_job,p_revision,auth.uid(),p.revision,'pending',jsonb_build_object('title',j.title,'purpose',j.hiring_purpose,'area_id',j.hiring_area_id,'regime',j.employment_type,'billing',j.hiring_billing_model,'deal_id',j.deal_id,'manager',m,'ceo',c)) RETURNING id INTO r;
 INSERT INTO public.hiring_demand_steps(workspace_id,request_id,stage,position,approver_id) VALUES(p_ws,r,'manager',1,m),(p_ws,r,'ceo',2,c);
 PERFORM set_config('app.hiring_stage2','on',true);UPDATE public.ats_jobs SET hiring_governed=true,hiring_approval_status='pending' WHERE id=p_job;PERFORM set_config('app.hiring_stage2','off',true);
 INSERT INTO public.hiring_demand_events(workspace_id,job_id,request_id,actor_id,kind) VALUES(p_ws,p_job,r,auth.uid(),'requested');
 PERFORM public.hiring_demand_notify(r);RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_demand_decide(p_ws uuid,p_request uuid,p_decision text,p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_demand_requests;j public.ats_jobs;s public.hiring_demand_steps;p public.hiring_area_policies;
BEGIN
 SELECT * INTO r FROM public.hiring_demand_requests WHERE id=p_request AND workspace_id=p_ws;
 IF r.id IS NULL OR NOT public.hiring_stage2_access(p_ws,'approve',r.job_id) OR NOT public.hiring_stage2_access(p_ws,'view',r.job_id) THEN RAISE EXCEPTION 'Sem permissão para decidir.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=r.job_id FOR UPDATE;
 SELECT * INTO r FROM public.hiring_demand_requests WHERE id=p_request FOR UPDATE;
 SELECT * INTO p FROM public.hiring_area_policies WHERE area_id=j.hiring_area_id AND workspace_id=p_ws FOR SHARE;
 IF r.status<>'pending' OR j.hiring_revision<>r.revision OR p.revision IS DISTINCT FROM r.policy_revision THEN RAISE EXCEPTION 'Solicitação encerrada ou versão desatualizada.';END IF;
 IF r.requested_by=auth.uid() THEN RAISE EXCEPTION 'Solicitante não pode aprovar.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.hiring_demand_steps WHERE request_id=r.id AND status='pending' ORDER BY position LIMIT 1 FOR UPDATE;
 IF s.approver_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Aguarde a etapa anterior ou o aprovador nomeado.' USING ERRCODE='42501';END IF;
 IF p_decision IS NULL OR p_decision NOT IN('approved','rejected') OR length(p_note)>2000 OR (p_decision='rejected' AND length(trim(coalesce(p_note,'')))<5) THEN RAISE EXCEPTION 'Informe decisão e justificativa válida.';END IF;
 UPDATE public.hiring_demand_steps SET status=p_decision,note=p_note,decided_by=auth.uid(),decided_at=now() WHERE request_id=r.id AND status='pending' AND approver_id=auth.uid();
 -- Se gestor e CEO forem a mesma pessoa, a decisão atende os dois papéis.
 IF p_decision='rejected' THEN UPDATE public.hiring_demand_requests SET status='rejected' WHERE id=r.id;
 ELSIF NOT EXISTS(SELECT 1 FROM public.hiring_demand_steps WHERE request_id=r.id AND status<>'approved') THEN UPDATE public.hiring_demand_requests SET status='approved' WHERE id=r.id;END IF;
 PERFORM set_config('app.hiring_stage2','on',true);
 UPDATE public.ats_jobs SET hiring_approval_status=(SELECT status FROM public.hiring_demand_requests WHERE id=r.id) WHERE id=j.id;
 PERFORM set_config('app.hiring_stage2','off',true);
 INSERT INTO public.hiring_demand_events(workspace_id,job_id,request_id,actor_id,kind,detail) VALUES(p_ws,j.id,r.id,auth.uid(),p_decision,jsonb_build_object('note',p_note,'stage',s.stage));
 IF p_decision='approved' THEN PERFORM public.hiring_demand_notify(r.id);END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_stage2_context(p_ws uuid,p_job uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'view',p_job) THEN RAISE EXCEPTION 'Sem acesso à demanda.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws;
 RETURN jsonb_build_object('job',jsonb_build_object('id',j.id,'purpose',j.hiring_purpose,'area_id',j.hiring_area_id,'regime',j.employment_type,'billing',j.hiring_billing_model,'revision',j.hiring_revision,'status',j.hiring_approval_status,'governed',j.hiring_governed,'deal_id',j.deal_id),
 'areas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM public.user_groups WHERE workspace_id=p_ws),'[]'),
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(pr.full_name,m.user_id::text))) FROM public.workspace_members m JOIN public.profiles pr ON pr.id=m.user_id WHERE m.workspace_id=p_ws AND m.status='active'),'[]'),
 'policies',CASE WHEN public.hiring_stage2_access(p_ws,'manage') THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.hiring_area_policies x WHERE workspace_id=p_ws),'[]') ELSE '[]'::jsonb END,
 'email_deliveries',coalesce((SELECT jsonb_agg(jsonb_build_object('step_id',o.step_id,'status',o.status,'attempts',o.attempts)) FROM public.hiring_email_outbox o JOIN public.hiring_demand_steps s ON s.id=o.step_id JOIN public.hiring_demand_requests r ON r.id=s.request_id WHERE r.job_id=p_job AND r.workspace_id=p_ws),'[]'),
 'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('steps',(SELECT jsonb_agg(to_jsonb(s) ORDER BY position) FROM public.hiring_demand_steps s WHERE s.request_id=r.id)) ORDER BY r.created_at DESC) FROM public.hiring_demand_requests r WHERE job_id=p_job AND workspace_id=p_ws),'[]'),
 'actor_id',auth.uid(),'capabilities',jsonb_build_object('update',public.hiring_stage2_access(p_ws,'update',p_job),'request',public.hiring_stage2_access(p_ws,'request',p_job),'approve',public.hiring_stage2_access(p_ws,'approve',p_job),'manage',public.hiring_stage2_access(p_ws,'manage')));
END $$;

REVOKE ALL ON FUNCTION public.hiring_area_policy_save(uuid,uuid,uuid,uuid,uuid,uuid),public.hiring_demand_save(uuid,uuid,integer,text,uuid,text,text),public.hiring_demand_request(uuid,uuid,integer),public.hiring_demand_decide(uuid,uuid,text,text),public.hiring_stage2_context(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_area_policy_save(uuid,uuid,uuid,uuid,uuid,uuid),public.hiring_demand_save(uuid,uuid,integer,text,uuid,text,text),public.hiring_demand_request(uuid,uuid,integer),public.hiring_demand_decide(uuid,uuid,text,text),public.hiring_stage2_context(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.hiring_demand_guard(),public.hiring_demand_notify(uuid) FROM PUBLIC,anon,authenticated;

-- A classificação comercial só pode ser alterada por editor do catálogo do tenant ativo.
CREATE OR REPLACE FUNCTION public.hiring_catalog_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.staffing_kind IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.staffing_kind IS DISTINCT FROM OLD.staffing_kind) THEN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(NEW.workspace_id,auth.uid()) OR public.is_read_only_view()
   OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_workspace_id=NEW.workspace_id)
   OR NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techsales.catalog.services.update.workspace') THEN RAISE EXCEPTION 'Sem permissão para classificar serviço.' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_catalog_guard BEFORE INSERT OR UPDATE ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION public.hiring_catalog_guard();
REVOKE ALL ON FUNCTION public.hiring_catalog_guard() FROM PUBLIC,anon,authenticated;

-- Novas associações rejeitam serviços inativos; referências históricas ficam intactas.
CREATE OR REPLACE FUNCTION public.hiring_active_service_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.service_catalog_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.service_catalog_id IS NOT DISTINCT FROM OLD.service_catalog_id AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.service_catalog WHERE id=NEW.service_catalog_id AND workspace_id=NEW.workspace_id AND active) THEN RAISE EXCEPTION 'Serviço inativo ou indisponível neste workspace.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_active_service_guard BEFORE INSERT OR UPDATE ON public.deal_line_items FOR EACH ROW EXECUTE FUNCTION public.hiring_active_service_guard();
CREATE TRIGGER hiring_active_service_guard BEFORE INSERT OR UPDATE ON public.quote_line_items FOR EACH ROW EXECUTE FUNCTION public.hiring_active_service_guard();
REVOKE ALL ON FUNCTION public.hiring_active_service_guard() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.hiring_email_outbox(
 step_id uuid PRIMARY KEY REFERENCES public.hiring_demand_steps(id),workspace_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','sent','failed','suppressed')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),last_error text,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hiring_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_email_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.hiring_email_outbox TO service_role;
CREATE OR REPLACE FUNCTION public.hiring_email_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.type='hiring_approval' AND NEW.dedupe_key LIKE 'hiring:%' THEN
  INSERT INTO public.hiring_email_outbox(step_id,workspace_id) VALUES(substring(NEW.dedupe_key from 8)::uuid,NEW.workspace_id) ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_email_enqueue AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.hiring_email_enqueue();
REVOKE ALL ON FUNCTION public.hiring_email_enqueue() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hiring_email_claim() RETURNS TABLE(step_id uuid,recipient_id uuid,job_id uuid,workspace_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH ready AS (
 SELECT o.step_id,s.approver_id,r.job_id,o.workspace_id FROM public.hiring_email_outbox o
 JOIN public.hiring_demand_steps s ON s.id=o.step_id
 JOIN public.hiring_demand_requests r ON r.id=s.request_id
 JOIN public.ats_jobs j ON j.id=r.job_id AND j.workspace_id=r.workspace_id AND j.hiring_revision=r.revision
 JOIN public.hiring_area_policies p ON p.area_id=j.hiring_area_id AND p.revision=r.policy_revision
 WHERE o.status IN('pending','failed','sending') AND o.attempts<5 AND o.next_attempt_at<=now()
 AND r.status='pending' AND s.status='pending' AND NOT EXISTS(SELECT 1 FROM public.hiring_demand_steps prev WHERE prev.request_id=r.id AND prev.position<s.position AND prev.status<>'approved')
 AND EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=r.workspace_id AND m.user_id=s.approver_id AND m.status='active')
 AND public.user_has_permission(s.approver_id,r.workspace_id,'techhire.hiring_demands.approve.workspace')
 AND public.user_has_permission(s.approver_id,r.workspace_id,'techhire.hiring_demands.view.workspace')
 ORDER BY o.next_attempt_at LIMIT 10 FOR UPDATE OF o SKIP LOCKED
 ), claimed AS (
 UPDATE public.hiring_email_outbox o SET status='sending',attempts=attempts+1,next_attempt_at=now()+interval '10 minutes',updated_at=now() FROM ready x WHERE o.step_id=x.step_id RETURNING o.step_id
 ) SELECT x.* FROM ready x JOIN claimed c USING(step_id)
$$;
REVOKE ALL ON FUNCTION public.hiring_email_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_email_claim() TO service_role;

-- Reaproveita apenas o agendador autenticado existente. Ativar após publicar a rota.
DO $schedule$
DECLARE v_command text;v_id bigint;
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  SELECT command INTO v_command FROM cron.job WHERE jobname='sdr-tick' AND active AND command LIKE '%/api/public/hooks/sdr-tick%' LIMIT 1;
  IF v_command IS NOT NULL THEN
   SELECT cron.schedule('hiring-approvals-tick','* * * * *',replace(v_command,'/api/public/hooks/sdr-tick','/api/public/hooks/hiring-approvals-tick')) INTO v_id;
   PERFORM cron.alter_job(v_id,active:=false);
  END IF;
 END IF;
END $schedule$;

CREATE OR REPLACE FUNCTION public.hiring_profile_catalog_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.deal_id IS NOT DISTINCT FROM OLD.deal_id AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.deal_line_items l JOIN public.service_catalog c ON c.id=l.service_catalog_id AND c.workspace_id=l.workspace_id WHERE l.workspace_id=NEW.workspace_id AND l.deal_id=NEW.deal_id AND c.active AND (c.staffing_kind IN('hunting','outsourcing','squad') OR (c.staffing_kind IS NULL AND lower(c.name) ~ '(hunting|outsourcing|squad)'))) THEN RAISE EXCEPTION 'Novo perfil exige serviço ativo de Hunting, Outsourcing ou Squad no negócio.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_profile_catalog_guard BEFORE INSERT OR UPDATE ON public.deal_role_profiles FOR EACH ROW EXECUTE FUNCTION public.hiring_profile_catalog_guard();
REVOKE ALL ON FUNCTION public.hiring_profile_catalog_guard() FROM PUBLIC,anon,authenticated;
