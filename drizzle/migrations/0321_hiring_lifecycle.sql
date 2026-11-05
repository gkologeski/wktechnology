-- Adopt only the unused, disabled prototype schema accidentally generated as 0305
-- by the remote builder. Keep its objects and FK provenance in a private archive;
-- no table/row is deleted and no historical migration/journal is rewritten.
DO $adopt$ DECLARE f record; t record; BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hiring_lifecycle_requests' AND column_name='source_hash') THEN
  IF EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE lifecycle_gate_enabled) OR EXISTS(SELECT 1 FROM public.hiring_lifecycle_requests) THEN RAISE EXCEPTION 'Prototype lifecycle has business usage; explicit reconciliation required before adoption.';END IF;
  CREATE SCHEMA hiring_lifecycle_draft_20261105;
  REVOKE ALL ON SCHEMA hiring_lifecycle_draft_20261105 FROM PUBLIC,anon,authenticated,service_role;
  FOR t IN SELECT tr.tgname,tr.tgrelid::regclass AS rel FROM pg_trigger tr JOIN pg_proc pr ON pr.oid=tr.tgfoid WHERE NOT tr.tgisinternal AND pr.pronamespace='public'::regnamespace AND pr.proname LIKE 'hiring_lifecycle_%' LOOP EXECUTE format('DROP TRIGGER %I ON %s',t.tgname,t.rel);END LOOP;
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'hiring_lifecycle_%' OR proname='hiring_offboarding_guard') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);
   EXECUTE format('ALTER FUNCTION %s SET SCHEMA hiring_lifecycle_draft_20261105',f.sig);
  END LOOP;
  ALTER TABLE public.hiring_lifecycle_steps SET SCHEMA hiring_lifecycle_draft_20261105;
  ALTER TABLE public.hiring_lifecycle_requests SET SCHEMA hiring_lifecycle_draft_20261105;
  REVOKE ALL ON ALL TABLES IN SCHEMA hiring_lifecycle_draft_20261105 FROM PUBLIC,anon,authenticated,service_role;
 END IF;
END $adopt$;
CREATE OR REPLACE FUNCTION public.hiring_set_live(s uuid,u uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT NOT EXISTS(SELECT 1 FROM permission_sets WHERE id=s AND module='__hiring__') OR EXISTS(
 SELECT 1 FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN people pe ON pe.id=e.person_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id JOIN ats_jobs j ON j.id=e.job_id
 WHERE v.role_id=j.hiring_role_id AND g.set_id=s AND g.user_id=u AND g.workspace_id=w AND e.workspace_id=w AND g.revoked_at IS NULL AND e.status='active'
 AND pe.profile_id=u AND pe.status='active' AND NOT pe.archived AND(pe.hire_date IS NULL OR pe.hire_date<=(now() AT TIME ZONE 'America/Sao_Paulo')::date) AND e.starts_at<=(now() AT TIME ZONE 'America/Sao_Paulo')::date AND(e.ends_at IS NULL OR e.ends_at>=(now() AT TIME ZONE 'America/Sao_Paulo')::date))
$$;
CREATE OR REPLACE FUNCTION public.hiring_allocation_scope(w uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.is_workspace_member(w,auth.uid()) AND public.work_access_context()->>'workspace'=w::text AND(
 public.is_workspace_admin_v2(w,auth.uid()) OR NOT EXISTS(SELECT 1 FROM hiring_access_grants WHERE user_id=auth.uid() AND workspace_id=w AND revoked_at IS NULL)
 OR EXISTS(SELECT 1 FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE g.user_id=auth.uid() AND g.workspace_id=w AND g.revoked_at IS NULL AND NOT v.allocation_only AND public.hiring_set_live(g.set_id,g.user_id,w))
 OR EXISTS(SELECT 1 FROM people_allocations a JOIN people pe ON pe.id=a.person_id JOIN hiring_engagements e ON e.id=a.hiring_engagement_id JOIN hiring_access_grants g ON g.engagement_id=e.id
 WHERE a.project_id=p AND a.workspace_id=w AND pe.profile_id=auth.uid() AND a.status='active' AND a.can_track_time AND a.starts_at<=(now() AT TIME ZONE 'America/Sao_Paulo')::date AND(a.ends_at IS NULL OR a.ends_at>=(now() AT TIME ZONE 'America/Sao_Paulo')::date) AND g.revoked_at IS NULL AND public.hiring_set_live(g.set_id,auth.uid(),w)))
$$;
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
-- Stage 6A: approved, versioned lifecycle changes; no implicit hiring or financial deletion.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.lifecycle.view.workspace','techpeople','lifecycle','view','workspace','Ver ciclo de vida dos vínculos','Exige escopo da pessoa.',true),
('techpeople.lifecycle.manage.workspace','techpeople','lifecycle','manage','workspace','Solicitar e executar ciclo de vida','Prévia, gestor da área e CEO; não concede acesso extra.',true),
('techpeople.lifecycle.approve.workspace','techpeople','lifecycle','approve','workspace','Aprovar ciclo de vida','Somente aprovador nomeado; sem autoaprovação.',true)
ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.hiring_workspace_settings ADD COLUMN IF NOT EXISTS lifecycle_gate_enabled boolean NOT NULL DEFAULT false,ADD COLUMN lifecycle_finance_area_id uuid REFERENCES public.user_groups(id);
CREATE TABLE public.hiring_lifecycle_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),engagement_id uuid NOT NULL REFERENCES public.hiring_engagements(id),
 kind text NOT NULL CHECK(kind IN('renew','replace','end_allocation','end_engagement','cancel_commitments')),
 payload jsonb NOT NULL,snapshot jsonb NOT NULL,area_id uuid NOT NULL,policy_revision int NOT NULL,
 requested_by uuid NOT NULL,manager_id uuid NOT NULL,ceo_id uuid NOT NULL,
 manager_by uuid,manager_at timestamptz,ceo_by uuid,ceo_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','applied')),
 note text,created_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz,result jsonb
);
CREATE TABLE public.hiring_lifecycle_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,request_id uuid NOT NULL REFERENCES public.hiring_lifecycle_requests(id),actor uuid NOT NULL,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX hiring_lifecycle_person ON public.hiring_lifecycle_requests(workspace_id,engagement_id,created_at DESC);
ALTER TABLE public.hiring_lifecycle_requests ENABLE ROW LEVEL SECURITY;ALTER TABLE public.hiring_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_lifecycle_requests,public.hiring_lifecycle_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_access(w uuid,eid uuid,action text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;
BEGIN
 SELECT * INTO e FROM public.hiring_engagements WHERE id=eid AND workspace_id=w;
 IF action NOT IN('view','manage','approve') OR action IS NULL OR e.id IS NULL OR NOT public.hiring_employment_access(w,'techpeople.lifecycle.'||action||'.workspace') OR NOT public.hr_record_access('people',CASE WHEN action='manage' THEN 'update' ELSE 'view' END,e.person_id) THEN RAISE EXCEPTION 'Sem permissão para ciclo de vida.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=w AND lifecycle_gate_enabled) THEN RAISE EXCEPTION 'Ciclo de vida ainda não ativado neste workspace.';END IF;
END $$;

-- Private snapshot/validation is repeated at proposal, both approvals and application.
CREATE OR REPLACE FUNCTION public.hiring_lifecycle_snapshot(w uuid,eid uuid,k text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;a public.people_allocations;r public.hiring_engagements;pc public.contracts;co public.contracts;j public.ats_jobs;
 cutoff date:=(p->>'date')::date;finish date:=(p->>'end')::date;ids uuid[];financial jsonb;
BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=eid AND workspace_id=w;
 SELECT * INTO j FROM ats_jobs WHERE id=e.job_id AND workspace_id=w;
 IF e.id IS NULL OR (e.status<>'active' AND k<>'cancel_commitments') OR cutoff IS NULL OR cutoff<e.starts_at OR length(trim(coalesce(p->>'reason','')))<10 THEN RAISE EXCEPTION 'Vínculo, data ou justificativa inválidos.';END IF;
 IF k NOT IN('renew','replace','end_allocation','end_engagement','cancel_commitments') OR k IS NULL THEN RAISE EXCEPTION 'Operação inválida.';END IF;
 IF k IN('renew','replace','end_allocation') THEN
  SELECT * INTO a FROM people_allocations WHERE id=(p->>'allocation')::uuid AND workspace_id=w AND hiring_engagement_id=e.id;
  IF a.id IS NULL OR NOT public.hr_record_access('person_allocations','view',a.id) OR a.status::text NOT IN('active','paused') OR a.starts_at IS NULL THEN RAISE EXCEPTION 'Selecione alocação vigente deste vínculo.';END IF;
  IF cutoff<a.starts_at OR (k<>'renew' AND a.ends_at IS NOT NULL AND cutoff>a.ends_at) THEN RAISE EXCEPTION 'Corte fora da vigência da alocação.';END IF;
 END IF;
 IF k='renew' THEN
  IF a.ends_at IS NULL OR cutoff<>a.ends_at+1 OR finish IS NULL OR finish<cutoff OR (e.ends_at IS NOT NULL AND finish<=e.ends_at) THEN RAISE EXCEPTION 'Renovação deve começar no dia seguinte ao término e ampliar a vigência com fim definido.';END IF;
  SELECT * INTO pc FROM contracts WHERE id=e.purchase_contract_id AND workspace_id=w;
  SELECT * INTO co FROM contracts WHERE id=e.commercial_contract_id AND workspace_id=w;
  IF pc.id IS NULL OR pc.status::text NOT IN('active','renewing') OR pc.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR pc.hiring_person_id IS DISTINCT FROM e.person_id OR pc.starts_at IS NULL OR pc.starts_at>cutoff OR (pc.ends_at IS NOT NULL AND pc.ends_at<finish) THEN RAISE EXCEPTION 'Revise primeiro o contrato de contratação e sua vigência no TechContracts.';END IF;
  IF e.purpose='client' AND (co.id IS NULL OR co.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR co.starts_at IS NULL OR co.starts_at>cutoff OR (co.ends_at IS NOT NULL AND co.ends_at<finish) OR public.hiring_contract_signature_reason(co.id,w,co.deal_id) IS NOT NULL) THEN RAISE EXCEPTION 'Revise e assine primeiro a renovação comercial no TechContracts.';END IF;
  IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL THEN RAISE EXCEPTION 'Demanda/documentos precisam de revisão antes da renovação.';END IF;
 END IF;
 IF k='replace' THEN
  SELECT * INTO r FROM hiring_engagements WHERE id=(p->>'replacement')::uuid AND workspace_id=w;
  IF r.id IS NULL OR r.id=e.id OR r.person_id=e.person_id OR r.status<>'active' OR r.legal_entity_id<>e.legal_entity_id OR r.purpose<>e.purpose OR r.commercial_contract_id IS DISTINCT FROM e.commercial_contract_id OR NOT public.hr_record_access('people','update',r.person_id) OR public.hiring_recruitment_reason(w,r.job_id) IS NOT NULL THEN RAISE EXCEPTION 'Substituto deve estar admitido no mesmo contexto, com acesso permitido e demanda válida.';END IF;
  IF (p->>'start')::date IS NULL OR finish IS NULL OR finish<(p->>'start')::date OR (p->>'start')::date<r.starts_at OR (r.ends_at IS NOT NULL AND finish>r.ends_at) THEN RAISE EXCEPTION 'Vigência do substituto inválida.';END IF;
  IF (p->>'start')::date<=cutoff AND NOT coalesce((p->>'overlap')::boolean,false) THEN RAISE EXCEPTION 'Sobreposição exige aceite explícito e aprovação.';END IF;
 END IF;
 IF k IN('replace','end_allocation','end_engagement') THEN
  IF e.ends_at IS NOT NULL AND cutoff>e.ends_at THEN RAISE EXCEPTION 'Encerramento não pode ampliar o vínculo.';END IF;
  IF EXISTS(SELECT 1 FROM project_time_entries t JOIN people_allocations x ON x.workspace_id=w AND (x.id=t.allocation_id OR (t.allocation_id IS NULL AND x.project_id=t.project_id AND (t.person_id=e.person_id OR t.user_id=(SELECT profile_id FROM people WHERE id=e.person_id AND workspace_id=w)))) WHERE t.workspace_id=w AND x.hiring_engagement_id=e.id AND (k='end_engagement' OR x.id=a.id) AND t.entry_date>cutoff) THEN RAISE EXCEPTION 'Há horas posteriores ao corte; revise-as antes de encerrar.';END IF;
  IF k='end_engagement' AND EXISTS(SELECT 1 FROM people_allocations x WHERE x.workspace_id=w AND x.hiring_engagement_id=e.id AND NOT public.hr_record_access('person_allocations','update',x.id)) THEN RAISE EXCEPTION 'Sem permissão sobre uma das alocações.' USING ERRCODE='42501';END IF;
  IF k='end_engagement' AND EXISTS(SELECT 1 FROM people_allocations x WHERE x.workspace_id=w AND x.hiring_engagement_id=e.id AND x.starts_at>cutoff AND x.status::text IN('active','paused')) THEN RAISE EXCEPTION 'Revise primeiro as alocações futuras deste vínculo.';END IF;
 END IF;
 IF k='cancel_commitments' THEN
  IF NOT public.user_has_permission(auth.uid(),w,'techfinance.entry_cancellation.manage.workspace') OR public.shared_field_mode_for(public.shared_field_context()->'rules','financial_entries','amount') IN('hidden','masked') THEN RAISE EXCEPTION 'Sem permissão financeira ou visibilidade dos valores.' USING ERRCODE='42501';END IF;
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(p->'entries');
  IF cardinality(ids) NOT BETWEEN 1 AND 100 OR ids IS NULL OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN RAISE EXCEPTION 'Selecione 1 a 100 compromissos distintos.';END IF;
  IF (SELECT count(*) FROM financial_entries f WHERE f.id=ANY(ids) AND f.workspace_id=w AND public.finance_entry_access(f.id,'view') AND public.finance_entry_access(f.id,'cancel') AND f.direction::text='payable' AND f.status::text IN('open','overdue') AND coalesce(f.paid_amount,0)=0 AND f.competence_date>=(date_trunc('month',cutoff)+interval '1 month')::date AND f.contract_id=e.purchase_contract_id AND (f.origin_type::text='contract' OR f.metadata->>'origin'='workflow_hiring') AND NOT EXISTS(SELECT 1 FROM financial_entries child WHERE child.parent_entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM project_measurement_financial_links x WHERE x.financial_entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM financial_payments x WHERE x.entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM bank_charges x WHERE x.financial_entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM bank_payments x WHERE x.financial_entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM project_time_entries x WHERE x.workspace_id=w AND date_trunc('month',x.entry_date)=date_trunc('month',f.competence_date) AND (x.person_id=e.person_id OR EXISTS(SELECT 1 FROM people_allocations ax WHERE ax.id=x.allocation_id AND ax.workspace_id=w AND ax.hiring_engagement_id=e.id))) AND NOT EXISTS(SELECT 1 FROM project_time_entries x WHERE x.financial_entry_id=f.id) AND NOT EXISTS(SELECT 1 FROM project_measurements x WHERE x.financial_entry_id=f.id))<>cardinality(ids) THEN RAISE EXCEPTION 'Seleção contém compromisso protegido, competência trabalhada ou sem origem comprovada.';END IF;
  SELECT jsonb_agg(jsonb_build_object('id',f.id,'amount',f.amount,'currency',f.currency,'competence_date',f.competence_date,'status',f.status,'version',f.xmin::text,'fingerprint',md5(to_jsonb(f)::text)) ORDER BY f.id) INTO financial FROM financial_entries f WHERE f.id=ANY(ids) AND f.workspace_id=w;
 END IF;
 RETURN jsonb_build_object('summary',jsonb_build_object('person',(SELECT full_name FROM people WHERE id=e.person_id AND workspace_id=w),'replacement_person',(SELECT full_name FROM people WHERE id=r.person_id AND workspace_id=w),'project',NULL,'entity',(SELECT name FROM legal_entities WHERE id=e.legal_entity_id AND workspace_id=w)),'engagement',to_jsonb(e),'job_revision',j.hiring_revision,'job_area',j.hiring_area_id,'job_status',j.hiring_approval_status,'allocation',(to_jsonb(a)-ARRAY['cost_rate','billable_rate','notes'])||jsonb_build_object('fingerprint',md5(to_jsonb(a)::text)),'replacement',to_jsonb(r),'replacement_purchase',public.hiring_contract_fingerprint(r.purchase_contract_id),'replacement_commercial',public.hiring_contract_fingerprint(r.commercial_contract_id),'replacement_job',(SELECT jsonb_build_object('revision',hiring_revision,'approval',hiring_approval_status) FROM ats_jobs WHERE id=r.job_id AND workspace_id=w),'finance_area',(SELECT lifecycle_finance_area_id FROM hiring_workspace_settings WHERE workspace_id=w),'purchase',public.hiring_contract_fingerprint(e.purchase_contract_id),'commercial',public.hiring_contract_fingerprint(e.commercial_contract_id),'allocations',coalesce((SELECT jsonb_agg((to_jsonb(x)-ARRAY['cost_rate','billable_rate','notes'])||jsonb_build_object('fingerprint',md5(to_jsonb(x)::text)) ORDER BY x.id) FROM people_allocations x WHERE x.workspace_id=w AND x.hiring_engagement_id=e.id),'[]'),'financial',financial);
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_preview(w uuid,eid uuid,k text,p jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM public.hiring_lifecycle_access(w,eid,'manage');RETURN public.hiring_lifecycle_snapshot(w,eid,k,p);END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_notify(req uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_lifecycle_requests;u uuid;
BEGIN
 SELECT * INTO r FROM hiring_lifecycle_requests WHERE id=req;
 u:=CASE WHEN r.manager_at IS NULL THEN r.manager_id ELSE r.ceo_id END;
 IF r.status<>'pending' THEN RETURN;END IF;
 INSERT INTO notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
 SELECT r.workspace_id,u,u,'hiring_approval','Aprovar alteração de vínculo','Revise a prévia e a justificativa antes de decidir.','/people/'||e.person_id||'?tab=allocations','people',e.person_id,'hiring-lifecycle:'||r.id||':'||u FROM hiring_engagements e WHERE e.id=r.engagement_id
 ON CONFLICT(dedupe_key) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_request(w uuid,eid uuid,k text,p jsonb,expected jsonb,request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;policy public.hiring_area_policies;area uuid;m uuid;c uuid;current_snapshot jsonb;existing public.hiring_lifecycle_requests;
BEGIN
 PERFORM public.hiring_lifecycle_access(w,eid,'manage');
 PERFORM pg_advisory_xact_lock(hashtext('hiring-lifecycle:'||w::text));
 SELECT * INTO existing FROM hiring_lifecycle_requests WHERE id=request_id AND workspace_id=w;
 IF FOUND THEN IF existing.engagement_id=eid AND existing.kind=k AND existing.payload=p AND existing.snapshot=expected AND existing.requested_by=auth.uid() THEN RETURN existing.id;ELSE RAISE EXCEPTION 'Identificador já usado.';END IF;END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=eid AND workspace_id=w FOR UPDATE;
 current_snapshot:=public.hiring_lifecycle_snapshot(w,eid,k,p);
 IF expected IS NULL OR expected IS DISTINCT FROM current_snapshot THEN RAISE EXCEPTION 'Prévia desatualizada.' USING ERRCODE='40001';END IF;
 SELECT CASE WHEN k='cancel_commitments' THEN s.lifecycle_finance_area_id ELSE j.hiring_area_id END INTO area FROM ats_jobs j JOIN hiring_workspace_settings s ON s.workspace_id=j.workspace_id WHERE j.id=e.job_id AND j.workspace_id=w;
 SELECT * INTO policy FROM hiring_area_policies WHERE workspace_id=w AND area_id=area FOR SHARE;
 m:=CASE WHEN policy.manager_id=auth.uid() THEN policy.manager_delegate_id ELSE policy.manager_id END;
 c:=CASE WHEN policy.ceo_id=auth.uid() THEN policy.ceo_delegate_id ELSE policy.ceo_id END;
 IF m IS NULL OR c IS NULL OR m=auth.uid() OR c=auth.uid() OR NOT public.is_workspace_member(w,m) OR NOT public.is_workspace_member(w,c) OR NOT public.user_has_permission(m,w,'techpeople.lifecycle.approve.workspace') OR NOT public.user_has_permission(c,w,'techpeople.lifecycle.approve.workspace') THEN RAISE EXCEPTION 'Configure gestor, CEO e delegados ativos/autorizados; solicitante não pode aprovar.';END IF;
 INSERT INTO hiring_lifecycle_requests(id,workspace_id,engagement_id,kind,payload,snapshot,area_id,policy_revision,requested_by,manager_id,ceo_id) VALUES(request_id,w,eid,k,p,current_snapshot,area,policy.revision,auth.uid(),m,c);
 INSERT INTO hiring_lifecycle_events(workspace_id,request_id,actor,kind) VALUES(w,request_id,auth.uid(),'requested');PERFORM public.hiring_lifecycle_notify(request_id);RETURN request_id;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_decide(w uuid,req uuid,accept boolean,reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_lifecycle_requests;policy public.hiring_area_policies;next_id uuid;
BEGIN
 SELECT * INTO r FROM hiring_lifecycle_requests WHERE id=req AND workspace_id=w FOR UPDATE;
 PERFORM public.hiring_lifecycle_access(w,r.engagement_id,'approve');
 SELECT * INTO policy FROM hiring_area_policies WHERE workspace_id=w AND area_id=r.area_id FOR SHARE;
 IF r.status<>'pending' OR r.requested_by=auth.uid() OR policy.revision IS DISTINCT FROM r.policy_revision THEN RAISE EXCEPTION 'Aprovação indisponível, alçada alterada ou autoaprovação.';END IF;
 IF NOT public.is_workspace_member(w,r.manager_id) OR NOT public.is_workspace_member(w,r.ceo_id) OR NOT public.user_has_permission(r.manager_id,w,'techpeople.lifecycle.approve.workspace') OR NOT public.user_has_permission(r.ceo_id,w,'techpeople.lifecycle.approve.workspace') THEN RAISE EXCEPTION 'Aprovador perdeu acesso; solicite nova revisão.';END IF;
 next_id:=CASE WHEN r.manager_at IS NULL THEN r.manager_id ELSE r.ceo_id END;
 IF next_id<>auth.uid() OR length(trim(coalesce(reason,'')))<3 OR accept IS NULL THEN RAISE EXCEPTION 'Somente o aprovador da etapa pode decidir, com justificativa.';END IF;
 IF public.hiring_lifecycle_snapshot(w,r.engagement_id,r.kind,r.payload) IS DISTINCT FROM r.snapshot THEN RAISE EXCEPTION 'Origem mudou; faça nova prévia e solicitação.' USING ERRCODE='40001';END IF;
 UPDATE hiring_lifecycle_requests SET manager_at=CASE WHEN accept AND auth.uid()=manager_id THEN now() ELSE manager_at END,manager_by=CASE WHEN accept AND auth.uid()=manager_id THEN auth.uid() ELSE manager_by END,ceo_at=CASE WHEN accept AND auth.uid()=ceo_id THEN now() ELSE ceo_at END,ceo_by=CASE WHEN accept AND auth.uid()=ceo_id THEN auth.uid() ELSE ceo_by END,status=CASE WHEN NOT accept THEN 'rejected' WHEN (r.manager_at IS NOT NULL OR auth.uid()=manager_id) AND auth.uid()=ceo_id THEN 'approved' ELSE 'pending' END,note=trim(reason) WHERE id=req;
 INSERT INTO hiring_lifecycle_events(workspace_id,request_id,actor,kind,detail) VALUES(w,req,auth.uid(),CASE WHEN accept THEN 'approved_step' ELSE 'rejected' END,jsonb_build_object('note',trim(reason)));PERFORM public.hiring_lifecycle_notify(req);
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_apply(w uuid,req uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.hiring_lifecycle_requests;e public.hiring_engagements;a public.people_allocations;replacement public.hiring_engagements;cutoff date;new_id uuid;ids uuid[];policy public.hiring_area_policies;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('hiring-lifecycle:'||w::text));
 SELECT * INTO r FROM hiring_lifecycle_requests WHERE id=req AND workspace_id=w FOR UPDATE;
 PERFORM public.hiring_lifecycle_access(w,r.engagement_id,'manage');
 IF r.kind IN('renew','replace','end_allocation') AND NOT public.hr_record_access('person_allocations','update',(r.payload->>'allocation')::uuid) THEN RAISE EXCEPTION 'Sem permissão para alterar alocação.' USING ERRCODE='42501';END IF;
 IF r.status='applied' THEN RETURN r.result;END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=r.engagement_id AND workspace_id=w FOR UPDATE;
 PERFORM 1 FROM people_allocations WHERE workspace_id=w AND hiring_engagement_id=e.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM ats_jobs WHERE workspace_id=w AND id=e.job_id FOR SHARE;
 PERFORM 1 FROM contracts WHERE workspace_id=w AND id IN(e.purchase_contract_id,e.commercial_contract_id) ORDER BY id FOR SHARE;
 IF r.kind='replace' THEN
  SELECT * INTO replacement FROM hiring_engagements WHERE id=(r.payload->>'replacement')::uuid AND workspace_id=w FOR UPDATE;
  PERFORM 1 FROM ats_jobs WHERE id=replacement.job_id AND workspace_id=w FOR SHARE;
  PERFORM 1 FROM contracts WHERE workspace_id=w AND id IN(replacement.purchase_contract_id,replacement.commercial_contract_id) ORDER BY id FOR SHARE;
 END IF;
 SELECT * INTO policy FROM hiring_area_policies WHERE workspace_id=w AND area_id=r.area_id FOR SHARE;
 IF r.status<>'approved' OR policy.revision IS DISTINCT FROM r.policy_revision OR NOT public.is_workspace_member(w,r.manager_by) OR NOT public.is_workspace_member(w,r.ceo_by) OR NOT public.user_has_permission(r.manager_by,w,'techpeople.lifecycle.approve.workspace') OR NOT public.user_has_permission(r.ceo_by,w,'techpeople.lifecycle.approve.workspace') THEN RAISE EXCEPTION 'Exige aprovação vigente do gestor e CEO.';END IF;
 IF r.kind='cancel_commitments' THEN
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(r.payload->'entries');
  PERFORM 1 FROM financial_entries WHERE workspace_id=w AND id=ANY(ids) ORDER BY id FOR UPDATE;
 END IF;
 IF public.hiring_lifecycle_snapshot(w,e.id,r.kind,r.payload) IS DISTINCT FROM r.snapshot THEN RAISE EXCEPTION 'Origem mudou; nova revisão necessária.' USING ERRCODE='40001';END IF;
 cutoff:=(r.payload->>'date')::date;
 PERFORM set_config('app.hiring_lifecycle','on',true);
 IF r.kind='renew' THEN
  IF EXISTS(SELECT 1 FROM hiring_access_grants WHERE engagement_id=e.id AND revoked_at IS NULL) AND (NOT public.is_workspace_admin_v2(w,auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'system.roles.manage.workspace')) THEN RAISE EXCEPTION 'Estender acesso exige administrador com gestão de cargos.' USING ERRCODE='42501';END IF;
  SELECT * INTO a FROM people_allocations WHERE id=(r.payload->>'allocation')::uuid AND workspace_id=w;
  UPDATE hiring_engagements SET ends_at=(r.payload->>'end')::date,revision=revision+1 WHERE id=e.id;
  new_id:=public.hiring_allocate(w,e.id,a.project_id,cutoff,(r.payload->>'end')::date,a.allocation_pct,r.payload->>'reason');
 ELSIF r.kind IN('end_allocation','replace','end_engagement') THEN
  UPDATE people_allocations SET ends_at=least(coalesce(ends_at,cutoff),cutoff),status=CASE WHEN cutoff<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'ended' ELSE status END,can_track_time=CASE WHEN cutoff<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN false ELSE can_track_time END
  WHERE workspace_id=w AND hiring_engagement_id=e.id AND status::text IN('active','paused') AND (r.kind='end_engagement' OR id=(r.payload->>'allocation')::uuid);
  IF r.kind='replace' THEN
   SELECT * INTO a FROM people_allocations WHERE id=(r.payload->>'allocation')::uuid AND workspace_id=w;
   SELECT * INTO replacement FROM hiring_engagements WHERE id=(r.payload->>'replacement')::uuid AND workspace_id=w FOR UPDATE;
   new_id:=public.hiring_allocate(w,replacement.id,a.project_id,(r.payload->>'start')::date,(r.payload->>'end')::date,a.allocation_pct,r.payload->>'reason');
  ELSIF r.kind='end_engagement' THEN
   UPDATE hiring_engagements SET ends_at=cutoff,status=CASE WHEN cutoff<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'ended' ELSE 'active' END,ended_at=CASE WHEN cutoff<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN now() END,ended_by=auth.uid(),end_reason=r.payload->>'reason',revision=revision+1 WHERE id=e.id;
   IF cutoff<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    DELETE FROM user_permission_sets ups USING hiring_access_grants g WHERE g.engagement_id=e.id AND g.workspace_id=w AND ups.id=g.assignment_id AND ups.user_id=g.user_id AND ups.set_id=g.set_id AND ups.workspace_id=w;
    UPDATE hiring_access_grants SET revoked_at=now() WHERE engagement_id=e.id AND workspace_id=w AND revoked_at IS NULL;
   END IF;
   UPDATE workspace_invites SET expires_at=least(expires_at,(cutoff+1)::timestamptz) WHERE hiring_engagement_id=e.id AND workspace_id=w AND accepted_at IS NULL;
  END IF;
 ELSE
  UPDATE financial_entries SET status='cancelled' WHERE workspace_id=w AND id=ANY(ids);
 END IF;
 PERFORM set_config('app.hiring_lifecycle','off',true);
 UPDATE hiring_lifecycle_requests SET status='applied',applied_at=now(),result=jsonb_build_object('request_id',req,'new_allocation_id',new_id,'effective_date',cutoff) WHERE id=req RETURNING result INTO r.result;
 INSERT INTO hiring_lifecycle_events(workspace_id,request_id,actor,kind,detail) VALUES(w,req,auth.uid(),'applied',r.result);
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'lifecycle_applied',r.result||jsonb_build_object('kind',r.kind));RETURN r.result;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_context(w uuid,eid uuid,search_text text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.hiring_lifecycle_access(w,eid,'view');
 RETURN jsonb_build_object('allocations',coalesce((SELECT jsonb_agg((to_jsonb(a)-ARRAY['cost_rate','billable_rate','notes'])||jsonb_build_object('project_name',CASE WHEN public.work_record_access('techprojects.projects',a.project_id,'view') THEN (SELECT name FROM projects WHERE id=a.project_id AND workspace_id=w) ELSE 'Projeto restrito' END)) FROM people_allocations a WHERE a.workspace_id=w AND a.hiring_engagement_id=eid),'[]'),
 'replacements',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT e.id,p.full_name FROM hiring_engagements e JOIN people p ON p.id=e.person_id AND p.workspace_id=w JOIN hiring_engagements base ON base.id=eid WHERE e.workspace_id=w AND e.id<>eid AND e.status='active' AND e.legal_entity_id=base.legal_entity_id AND e.purpose=base.purpose AND e.commercial_contract_id IS NOT DISTINCT FROM base.commercial_contract_id AND p.full_name ILIKE '%'||left(search_text,100)||'%' AND public.hr_record_access('people','update',p.id) ORDER BY p.full_name LIMIT 50)x),'[]'),
 'commitments',CASE WHEN public.user_has_permission(auth.uid(),w,'techfinance.entry_cancellation.manage.workspace') AND public.shared_field_mode_for(public.shared_field_context()->'rules','financial_entries','amount') NOT IN('hidden','masked') THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT f.id,f.amount,f.currency,f.competence_date,f.due_date FROM financial_entries f JOIN hiring_engagements e ON e.id=eid AND e.workspace_id=w WHERE f.workspace_id=w AND f.contract_id=e.purchase_contract_id AND f.direction::text='payable' AND f.status::text IN('open','overdue') AND public.finance_entry_access(f.id,'view') AND public.finance_entry_access(f.id,'cancel') ORDER BY f.competence_date,f.id LIMIT 100)x),'[]') ELSE '[]'::jsonb END,
 'requests',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,kind,payload,snapshot::text AS snapshot,status,requested_by,manager_id,ceo_id,manager_at,ceo_at,created_at,result,note FROM hiring_lifecycle_requests WHERE workspace_id=w AND engagement_id=eid AND (kind<>'cancel_commitments' OR (NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'entries') selected(value) WHERE NOT public.finance_entry_access(selected.value::uuid,'view')) AND public.user_has_permission(auth.uid(),w,'techfinance.entry_cancellation.manage.workspace') AND public.shared_field_mode_for(public.shared_field_context()->'rules','financial_entries','amount') NOT IN('hidden','masked'))) ORDER BY created_at DESC LIMIT 30)x),'[]'));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_lifecycle_time_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a people_allocations;BEGIN
 FOR a IN SELECT x.* FROM people_allocations x JOIN people pe ON pe.id=x.person_id WHERE x.workspace_id=NEW.workspace_id AND(x.id=NEW.allocation_id OR(NEW.allocation_id IS NULL AND (pe.profile_id=NEW.user_id OR pe.id=NEW.person_id) AND x.project_id=NEW.project_id)) AND x.hiring_engagement_id IS NOT NULL LOOP
 PERFORM id FROM hiring_engagements WHERE id=a.hiring_engagement_id FOR UPDATE;SELECT * INTO a FROM people_allocations WHERE id=a.id;
 IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=a.workspace_id AND lifecycle_gate_enabled) AND NEW.allocation_id=a.id AND ((NEW.person_id IS NOT NULL AND NEW.person_id<>a.person_id) OR NEW.project_id IS DISTINCT FROM a.project_id) THEN RAISE EXCEPTION 'Pessoa/projeto diverge da alocação.';END IF;
 IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=a.workspace_id AND lifecycle_gate_enabled) AND NEW.allocation_id=a.id AND(NEW.entry_date<a.starts_at OR(a.ends_at IS NOT NULL AND NEW.entry_date>a.ends_at)) THEN RAISE EXCEPTION 'Horas fora do período desta alocação; selecione origem válida.';END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND lifecycle_gate_enabled) AND NEW.allocation_id IS NULL AND EXISTS(SELECT 1 FROM people_allocations x JOIN people pe ON pe.id=x.person_id WHERE x.workspace_id=NEW.workspace_id AND x.project_id=NEW.project_id AND (pe.profile_id=NEW.user_id OR pe.id=NEW.person_id) AND x.hiring_engagement_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM people_allocations x JOIN people pe ON pe.id=x.person_id JOIN hiring_engagements e ON e.id=x.hiring_engagement_id WHERE x.workspace_id=NEW.workspace_id AND x.project_id=NEW.project_id AND (pe.profile_id=NEW.user_id OR pe.id=NEW.person_id) AND x.status::text='active' AND x.can_track_time AND x.starts_at<=NEW.entry_date AND(x.ends_at IS NULL OR x.ends_at>=NEW.entry_date) AND e.starts_at<=NEW.entry_date AND(e.ends_at IS NULL OR e.ends_at>=NEW.entry_date)) THEN RAISE EXCEPTION 'Horas posteriores ao corte sem origem válida.';END IF;RETURN NEW;
END $$;
CREATE TRIGGER zzzzzzz_hiring_lifecycle_time BEFORE INSERT OR UPDATE ON public.project_time_entries FOR EACH ROW EXECUTE FUNCTION public.hiring_lifecycle_time_guard();

-- No broad legacy operation may bypass an approved scope/date.
CREATE OR REPLACE FUNCTION public.hiring_lifecycle_legacy_block(w uuid,person uuid,operation text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND lifecycle_gate_enabled) AND (operation='cancel_payable_schedules' OR EXISTS(SELECT 1 FROM hiring_engagements WHERE workspace_id=w AND person_id=person AND status='active')) THEN RAISE EXCEPTION 'Use a prévia e aprovação do ciclo de vida; desligamento amplo automático está bloqueado.';END IF;
END $$;
-- Patch the existing canonical functions additively; preserve prior boundaries/behavior elsewhere.
DO $patch$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.hiring_employment_context(uuid,uuid,uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'RETURN jsonb_build_object(','RETURN jsonb_build_object(''lifecycle_enabled'',EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND lifecycle_gate_enabled),');EXECUTE definition;
 SELECT pg_get_functiondef('public.contract_workflow_terminate(uuid,uuid,date,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'BEGIN',E'BEGIN\n PERFORM public.hiring_lifecycle_legacy_block((SELECT workspace_id FROM people WHERE id=p_person),p_person,\'terminate_contracts\');');EXECUTE definition;
 SELECT pg_get_functiondef('public.hiring_employment_end(uuid,uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'BEGIN',E'BEGIN\n PERFORM public.hiring_lifecycle_legacy_block(w,(SELECT person_id FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w),\'end_engagement\');');EXECUTE definition;
 SELECT pg_get_functiondef('public.hiring_financial_entry_guard()'::regprocedure) INTO definition;
 definition:=replace(definition,'BEGIN',E'BEGIN\n IF TG_OP=\'UPDATE\' AND coalesce(current_setting(\'app.hiring_lifecycle\',true),\'\')=\'on\' AND NEW.status::text=\'cancelled\' AND OLD.status::text IN(\'open\',\'overdue\') AND (to_jsonb(NEW)-ARRAY[\'status\',\'updated_at\'])=(to_jsonb(OLD)-ARRAY[\'status\',\'updated_at\']) THEN RETURN NEW;END IF;');EXECUTE definition;
 SELECT pg_get_functiondef('public.hiring_allocation_guard()'::regprocedure) INTO definition;
 definition:=replace(definition,'BEGIN',E'BEGIN\n IF coalesce(current_setting(\'app.hiring_lifecycle\',true),\'\')=\'on\' AND TG_OP=\'UPDATE\' AND (to_jsonb(NEW)-ARRAY[\'ends_at\',\'status\',\'can_track_time\',\'updated_at\'])=(to_jsonb(OLD)-ARRAY[\'ends_at\',\'status\',\'can_track_time\',\'updated_at\']) AND NEW.ends_at>=OLD.starts_at AND (OLD.ends_at IS NULL OR NEW.ends_at<=OLD.ends_at) THEN RETURN NEW;END IF;');EXECUTE definition;
END $patch$;
CREATE OR REPLACE FUNCTION public.hiring_lifecycle_row_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND lifecycle_gate_enabled) AND coalesce(current_setting('app.hiring_lifecycle',true),'')<>'on' THEN
  IF TG_TABLE_NAME='hiring_engagements' AND (NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.status IS DISTINCT FROM OLD.status OR NEW.starts_at IS DISTINCT FROM OLD.starts_at) THEN RAISE EXCEPTION 'Alteração de vigência exige ciclo de vida aprovado.';END IF;
  IF TG_TABLE_NAME='people_allocations' THEN IF OLD.hiring_engagement_id IS NOT NULL AND (NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.status IS DISTINCT FROM OLD.status OR NEW.can_track_time IS DISTINCT FROM OLD.can_track_time) THEN RAISE EXCEPTION 'Alteração da alocação exige ciclo de vida aprovado.';END IF;END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_lifecycle_engagement BEFORE UPDATE ON public.hiring_engagements FOR EACH ROW EXECUTE FUNCTION public.hiring_lifecycle_row_guard();
CREATE TRIGGER zzzzzzz_hiring_lifecycle_allocation BEFORE UPDATE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_lifecycle_row_guard();
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure s,p.proname n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname LIKE 'hiring_lifecycle_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.s);IF f.n IN('hiring_lifecycle_access','hiring_lifecycle_preview','hiring_lifecycle_request','hiring_lifecycle_decide','hiring_lifecycle_apply','hiring_lifecycle_context') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.s);END IF;END LOOP;END $$;
GRANT EXECUTE ON FUNCTION public.hiring_lifecycle_legacy_block(uuid,uuid,text) TO service_role;
