-- Durable commercial handoffs. No grants to roles/workspaces and no automatic customer sends.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES('techcontracts.handoffs.manage.workspace','techcontracts','handoffs','manage','workspace','Configurar e reprocessar encaminhamentos contratuais','Responsáveis, prazos úteis e fila comercial do workspace. Não aprova documentos nem envia convites.',true) ON CONFLICT(key) DO NOTHING;
CREATE TABLE public.contract_handoff_settings(
 workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,legal_user_id uuid,finance_user_id uuid,signature_user_id uuid,escalation_user_id uuid,operator_user_id uuid,
 legal_days int NOT NULL DEFAULT 1 CHECK(legal_days BETWEEN 1 AND 30),finance_days int NOT NULL DEFAULT 1 CHECK(finance_days BETWEEN 1 AND 30),signature_days int NOT NULL DEFAULT 1 CHECK(signature_days BETWEEN 1 AND 30),
 timezone text NOT NULL DEFAULT 'America/Sao_Paulo',updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contract_handoffs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,proposal_id uuid, draft_id uuid,contract_id uuid,
 step text NOT NULL CHECK(step IN('legal','finance','signature','approval_legal','approval_finance')),source_id uuid NOT NULL,cycle text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','pending','blocked','done','canceled')),
 actor_id uuid,requested_user_id uuid,assignee_id uuid,assignee_name text,activity_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 subject text NOT NULL,body text NOT NULL DEFAULT '',href text NOT NULL,due_at timestamptz NOT NULL,
 blocked_reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz,
 next_check_at timestamptz NOT NULL DEFAULT now(),escalated_at timestamptz,attempt int NOT NULL DEFAULT 0,
 UNIQUE(workspace_id,step,source_id,cycle)
);
CREATE INDEX contract_handoffs_deal ON public.contract_handoffs(workspace_id,deal_id,created_at DESC);
CREATE INDEX contract_handoffs_contract ON public.contract_handoffs(workspace_id,contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX contract_handoffs_worker ON public.contract_handoffs(next_check_at) WHERE status IN('queued','pending','blocked');
CREATE TABLE public.contract_handoff_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,handoff_id uuid REFERENCES public.contract_handoffs(id) ON DELETE CASCADE,actor_id uuid,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.contract_handoff_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_handoff_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_handoff_settings,public.contract_handoffs,public.contract_handoff_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_handoff_settings,public.contract_handoffs,public.contract_handoff_events TO authenticated;
GRANT ALL ON public.contract_handoff_settings,public.contract_handoffs,public.contract_handoff_events TO service_role;
CREATE POLICY contract_handoff_settings_read ON public.contract_handoff_settings FOR SELECT TO authenticated USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND public.user_has_permission(auth.uid(),workspace_id,'techcontracts.handoffs.manage.workspace'));
-- Queue summaries inherit the exact commercial/contract source read, without exposing document body or prices.
CREATE POLICY contract_handoffs_read ON public.contract_handoffs FOR SELECT TO authenticated USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND public.is_workspace_member(workspace_id,auth.uid()) AND (public.sales_record_access('deals',deal_id,'view') OR (contract_id IS NOT NULL AND public.work_record_access('techcontracts.contracts',contract_id,'view')) OR public.user_has_permission(auth.uid(),workspace_id,'techcontracts.handoffs.manage.workspace')));
CREATE POLICY contract_handoff_events_read ON public.contract_handoff_events FOR SELECT TO authenticated USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND (EXISTS(SELECT 1 FROM public.contract_handoffs h WHERE h.id=handoff_id) OR public.user_has_permission(auth.uid(),workspace_id,'techcontracts.handoffs.manage.workspace')));

CREATE OR REPLACE FUNCTION public.contract_handoff_due(p_at timestamptz,p_days int,p_zone text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE local_time timestamp:=p_at AT TIME ZONE p_zone;n int:=0;BEGIN
 IF p_days NOT BETWEEN 1 AND 30 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_zone) THEN RAISE EXCEPTION 'Prazo ou fuso inválido.';END IF;
 WHILE n<p_days LOOP local_time:=local_time+interval '1 day';IF extract(isodow from local_time)<6 THEN n:=n+1;END IF;END LOOP;
 RETURN local_time AT TIME ZONE p_zone;
END $$;
CREATE OR REPLACE FUNCTION public.contract_handoff_member(p_ws uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT p_user IS NOT NULL AND EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=p_user AND status='active') AND public.is_workspace_member(p_ws,p_user) $$;
CREATE OR REPLACE FUNCTION public.contract_handoff_user_ready(p_ws uuid,p_user uuid,p_step text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k text;BEGIN
 IF NOT contract_handoff_member(p_ws,p_user) THEN RETURN false;END IF;
 IF p_step='operator' THEN
  FOREACH k IN ARRAY ARRAY['techsales.tasks.create.workspace','techsales.tasks.assign.workspace','techsales.tasks.view.workspace','techsales.tasks.update.workspace','techsales.deals.view.workspace','techsales.proposals.view.workspace','techcontracts.contract_drafts.create.workspace','techcontracts.contract_drafts.view.workspace'] LOOP IF NOT user_has_permission(p_user,p_ws,k) THEN RETURN false;END IF;END LOOP;
  RETURN EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_ws AND user_id=p_user AND status='active' AND role::text IN('owner','admin')) AND user_has_permission(p_user,p_ws,'techcontracts.handoffs.manage.workspace');END IF;
 IF NOT (user_has_permission(p_user,p_ws,'techsales.tasks.view.own') OR user_has_permission(p_user,p_ws,'techsales.tasks.view.workspace')) THEN RETURN false;END IF;
 IF p_step='legal' THEN RETURN contract_draft_is_approver(p_ws,p_user) AND user_has_permission(p_user,p_ws,'techcontracts.contract_drafts.view.workspace') AND user_has_permission(p_user,p_ws,'techcontracts.approvals.approve.workspace');END IF;
 IF p_step IN('approval_legal','approval_finance') THEN RETURN user_has_permission(p_user,p_ws,'techcontracts.approvals.approve.workspace') AND user_has_permission(p_user,p_ws,'techcontracts.contracts.view.workspace');END IF;
 IF p_step='finance' THEN
  RETURN user_has_permission(p_user,p_ws,'techcontracts.contracts.view.workspace') AND (user_has_permission(p_user,p_ws,'techcontracts.contracts.create.workspace') OR user_has_permission(p_user,p_ws,'techcontracts.contracts.create.own')) AND user_has_permission(p_user,p_ws,'techcontracts.contract_drafts.view.workspace') AND user_has_permission(p_user,p_ws,'techcontracts.approvals.manage.workspace') AND user_has_permission(p_user,p_ws,'techcontracts.approvals.approve.workspace');
 END IF;
 IF p_step='signature' THEN
  FOREACH k IN ARRAY ARRAY['techcontracts.contracts.view.workspace','techcontracts.signature_evidence.view.workspace','techcontracts.signature_evidence.manage.workspace','techcontracts.esign.view.workspace','techcontracts.esign.manage.workspace','techcontracts.esign_send.manage.workspace'] LOOP IF NOT user_has_permission(p_user,p_ws,k) THEN RETURN false;END IF;END LOOP;
  RETURN user_has_permission(p_user,p_ws,'techcontracts.esign.create.workspace') OR user_has_permission(p_user,p_ws,'techcontracts.esign.create.own');
 END IF;RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.contract_handoff_settings_save(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(work_access_context()->>'workspace')::uuid;c public.contract_handoff_settings;u uuid;r text;BEGIN
 IF w IS NULL OR NOT contract_handoff_member(w,auth.uid()) OR is_read_only_view() OR NOT user_has_permission(auth.uid(),w,'techcontracts.handoffs.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para configurar encaminhamentos.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>4096 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN('enabled','legal_user_id','finance_user_id','signature_user_id','escalation_user_id','operator_user_id','legal_days','finance_days','signature_days','timezone')) THEN RAISE EXCEPTION 'Configuração inválida.';END IF;
 c.workspace_id:=w;c.enabled:=coalesce((p_data->>'enabled')::boolean,false);c.legal_user_id:=(p_data->>'legal_user_id')::uuid;c.finance_user_id:=(p_data->>'finance_user_id')::uuid;c.signature_user_id:=(p_data->>'signature_user_id')::uuid;c.escalation_user_id:=(p_data->>'escalation_user_id')::uuid;c.operator_user_id:=(p_data->>'operator_user_id')::uuid;
 c.legal_days:=coalesce((p_data->>'legal_days')::int,1);c.finance_days:=coalesce((p_data->>'finance_days')::int,1);c.signature_days:=coalesce((p_data->>'signature_days')::int,1);c.timezone:=coalesce(nullif(p_data->>'timezone',''),'America/Sao_Paulo');
 PERFORM contract_handoff_due(now(),c.legal_days,c.timezone);PERFORM contract_handoff_due(now(),c.finance_days,c.timezone);PERFORM contract_handoff_due(now(),c.signature_days,c.timezone);
 FOREACH u IN ARRAY ARRAY[c.legal_user_id,c.finance_user_id,c.signature_user_id,c.escalation_user_id,c.operator_user_id] LOOP IF u IS NOT NULL AND NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u) THEN RAISE EXCEPTION 'Responsável pertence a outro workspace.' USING ERRCODE='42501';END IF;END LOOP;
 IF c.enabled THEN
  IF NOT contract_handoff_user_ready(w,c.operator_user_id,'operator') OR NOT contract_handoff_user_ready(w,c.escalation_user_id,'operator') THEN RAISE EXCEPTION 'Operador e escalonamento precisam ser administradores ativos autorizados.';END IF;
  IF NOT contract_handoff_user_ready(w,c.legal_user_id,'legal') OR NOT contract_handoff_user_ready(w,c.finance_user_id,'finance') OR NOT contract_handoff_user_ready(w,c.signature_user_id,'signature') THEN RAISE EXCEPTION 'Há responsável inativo, fora do workspace ou sem as permissões da etapa. Corrija os acessos antes de ativar.';END IF;
 END IF;
 INSERT INTO contract_handoff_settings(workspace_id,enabled,legal_user_id,finance_user_id,signature_user_id,escalation_user_id,operator_user_id,legal_days,finance_days,signature_days,timezone,updated_by)
 VALUES(w,c.enabled,c.legal_user_id,c.finance_user_id,c.signature_user_id,c.escalation_user_id,c.operator_user_id,c.legal_days,c.finance_days,c.signature_days,c.timezone,auth.uid())
 ON CONFLICT(workspace_id) DO UPDATE SET enabled=excluded.enabled,legal_user_id=excluded.legal_user_id,finance_user_id=excluded.finance_user_id,signature_user_id=excluded.signature_user_id,escalation_user_id=excluded.escalation_user_id,operator_user_id=excluded.operator_user_id,legal_days=excluded.legal_days,finance_days=excluded.finance_days,signature_days=excluded.signature_days,timezone=excluded.timezone,updated_by=auth.uid(),updated_at=now();
 INSERT INTO contract_handoff_events(workspace_id,actor_id,kind,detail) VALUES(w,auth.uid(),'settings_changed',p_data);
 RETURN to_jsonb(c);
END $$;

-- Private enqueue accepts only source identifiers re-read from this workspace. It never creates arbitrary tasks.
CREATE OR REPLACE FUNCTION public.contract_handoff_enqueue(p_step text,p_source uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;deal uuid;proposal uuid;draft uuid;co uuid;cycle_key text;title text;at_time timestamptz;h uuid;s contract_handoff_settings;p proposals;d contract_drafts;c contracts;a contract_approvals;BEGIN
 IF p_step='legal' THEN
  SELECT * INTO p FROM proposals WHERE id=p_source;
  IF p.id IS NULL OR p.status::text<>'accepted' OR NOT coalesce(p.locked,false) OR p.decided_at IS NULL THEN RETURN NULL;END IF;
  IF EXISTS(SELECT 1 FROM contracts WHERE workspace_id=p.workspace_id AND proposal_id=p.id AND role::text='provider' AND document_kind='main') THEN RETURN NULL;END IF;
  w:=p.workspace_id;deal:=p.deal_id;proposal:=p.id;cycle_key:=p.version::text;title:='Revisar e encaminhar minuta ao cliente';at_time:=p.decided_at;
  SELECT * INTO d FROM contract_drafts WHERE workspace_id=w AND proposal_id=p.id AND status='changes_requested' ORDER BY updated_at DESC LIMIT 1;IF d.id IS NOT NULL THEN cycle_key:=cycle_key||':changes:'||d.revision;title:='Revisar ajustes solicitados pelo cliente na minuta';at_time:=coalesce(d.client_decided_at,now());END IF;
 ELSIF p_step='finance' THEN
  SELECT * INTO d FROM contract_drafts WHERE id=p_source;
  IF d.id IS NULL OR d.status<>'accepted' OR d.client_decided_at IS NULL THEN RETURN NULL;END IF;
  SELECT * INTO p FROM proposals WHERE id=d.proposal_id AND workspace_id=d.workspace_id;
  IF p.id IS NULL OR p.status::text<>'accepted' OR NOT coalesce(p.locked,false) THEN RETURN NULL;END IF;
  w:=d.workspace_id;deal:=d.deal_id;proposal:=p.id;draft:=d.id;cycle_key:=d.revision::text;title:='Preparar contrato e conduzir aprovações';at_time:=d.client_decided_at;
 ELSIF p_step IN('approval_legal','approval_finance') THEN
  SELECT * INTO a FROM contract_approvals WHERE id=p_source;
  IF a.id IS NULL OR a.superseded_at IS NOT NULL OR a.status::text<>'pending' OR ('approval_'||a.stage::text)<>p_step THEN RETURN NULL;END IF;
  SELECT * INTO c FROM contracts WHERE id=a.contract_id AND workspace_id=a.workspace_id AND role::text='provider' AND status::text='in_review';
  IF c.id IS NULL OR EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND sort_order<a.sort_order AND status::text<>'approved') THEN RETURN NULL;END IF;
  w:=c.workspace_id;deal:=c.deal_id;proposal:=c.proposal_id;co:=c.id;cycle_key:=coalesce(a.generation::text,a.id::text);title:=CASE p_step WHEN 'approval_legal' THEN 'Aprovar contrato — Jurídico' ELSE 'Aprovar contrato — Financeiro' END;at_time:=now();
 ELSIF p_step='signature' THEN
  SELECT * INTO c FROM contracts WHERE id=p_source;
  IF c.id IS NULL OR c.role::text<>'provider' OR c.status::text<>'awaiting_signature' THEN RETURN NULL;END IF;
  IF NOT EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND workspace_id=c.workspace_id AND superseded_at IS NULL AND stage::text='legal' AND status::text='approved') OR NOT EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND workspace_id=c.workspace_id AND superseded_at IS NULL AND stage::text='finance' AND status::text='approved') OR EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND status::text<>'approved') THEN RETURN NULL;END IF;
  w:=c.workspace_id;deal:=c.deal_id;proposal:=c.proposal_id;co:=c.id;SELECT coalesce(max(generation::text),'legacy')||':'||coalesce(max(decided_at)::text,'') INTO cycle_key FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL;title:='Conferir signatários e enviar contrato para assinatura';SELECT max(decided_at) INTO at_time FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL;
 ELSE RAISE EXCEPTION 'Etapa inválida.';END IF;
 SELECT * INTO s FROM contract_handoff_settings WHERE workspace_id=w AND enabled;
 IF s.workspace_id IS NULL OR deal IS NULL OR NOT EXISTS(SELECT 1 FROM deals WHERE id=deal AND workspace_id=w AND deleted_at IS NULL) THEN RETURN NULL;END IF;
 INSERT INTO contract_handoffs(workspace_id,deal_id,proposal_id,draft_id,contract_id,step,source_id,cycle,subject,href,due_at,requested_user_id,assignee_name)
 VALUES(w,deal,proposal,draft,co,p_step,p_source,cycle_key,title,CASE WHEN p_step='legal' THEN '/deals/'||deal WHEN p_step='finance' THEN '/deals/'||deal ELSE '/contracts/'||co END,contract_handoff_due(coalesce(at_time,now()),CASE p_step WHEN 'legal' THEN s.legal_days WHEN 'approval_legal' THEN s.legal_days WHEN 'finance' THEN s.finance_days WHEN 'approval_finance' THEN s.finance_days ELSE s.signature_days END,s.timezone),CASE WHEN p_step='legal' THEN s.legal_user_id WHEN p_step='finance' THEN s.finance_user_id WHEN p_step='signature' THEN s.signature_user_id ELSE coalesce(a.approver_id,CASE p_step WHEN 'approval_legal' THEN s.legal_user_id ELSE s.finance_user_id END) END,(SELECT full_name FROM profiles WHERE id=CASE WHEN p_step='legal' THEN s.legal_user_id WHEN p_step='finance' THEN s.finance_user_id WHEN p_step='signature' THEN s.signature_user_id ELSE coalesce(a.approver_id,CASE p_step WHEN 'approval_legal' THEN s.legal_user_id ELSE s.finance_user_id END) END))
 ON CONFLICT(workspace_id,step,source_id,cycle) DO UPDATE SET status='queued',due_at=excluded.due_at,closed_at=NULL,blocked_reason=NULL,escalated_at=NULL,next_check_at=now(),updated_at=now() WHERE contract_handoffs.status='canceled' RETURNING id INTO h;
 RETURN h;
END $$;
CREATE OR REPLACE FUNCTION public.contract_handoff_source_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE x record;BEGIN
 IF auth.uid() IS NOT NULL AND is_read_only_view() THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='proposals' THEN PERFORM contract_handoff_enqueue('legal',NEW.id);
 ELSIF TG_TABLE_NAME='contract_approvals' THEN
  FOR x IN SELECT id,stage FROM contract_approvals WHERE contract_id=NEW.contract_id AND workspace_id=NEW.workspace_id AND superseded_at IS NULL AND status::text='pending' LOOP IF x.stage::text IN('legal','finance') THEN PERFORM contract_handoff_enqueue('approval_'||x.stage::text,x.id);END IF;END LOOP;
 ELSIF TG_TABLE_NAME='contract_drafts' THEN IF NEW.status='changes_requested' THEN PERFORM contract_handoff_enqueue('legal',NEW.proposal_id);ELSE PERFORM contract_handoff_enqueue('finance',NEW.id);END IF;
 ELSE
  UPDATE contract_handoffs SET contract_id=NEW.id WHERE workspace_id=NEW.workspace_id AND proposal_id=NEW.proposal_id AND step='finance' AND status IN('queued','pending','blocked');
  PERFORM contract_handoff_enqueue('signature',NEW.id);
  IF NEW.status::text='in_review' THEN FOR x IN SELECT id,stage FROM contract_approvals WHERE contract_id=NEW.id AND workspace_id=NEW.workspace_id AND superseded_at IS NULL AND status::text='pending' LOOP IF x.stage::text IN('legal','finance') THEN PERFORM contract_handoff_enqueue('approval_'||x.stage::text,x.id);END IF;END LOOP;END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_handoff_approval_event AFTER INSERT OR UPDATE OF status,superseded_at,approver_id ON public.contract_approvals FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_source_event();
CREATE TRIGGER contract_handoff_proposal AFTER INSERT OR UPDATE OF status,locked,decided_at ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_source_event();
CREATE TRIGGER contract_handoff_draft AFTER INSERT OR UPDATE OF status,client_decided_at ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_source_event();
CREATE TRIGGER contract_handoff_contract AFTER INSERT OR UPDATE OF status ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_source_event();

-- Assign the existing, unchanged approval chain to configured people. This does not approve any step.
CREATE OR REPLACE FUNCTION public.contract_handoff_approval_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s contract_handoff_settings;u uuid;BEGIN
 SELECT x.* INTO s FROM contract_handoff_settings x JOIN contracts c ON c.workspace_id=x.workspace_id WHERE c.id=NEW.contract_id AND c.workspace_id=NEW.workspace_id AND c.role::text='provider' AND x.enabled;
 IF s.workspace_id IS NOT NULL AND NEW.approver_id IS NULL THEN
  u:=CASE NEW.stage::text WHEN 'legal' THEN s.legal_user_id WHEN 'finance' THEN s.finance_user_id END;
  IF contract_handoff_member(NEW.workspace_id,u) AND user_has_permission(u,NEW.workspace_id,'techcontracts.approvals.approve.workspace') THEN NEW.approver_id:=u;IF NEW.assigned_to IS NULL THEN NEW.assigned_to:=u;END IF;END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER contract_handoff_approval_owner BEFORE INSERT ON public.contract_approvals FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_approval_owner();

-- Source truth: task completion never substitutes an approval or an actual successful send.
CREATE OR REPLACE FUNCTION public.contract_handoff_state(p_h public.contract_handoffs)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;d contract_drafts;a contract_approvals;BEGIN
 IF NOT EXISTS(SELECT 1 FROM proposals WHERE id=p_h.proposal_id AND workspace_id=p_h.workspace_id AND status::text='accepted' AND locked) AND p_h.proposal_id IS NOT NULL THEN RETURN 'canceled';END IF;
 IF p_h.step='legal' THEN
  SELECT * INTO d FROM contract_drafts WHERE proposal_id=p_h.proposal_id AND workspace_id=p_h.workspace_id AND status NOT IN('rejected','canceled') ORDER BY created_at DESC LIMIT 1;
  IF d.status IN('sent','accepted') THEN RETURN 'done';END IF;RETURN 'pending';
 ELSIF p_h.step IN('approval_legal','approval_finance') THEN
  SELECT * INTO a FROM contract_approvals WHERE id=p_h.source_id AND workspace_id=p_h.workspace_id;
  IF a.id IS NULL OR a.superseded_at IS NOT NULL OR coalesce(a.generation::text,a.id::text)<>p_h.cycle OR a.status::text='rejected' THEN RETURN 'canceled';END IF;
  IF a.status::text='approved' THEN RETURN 'done';END IF;
  IF NOT EXISTS(SELECT 1 FROM contracts WHERE id=a.contract_id AND workspace_id=p_h.workspace_id AND status::text='in_review') THEN RETURN 'canceled';END IF;
  RETURN 'pending';
 ELSIF p_h.step='finance' THEN
  SELECT * INTO d FROM contract_drafts WHERE id=p_h.source_id AND workspace_id=p_h.workspace_id;
  IF d.id IS NULL OR d.status<>'accepted' OR d.revision::text<>p_h.cycle THEN RETURN 'canceled';END IF;
  SELECT * INTO c FROM contracts WHERE proposal_id=p_h.proposal_id AND workspace_id=p_h.workspace_id AND role::text='provider' AND document_kind='main' ORDER BY created_at DESC LIMIT 1;
  IF c.id IS NOT NULL AND c.status::text IN('awaiting_signature','active','renewing') AND EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND stage::text='legal' AND status::text='approved') AND EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND stage::text='finance' AND status::text='approved') AND NOT EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND status::text<>'approved') THEN RETURN 'done';END IF;RETURN 'pending';
 ELSE
  SELECT * INTO c FROM contracts WHERE id=p_h.contract_id AND workspace_id=p_h.workspace_id;
  IF c.id IS NULL OR c.status::text IN('draft','in_review','in_negotiation','terminated','ended','canceled') OR EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND status::text<>'approved') THEN RETURN 'canceled';END IF;
  IF EXISTS(SELECT 1 FROM contract_forsign_operations o WHERE o.workspace_id=p_h.workspace_id AND o.contract_id=c.id AND o.contract_hash=hiring_contract_fingerprint(c.id) AND o.operation_id IS NOT NULL AND o.status IN('sent','partially_signed','completed','evidence_recorded')) THEN RETURN 'done';END IF;
  IF EXISTS(SELECT 1 FROM hiring_contract_evidence e JOIN esign_documents doc ON doc.id=e.document_id WHERE e.workspace_id=p_h.workspace_id AND e.contract_id=c.id AND e.kind='native' AND e.revoked_at IS NULL AND e.contract_hash=hiring_contract_fingerprint(c.id) AND doc.status::text IN('sent','partially_signed','completed') AND NOT EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=doc.id AND z.workspace_id=p_h.workspace_id AND z.status::text IN('pending','viewed') AND NOT EXISTS(SELECT 1 FROM contract_esign_deliveries x WHERE x.document_id=doc.id AND x.signer_id=z.id AND x.workspace_id=p_h.workspace_id AND x.status='accepted')) AND EXISTS(SELECT 1 FROM contract_esign_deliveries x WHERE x.document_id=doc.id AND x.workspace_id=p_h.workspace_id AND x.status='accepted')) THEN RETURN 'done';END IF;
  RETURN 'pending';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.contract_handoff_task_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h contract_handoffs;BEGIN
 SELECT * INTO h FROM contract_handoffs WHERE activity_id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 IF h.id IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Tarefa controlada pela jornada. Use o encaminhamento para tratar a pendência.';END IF;
 IF NEW.workspace_id IS DISTINCT FROM h.workspace_id OR NEW.related_deal_id IS DISTINCT FROM h.deal_id OR NEW.owner_id IS DISTINCT FROM h.actor_id OR NEW.assigned_to IS DISTINCT FROM h.assignee_id OR NEW.due_date IS DISTINCT FROM h.due_at OR NEW.type::text<>'task' OR NEW.completed IS DISTINCT FROM (h.status IN('done','canceled')) OR (lower(coalesce(NEW.task_status,''))='completed') IS DISTINCT FROM (h.status IN('done','canceled')) OR NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Responsável, prazo e conclusão desta tarefa são controlados pelo encaminhamento e pela ação real na origem.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_handoff_task_guard BEFORE INSERT OR UPDATE OR DELETE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.contract_handoff_task_guard();

CREATE OR REPLACE FUNCTION public.contract_handoff_escalation(p_ws uuid,p_preferred uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid;BEGIN
 IF contract_handoff_user_ready(p_ws,p_preferred,'operator') THEN RETURN p_preferred;END IF;
 SELECT user_id INTO u FROM workspace_members WHERE workspace_id=p_ws AND status='active' AND role::text IN('owner','admin') AND contract_handoff_user_ready(p_ws,user_id,'operator') ORDER BY CASE role::text WHEN 'owner' THEN 0 ELSE 1 END,user_id LIMIT 1;RETURN u;
END $$;
CREATE OR REPLACE FUNCTION public.contract_handoff_block(p_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h contract_handoffs;s contract_handoff_settings;u uuid;BEGIN
 SELECT * INTO h FROM contract_handoffs WHERE id=p_id FOR UPDATE;IF h.id IS NULL OR h.status IN('done','canceled') THEN RETURN;END IF;
 SELECT * INTO s FROM contract_handoff_settings WHERE workspace_id=h.workspace_id;u:=contract_handoff_escalation(h.workspace_id,s.escalation_user_id);
 UPDATE contract_handoffs SET status='blocked',blocked_reason=left(p_reason,500),assignee_id=coalesce(u,assignee_id),actor_id=coalesce(u,actor_id),assignee_name=coalesce((SELECT full_name FROM profiles WHERE id=u),assignee_name),body='Resolver impedimento: '||left(p_reason,500)||E'\nOrigem: '||href,attempt=attempt+1,next_check_at=now()+interval '2 minutes',updated_at=now() WHERE id=h.id RETURNING * INTO h;
 IF u IS NOT NULL THEN
  INSERT INTO activities(id,workspace_id,owner_id,assigned_to,created_by,type,subject,body,due_date,completed,task_status,task_priority,related_deal_id,wa_reminders_disabled,external_ids) VALUES(h.activity_id,h.workspace_id,h.actor_id,h.assignee_id,h.actor_id,'task','Resolver impedimento contratual',h.body,h.due_at,false,'NOT_STARTED','HIGH',h.deal_id,true,jsonb_build_object('contract_handoff_id',h.id)) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,assigned_to=excluded.assigned_to,subject=excluded.subject,body=excluded.body,due_date=excluded.due_date,completed=false,task_status='NOT_STARTED';
  INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key) VALUES(u,u,h.workspace_id,'task','Encaminhamento contratual bloqueado',h.body,h.href,'deal',h.deal_id,'contract_handoff:'||h.id||':blocked:'||h.attempt) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO contract_handoff_events(workspace_id,handoff_id,actor_id,kind,detail) VALUES(h.workspace_id,h.id,h.actor_id,'blocked',jsonb_build_object('reason',left(p_reason,500),'assignee_id',h.assignee_id));
END $$;

-- Bounded service worker, revalidating configured actors and sources before each effect.
CREATE OR REPLACE FUNCTION public.contract_handoff_tick(p_limit int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h contract_handoffs;s contract_handoff_settings;target uuid;fallback uuid;state text;why text;r jsonb;processed int:=0;finished int:=0;blocked int:=0;BEGIN
 FOR h IN SELECT * FROM contract_handoffs WHERE status IN('queued','pending','blocked') AND next_check_at<=now() ORDER BY CASE status WHEN 'queued' THEN 0 ELSE 1 END,next_check_at,id LIMIT least(greatest(coalesce(p_limit,30),1),100) FOR UPDATE SKIP LOCKED LOOP
  processed:=processed+1;
  BEGIN
   SELECT * INTO s FROM contract_handoff_settings WHERE workspace_id=h.workspace_id;
   state:=contract_handoff_state(h);
   IF NOT coalesce(s.enabled,false) THEN state:='canceled';END IF;
   IF state IN('done','canceled') THEN
    UPDATE contract_handoffs SET status=state,closed_at=now(),updated_at=now() WHERE id=h.id;
    UPDATE activities SET completed=true,task_status='COMPLETED',body=coalesce(body,'')||CASE state WHEN 'canceled' THEN E'\nEncaminhamento cancelado: a origem deixou de atender às condições.' ELSE E'\nConcluído pela ação confirmada na origem.' END WHERE id=h.activity_id AND workspace_id=h.workspace_id;
    INSERT INTO contract_handoff_events(workspace_id,handoff_id,kind,detail) VALUES(h.workspace_id,h.id,state,'{}');finished:=finished+1;CONTINUE;
   END IF;
   IF h.status='blocked' THEN UPDATE contract_handoffs SET next_check_at=now()+interval '2 minutes' WHERE id=h.id;CONTINUE;END IF;
   IF h.status='queued' THEN
    target:=CASE h.step WHEN 'legal' THEN s.legal_user_id WHEN 'finance' THEN s.finance_user_id WHEN 'signature' THEN s.signature_user_id ELSE coalesce((SELECT approver_id FROM contract_approvals WHERE id=h.source_id AND workspace_id=h.workspace_id),CASE h.step WHEN 'approval_legal' THEN s.legal_user_id ELSE s.finance_user_id END) END;
    why:=NULL;
    IF NOT contract_handoff_user_ready(h.workspace_id,s.operator_user_id,'operator') THEN why:='Operador da automação inativo ou sem autorização.';
    ELSIF NOT contract_handoff_user_ready(h.workspace_id,target,h.step) THEN why:='Responsável da etapa inativo ou sem as permissões necessárias.';END IF;
    IF why IS NULL AND h.step='legal' THEN
     r:=contract_draft_open(h.workspace_id,h.proposal_id,s.operator_user_id);
     UPDATE contract_handoffs SET draft_id=(r->>'draft_id')::uuid,href='/contracts/drafts/'||(r->>'draft_id') WHERE id=h.id;
    END IF;
    IF why IS NULL AND h.step IN('approval_legal','approval_finance') THEN UPDATE contract_approvals SET approver_id=target,assigned_to=target WHERE id=h.source_id AND workspace_id=h.workspace_id AND approver_id IS NULL;END IF;
    fallback:=contract_handoff_escalation(h.workspace_id,s.escalation_user_id);
    UPDATE contract_handoffs SET actor_id=CASE WHEN contract_handoff_user_ready(h.workspace_id,s.operator_user_id,'operator') THEN s.operator_user_id WHEN contract_handoff_user_ready(h.workspace_id,fallback,'operator') THEN fallback END,requested_user_id=target,assignee_id=CASE WHEN why IS NULL THEN target ELSE fallback END,
      assignee_name=(SELECT full_name FROM profiles WHERE id=CASE WHEN why IS NULL THEN target ELSE fallback END),
      status=CASE WHEN why IS NULL THEN 'pending' ELSE 'blocked' END,blocked_reason=why,attempt=attempt+1,
      body=CASE WHEN why IS NULL THEN subject ELSE 'Resolver impedimento: '||why END||E'\nOrigem: '||href||E'\nPrazo: '||to_char(due_at AT TIME ZONE s.timezone,'DD/MM/YYYY HH24:MI')||' ('||s.timezone||').',updated_at=now(),next_check_at=now()+interval '2 minutes' WHERE id=h.id RETURNING * INTO h;
    IF h.assignee_id IS NOT NULL AND contract_handoff_member(h.workspace_id,h.assignee_id) AND contract_handoff_member(h.workspace_id,h.actor_id) THEN
     INSERT INTO activities(id,workspace_id,owner_id,assigned_to,created_by,type,subject,body,due_date,completed,task_status,task_priority,related_deal_id,remind_before_minutes,wa_reminders_disabled,external_ids)
     VALUES(h.activity_id,h.workspace_id,h.actor_id,h.assignee_id,h.actor_id,'task',CASE WHEN why IS NULL THEN h.subject ELSE 'Resolver impedimento contratual' END,h.body,h.due_at,false,'NOT_STARTED','HIGH',h.deal_id,60,true,jsonb_build_object('contract_handoff_id',h.id)) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,assigned_to=excluded.assigned_to,subject=excluded.subject,body=excluded.body,due_date=excluded.due_date,completed=false,task_status='NOT_STARTED',reminder_sent_at=NULL;
    END IF;
    IF h.assignee_id IS NOT NULL AND contract_handoff_member(h.workspace_id,h.assignee_id) THEN
     INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key) VALUES(h.assignee_id,h.assignee_id,h.workspace_id,'task',CASE WHEN why IS NULL THEN h.subject ELSE 'Encaminhamento contratual bloqueado' END,h.body,h.href,'deal',h.deal_id,'contract_handoff:'||h.id||':ready:'||h.attempt) ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO contract_handoff_events(workspace_id,handoff_id,actor_id,kind,detail) VALUES(h.workspace_id,h.id,h.actor_id,h.status,jsonb_build_object('assignee_id',h.assignee_id,'requested_user_id',target,'reason',why));
    IF why IS NOT NULL THEN blocked:=blocked+1;CONTINUE;END IF;
   END IF;
   IF NOT contract_handoff_user_ready(h.workspace_id,h.actor_id,'operator') OR NOT contract_handoff_user_ready(h.workspace_id,h.assignee_id,h.step) THEN
    PERFORM contract_handoff_block(h.id,'O operador ou responsável perdeu acesso ou foi desativado.');blocked:=blocked+1;CONTINUE;
   END IF;
   IF h.due_at<=now() AND h.escalated_at IS NULL THEN
    FOR target IN SELECT DISTINCT x FROM unnest(ARRAY[h.assignee_id,s.escalation_user_id]) x WHERE contract_handoff_member(h.workspace_id,x) LOOP
     INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key) VALUES(target,target,h.workspace_id,'task','Prazo vencido: '||h.subject,'O encaminhamento continua pendente. Responsável: '||coalesce(h.assignee_name,'não definido')||'. Abra a origem para concluir ou tratar o impedimento.',h.href,'deal',h.deal_id,'contract_handoff:'||h.id||':overdue:'||target) ON CONFLICT DO NOTHING;
    END LOOP;
    UPDATE contract_handoffs SET escalated_at=now() WHERE id=h.id;
   END IF;
   UPDATE contract_handoffs SET next_check_at=now()+interval '2 minutes',updated_at=now() WHERE id=h.id;
  EXCEPTION WHEN OTHERS THEN
   PERFORM contract_handoff_block(h.id,'Falha no processamento ('||SQLSTATE||'). Confira a origem e as permissões antes de reprocessar.');blocked:=blocked+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('processed',processed,'finished',finished,'blocked',blocked);
END $$;

CREATE OR REPLACE FUNCTION public.contract_handoff_retry(p_handoff uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h contract_handoffs;w uuid:=(work_access_context()->>'workspace')::uuid;BEGIN
 IF NOT contract_handoff_member(w,auth.uid()) OR is_read_only_view() OR NOT user_has_permission(auth.uid(),w,'techcontracts.handoffs.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para reprocessar encaminhamentos.' USING ERRCODE='42501';END IF;
 SELECT * INTO h FROM contract_handoffs WHERE id=p_handoff AND workspace_id=w FOR UPDATE;
 IF h.id IS NULL OR NOT sales_record_access('deals',h.deal_id,'view') OR h.status<>'blocked' THEN RAISE EXCEPTION 'Encaminhamento indisponível para reprocessar.';END IF;
 UPDATE contract_handoffs SET status='queued',next_check_at=now(),blocked_reason=NULL,updated_at=now() WHERE id=h.id;
 INSERT INTO contract_handoff_events(workspace_id,handoff_id,actor_id,kind) VALUES(w,h.id,auth.uid(),'retry_requested');
END $$;
CREATE OR REPLACE FUNCTION public.contract_handoff_reconcile(p_deal uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(work_access_context()->>'workspace')::uuid;x record;n int:=0;r uuid;BEGIN
 IF NOT contract_handoff_member(w,auth.uid()) OR is_read_only_view() OR NOT user_has_permission(auth.uid(),w,'techcontracts.handoffs.manage.workspace') OR NOT sales_record_access('deals',p_deal,'view') THEN RAISE EXCEPTION 'Sem acesso para conferir os encaminhamentos deste negócio.' USING ERRCODE='42501';END IF;
 FOR x IN SELECT id FROM proposals p WHERE workspace_id=w AND deal_id=p_deal AND status::text='accepted' AND NOT EXISTS(SELECT 1 FROM contracts c WHERE c.workspace_id=w AND c.proposal_id=p.id AND c.role::text='provider' AND c.document_kind='main') ORDER BY created_at DESC LIMIT 20 LOOP r:=contract_handoff_enqueue('legal',x.id);IF r IS NOT NULL THEN n:=n+1;END IF;END LOOP;
 FOR x IN SELECT id FROM contract_drafts WHERE workspace_id=w AND deal_id=p_deal AND status='accepted' ORDER BY created_at DESC LIMIT 20 LOOP r:=contract_handoff_enqueue('finance',x.id);IF r IS NOT NULL THEN n:=n+1;END IF;END LOOP;
 FOR x IN SELECT id FROM contracts WHERE workspace_id=w AND deal_id=p_deal AND role::text='provider' AND status::text='awaiting_signature' ORDER BY created_at DESC LIMIT 20 LOOP r:=contract_handoff_enqueue('signature',x.id);IF r IS NOT NULL THEN n:=n+1;END IF;END LOOP;
 FOR x IN SELECT a.id,a.stage FROM contract_approvals a JOIN contracts c ON c.id=a.contract_id AND c.workspace_id=a.workspace_id WHERE c.workspace_id=w AND c.deal_id=p_deal AND c.role::text='provider' AND c.status::text='in_review' AND a.superseded_at IS NULL AND a.status::text='pending' AND a.stage::text IN('legal','finance') ORDER BY a.sort_order LIMIT 40 LOOP r:=contract_handoff_enqueue('approval_'||x.stage::text,x.id);IF r IS NOT NULL THEN n:=n+1;END IF;END LOOP;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.contract_handoff_settings_get()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(work_access_context()->>'workspace')::uuid;BEGIN
 IF NOT contract_handoff_member(w,auth.uid()) OR NOT user_has_permission(auth.uid(),w,'techcontracts.handoffs.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para configurar encaminhamentos.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('settings',(SELECT to_jsonb(s) FROM contract_handoff_settings s WHERE s.workspace_id=w),'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.full_name,'legal',contract_handoff_user_ready(w,m.user_id,'legal'),'finance',contract_handoff_user_ready(w,m.user_id,'finance'),'signature',contract_handoff_user_ready(w,m.user_id,'signature'),'operator',contract_handoff_user_ready(w,m.user_id,'operator')) ORDER BY p.full_name) FROM workspace_members m JOIN profiles p ON p.id=m.user_id WHERE m.workspace_id=w AND m.status='active'),'[]'));
END $$;

REVOKE ALL ON FUNCTION public.contract_handoff_due(timestamptz,int,text),public.contract_handoff_member(uuid,uuid),public.contract_handoff_user_ready(uuid,uuid,text),public.contract_handoff_enqueue(text,uuid),public.contract_handoff_source_event(),public.contract_handoff_approval_owner(),public.contract_handoff_state(public.contract_handoffs),public.contract_handoff_task_guard(),public.contract_handoff_tick(int),public.contract_handoff_escalation(uuid,uuid),public.contract_handoff_block(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.contract_handoff_settings_save(jsonb),public.contract_handoff_settings_get(),public.contract_handoff_retry(uuid),public.contract_handoff_reconcile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_handoff_settings_save(jsonb),public.contract_handoff_settings_get(),public.contract_handoff_retry(uuid),public.contract_handoff_reconcile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_handoff_tick(int) TO service_role;
NOTIFY pgrst, 'reload schema';
