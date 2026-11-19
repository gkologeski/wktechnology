-- APROVA-SOLICITA / package 3 batch 1. REVIEW ONLY: outside the automatic journal.
-- Depends on 0373/0374 and canonical hiring_area_policies; never seeds policies or grants roles.
BEGIN;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.approval_request.create.workspace','techpeople','hiring_requests.approval_request','create','workspace','Solicitar aprovação de profissional','Encaminhar a revisão salva ao gestor e CEO canônicos.',true),
('techpeople.hiring_requests.approval.approve.workspace','techpeople','hiring_requests.approval','approve','workspace','Decidir solicitação de profissional','Aprovador nomeado decide a revisão atual; sem autoaprovação.',true),
('techcontracts.supplier_requests.approval_request.create.workspace','techcontracts','supplier_requests.approval_request','create','workspace','Solicitar aprovação de fornecedor','Encaminhar a revisão salva ao gestor e CEO canônicos.',true),
('techcontracts.supplier_requests.approval.approve.workspace','techcontracts','supplier_requests.approval','approve','workspace','Decidir solicitação de fornecedor','Aprovador nomeado decide a revisão atual; sem autoaprovação.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.hiring_preparation_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
 request_id uuid NOT NULL, revision integer NOT NULL, reference_revision integer NOT NULL,
 policy_revision integer NOT NULL, policy_snapshot jsonb NOT NULL,
 requested_by uuid NOT NULL, manager_id uuid NOT NULL, ceo_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN('pending','approved','rejected','superseded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 UNIQUE(workspace_id,id), UNIQUE(request_id,revision,policy_revision)
);
REVOKE ALL ON public.hiring_preparation_approvals FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT SELECT ON public.hiring_preparation_approvals TO authenticated;
GRANT ALL ON public.hiring_preparation_approvals TO service_role;
ALTER TABLE public.hiring_preparation_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_read ON public.hiring_preparation_approvals FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_approvals.workspace_id));

CREATE TABLE public.hiring_preparation_approval_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, request_id uuid NOT NULL,
 approval_id uuid NOT NULL, revision integer NOT NULL, actor_id uuid NOT NULL,
 stage text CHECK(stage IN('manager','ceo')), kind text NOT NULL CHECK(kind IN('requested','approved','rejected','superseded')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=2000), operation_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,approval_id) REFERENCES public.hiring_preparation_approvals(workspace_id,id),
 UNIQUE(workspace_id,actor_id,operation_id)
);
REVOKE ALL ON public.hiring_preparation_approval_events FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT SELECT ON public.hiring_preparation_approval_events TO authenticated;
GRANT ALL ON public.hiring_preparation_approval_events TO service_role;
ALTER TABLE public.hiring_preparation_approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_event_read ON public.hiring_preparation_approval_events FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=request_id AND r.workspace_id=hiring_preparation_approval_events.workspace_id));
CREATE TRIGGER approval_event_immutable BEFORE UPDATE OR DELETE ON public.hiring_preparation_approval_events
 FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE UNIQUE INDEX preparation_approval_stage_once ON public.hiring_preparation_approval_events(approval_id,stage) WHERE stage IS NOT NULL;
CREATE UNIQUE INDEX preparation_approval_invalid_once ON public.hiring_preparation_approval_events(approval_id) WHERE kind='superseded';
CREATE INDEX preparation_approval_history ON public.hiring_preparation_approval_events(workspace_id,request_id,created_at DESC,id);

-- Narrow private counterfactual checks reuse the canonical resolver (active membership and deny).
-- Never expose another user's permission inventory or require an ATS job.
CREATE FUNCTION public.hiring_preparation_approval_subject(w uuid,u uuid,k text,a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT k IN('professional','supplier') AND a IN('view','request','approve','reference_view')
 AND EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=w AND user_id=u AND status='active')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) key WHERE key=
 CASE k WHEN 'professional' THEN 'techpeople.hiring_requests.' ELSE 'techcontracts.supplier_requests.' END ||
 CASE a WHEN 'view' THEN 'view' WHEN 'request' THEN 'approval_request.create' WHEN 'approve' THEN 'approval.approve' WHEN 'reference_view' THEN 'reference.view' END ||'.workspace');
$$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_subject(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE FUNCTION public.hiring_preparation_approval_access(w uuid,k text,a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a IN('view','request','approve') AND public.hiring_preparation_access(w,k,'view')
 AND (a='view' OR (NOT public.is_read_only_view() AND public.hiring_preparation_approval_subject(w,auth.uid(),k,a)));
$$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_access(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_approval_access(uuid,text,text) TO authenticated;

-- Resolves ONLY the configured principal, or the explicit substitute when the principal is a requester.
CREATE FUNCTION public.hiring_preparation_approval_route(p_ws uuid,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE r public.hiring_preparation_requests;p public.hiring_area_policies;m uuid;c uuid;u uuid;problem text;
BEGIN
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws;
 IF r.id IS NULL OR NOT public.hiring_preparation_approval_access(p_ws,r.kind,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.hiring_area_policies WHERE workspace_id=p_ws AND area_id=r.area_id;
 IF p.area_id IS NULL THEN RETURN jsonb_build_object('problem','Área sem alçada configurada. Solicite a configuração explícita do gestor, CEO e substitutos ao administrador autorizado.');END IF;
 m:=CASE WHEN p.manager_id IN(r.created_by,auth.uid()) THEN p.manager_delegate_id ELSE p.manager_id END;
 c:=CASE WHEN p.ceo_id IN(r.created_by,auth.uid()) THEN p.ceo_delegate_id ELSE p.ceo_id END;
 FOREACH u IN ARRAY ARRAY[m,c] LOOP
  IF u IS NULL OR u IN(r.created_by,auth.uid()) THEN problem:='Aprovador ausente ou solicitante. É necessário um substituto explicitamente configurado.';
  ELSIF NOT public.hiring_preparation_approval_subject(p_ws,u,r.kind,'view') OR NOT public.hiring_preparation_approval_subject(p_ws,u,r.kind,'approve') THEN problem:='Aprovador sem acesso ou permissão de decisão, ou membro inativo. Solicite regularização ao administrador autorizado.';
  ELSIF NOT public.hiring_preparation_approval_subject(p_ws,u,r.kind,'reference_view') THEN problem:='Aprovador sem acesso ao valor de referência. Solicite a permissão específica ao administrador autorizado.'; END IF;
  IF problem IS NOT NULL THEN EXIT;END IF;
 END LOOP;
 RETURN jsonb_build_object('problem',problem,'manager_id',m,'ceo_id',c,'policy_revision',p.revision,'policy_snapshot',to_jsonb(p));
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_route(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE FUNCTION public.hiring_preparation_approval_invalidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE x record;changed boolean;
BEGIN
 IF TG_TABLE_NAME='hiring_area_policies' THEN
  changed:=TG_OP='DELETE';
  IF TG_OP='UPDATE' THEN changed:=to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD);END IF;
  IF NOT changed THEN RETURN NEW;END IF;
  FOR x IN UPDATE public.hiring_preparation_approvals a SET status='superseded'
   WHERE a.workspace_id=OLD.workspace_id AND a.status IN('pending','approved')
   AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.id=a.request_id AND r.area_id=OLD.area_id)
   RETURNING a.* LOOP
   INSERT INTO public.hiring_preparation_approval_events(workspace_id,request_id,approval_id,revision,actor_id,kind)
   VALUES(x.workspace_id,x.request_id,x.id,x.revision,coalesce(auth.uid(),OLD.updated_by),'superseded');
  END LOOP;
 ELSE
  IF TG_TABLE_NAME='hiring_preparation_requests' THEN changed:=NEW.revision IS DISTINCT FROM OLD.revision;
  ELSE changed:=TG_OP='DELETE';IF TG_OP='UPDATE' THEN changed:=to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD);END IF;END IF;
  IF changed THEN
   FOR x IN UPDATE public.hiring_preparation_approvals a SET status='superseded'
    WHERE a.workspace_id=OLD.workspace_id AND a.request_id=CASE WHEN TG_TABLE_NAME='hiring_preparation_requests' THEN (to_jsonb(OLD)->>'id')::uuid ELSE (to_jsonb(OLD)->>'request_id')::uuid END
    AND a.status IN('pending','approved') RETURNING a.* LOOP
    INSERT INTO public.hiring_preparation_approval_events(workspace_id,request_id,approval_id,revision,actor_id,kind)
    VALUES(x.workspace_id,x.request_id,x.id,x.revision,coalesce(auth.uid(),x.requested_by),'superseded');
   END LOOP;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_invalidate() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER preparation_revision_invalidates_approval AFTER UPDATE ON public.hiring_preparation_requests FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_approval_invalidate();
CREATE TRIGGER preparation_value_invalidates_approval AFTER UPDATE OR DELETE ON public.hiring_preparation_reference_values FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_approval_invalidate();
CREATE TRIGGER preparation_policy_invalidates_approval AFTER UPDATE OR DELETE ON public.hiring_area_policies FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_approval_invalidate();

CREATE FUNCTION public.hiring_preparation_approval_notify(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE a public.hiring_preparation_approvals;r public.hiring_preparation_requests;stage text;u uuid;
BEGIN
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE id=p_id AND status='pending';IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=a.request_id AND workspace_id=a.workspace_id;
 stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events WHERE approval_id=a.id AND stage='manager' AND kind='approved') THEN 'ceo' ELSE 'manager' END;
 u:=CASE stage WHEN 'manager' THEN a.manager_id ELSE a.ceo_id END;
 IF NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'view') OR NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'approve') OR NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'reference_view') THEN RETURN;END IF;
 INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
 VALUES(a.workspace_id,u,u,'hiring_preparation_approval','Solicitação de contratação para aprovação','Abra a solicitação para revisar e registrar sua decisão.',
 CASE r.kind WHEN 'professional' THEN '/people/hiring-requests' ELSE '/contracts/supplier-requests' END||'?request='||r.id::text,
 'hiring_preparation_request',r.id,'preparation-approval:'||a.id::text||':'||stage)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_notify(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE FUNCTION public.hiring_preparation_approval_request(p_ws uuid,p_kind text,p_id uuid,p_revision integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE r public.hiring_preparation_requests;p public.hiring_area_policies;route jsonb;a public.hiring_preparation_approvals;ref integer;
BEGIN
 IF NOT public.hiring_preparation_approval_access(p_ws,p_kind,'request') THEN RAISE EXCEPTION 'Sem permissão para solicitar aprovação.' USING ERRCODE='42501';END IF;
 -- Policy first: serialize with canonical configuration before locking the request/cycle.
 SELECT hp.* INTO p FROM public.hiring_area_policies hp JOIN public.hiring_preparation_requests hr ON hr.area_id=hp.area_id AND hr.workspace_id=hp.workspace_id WHERE hr.id=p_id AND hr.workspace_id=p_ws AND hr.kind=p_kind FOR SHARE OF hp;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 IF r.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT: recarregue a solicitação.' USING ERRCODE='40001';END IF;
 IF r.status<>'ready' THEN RAISE EXCEPTION 'Salve a solicitação como pronta para aprovação.';END IF;
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE request_id=r.id AND revision=r.revision AND policy_revision=p.revision;
 IF FOUND THEN
  IF a.status IN('pending','approved') THEN RETURN a.id;END IF;
  RAISE EXCEPTION 'Edite a solicitação e salve nova revisão após rejeição ou invalidação.';
 END IF;
 route:=public.hiring_preparation_approval_route(p_ws,p_id);
 IF route->>'problem' IS NOT NULL THEN RAISE EXCEPTION '%',route->>'problem';END IF;
 IF p.area_id IS NULL OR to_jsonb(p) IS DISTINCT FROM route->'policy_snapshot' THEN RAISE EXCEPTION 'Alçada alterada; recarregue.' USING ERRCODE='40001';END IF;
 SELECT revision INTO ref FROM public.hiring_preparation_reference_values WHERE request_id=r.id AND workspace_id=p_ws;
 INSERT INTO public.hiring_preparation_approvals(workspace_id,request_id,revision,reference_revision,policy_revision,policy_snapshot,requested_by,manager_id,ceo_id,status)
 VALUES(p_ws,r.id,r.revision,coalesce(ref,0),p.revision,to_jsonb(p),auth.uid(),(route->>'manager_id')::uuid,(route->>'ceo_id')::uuid,'pending') RETURNING * INTO a;
 INSERT INTO public.hiring_preparation_approval_events(workspace_id,request_id,approval_id,revision,actor_id,kind)
 VALUES(p_ws,r.id,a.id,r.revision,auth.uid(),'requested');
 PERFORM public.hiring_preparation_approval_notify(a.id);RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_request(uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_approval_request(uuid,text,uuid,integer) TO authenticated;

CREATE FUNCTION public.hiring_preparation_approval_decide(p_ws uuid,p_kind text,p_id uuid,p_revision integer,p_approval uuid,p_stage text,p_decision text,p_note text,p_operation uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE a public.hiring_preparation_approvals;r public.hiring_preparation_requests;p public.hiring_area_policies;e public.hiring_preparation_approval_events;stage text;u uuid;ref integer;
BEGIN
 IF NOT public.hiring_preparation_approval_access(p_ws,p_kind,'approve') OR NOT public.hiring_preparation_access(p_ws,p_kind,'reference_view') THEN RAISE EXCEPTION 'Sem permissão para decidir ou consultar as condições.' USING ERRCODE='42501';END IF;
 IF p_operation IS NULL OR p_stage IS NULL OR p_stage NOT IN('manager','ceo') OR p_decision IS NULL OR p_decision NOT IN('approved','rejected') OR p_note IS NULL OR length(btrim(p_note))<5 OR length(p_note)>2000 THEN RAISE EXCEPTION 'Informe etapa, decisão e motivo (5 a 2000 caracteres).';END IF;
 SELECT hp.* INTO p FROM public.hiring_area_policies hp JOIN public.hiring_preparation_requests hr ON hr.area_id=hp.area_id AND hr.workspace_id=hp.workspace_id WHERE hr.id=p_id AND hr.workspace_id=p_ws AND hr.kind=p_kind FOR SHARE OF hp;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind FOR UPDATE;
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE id=p_approval AND request_id=p_id AND workspace_id=p_ws FOR UPDATE;
 IF r.id IS NULL OR a.id IS NULL OR auth.uid() IN(r.created_by,a.requested_by) THEN RAISE EXCEPTION 'Solicitação indisponível ou autoaprovação proibida.' USING ERRCODE='42501';END IF;
 SELECT revision INTO ref FROM public.hiring_preparation_reference_values WHERE request_id=r.id AND workspace_id=p_ws;
 IF r.status<>'ready' OR r.revision IS DISTINCT FROM p_revision OR a.revision<>r.revision OR a.policy_snapshot IS DISTINCT FROM to_jsonb(p) OR a.reference_revision<>coalesce(ref,0) OR a.status='superseded' THEN RAISE EXCEPTION 'REVISION_CONFLICT: aprovação invalidada; recarregue.' USING ERRCODE='40001';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_ws::text||auth.uid()::text||p_operation::text,0));
 SELECT * INTO e FROM public.hiring_preparation_approval_events WHERE workspace_id=p_ws AND actor_id=auth.uid() AND operation_id=p_operation;
 IF FOUND THEN
  IF e.approval_id<>a.id OR e.stage<>p_stage OR e.kind<>p_decision OR e.note<>btrim(p_note) THEN RAISE EXCEPTION 'Chave idempotente reutilizada com decisão diferente.';END IF;
  RETURN a.id;
 END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Aprovação já encerrada.';END IF;
 stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events WHERE approval_id=a.id AND stage='manager' AND kind='approved') THEN 'ceo' ELSE 'manager' END;
 u:=CASE stage WHEN 'manager' THEN a.manager_id ELSE a.ceo_id END;
 IF stage<>p_stage OR u IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Aguarde a etapa anterior ou o aprovador nomeado.' USING ERRCODE='42501';END IF;
 INSERT INTO public.hiring_preparation_approval_events(workspace_id,request_id,approval_id,revision,actor_id,stage,kind,note,operation_id)
 VALUES(p_ws,r.id,a.id,r.revision,auth.uid(),stage,p_decision,btrim(p_note),p_operation);
 IF p_decision='rejected' OR stage='ceo' THEN UPDATE public.hiring_preparation_approvals SET status=p_decision WHERE id=a.id;END IF;
 PERFORM public.hiring_preparation_approval_notify(a.id);RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_decide(uuid,text,uuid,integer,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_approval_decide(uuid,text,uuid,integer,uuid,text,text,text,uuid) TO authenticated;

CREATE FUNCTION public.hiring_preparation_approval_context(p_ws uuid,p_kind text,p_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE r public.hiring_preparation_requests;a public.hiring_preparation_approvals;p public.hiring_area_policies;route jsonb;stage text;u uuid;ref integer;problem text;valid boolean;
BEGIN
 IF p_offset<0 OR NOT public.hiring_preparation_approval_access(p_ws,p_kind,'view') THEN RAISE EXCEPTION 'Sem acesso à solicitação.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_ws AND kind=p_kind;IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE request_id=p_id AND workspace_id=p_ws ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT * INTO p FROM public.hiring_area_policies WHERE workspace_id=p_ws AND area_id=r.area_id;
 SELECT revision INTO ref FROM public.hiring_preparation_reference_values WHERE request_id=p_id AND workspace_id=p_ws;
 valid:=a.id IS NOT NULL AND a.revision=r.revision AND a.reference_revision=coalesce(ref,0) AND a.policy_snapshot=to_jsonb(p) AND r.status='ready' AND a.status<>'superseded';
 route:=public.hiring_preparation_approval_route(p_ws,p_id);problem:=route->>'problem';
 IF valid AND a.status='pending' THEN
  stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events WHERE approval_id=a.id AND stage='manager' AND kind='approved') THEN 'ceo' ELSE 'manager' END;
  u:=CASE stage WHEN 'manager' THEN a.manager_id ELSE a.ceo_id END;
  problem:=NULL;
  IF NOT public.hiring_preparation_approval_subject(p_ws,u,p_kind,'view') OR NOT public.hiring_preparation_approval_subject(p_ws,u,p_kind,'approve') OR NOT public.hiring_preparation_approval_subject(p_ws,u,p_kind,'reference_view') THEN problem:='Aprovador nomeado sem acesso, permissão ou membership ativo. Regularize o acesso; não há substituição automática.';END IF;
 END IF;
 IF r.status<>'ready' THEN problem:='Salve a solicitação como pronta para aprovação.';
 ELSIF a.id IS NOT NULL AND (NOT coalesce(valid,false) OR a.status='rejected') THEN problem:=coalesce(problem,'Decisões anteriores não valem para a revisão atual. Salve uma nova revisão ou solicite novamente após alteração da alçada.');END IF;
 RETURN jsonb_build_object('request',to_jsonb(r),'status',CASE WHEN a.id IS NULL THEN 'not_requested' WHEN NOT coalesce(valid,false) THEN 'superseded' ELSE a.status END,
 'approval_id',a.id,'stage',stage,'approver_id',u,'manager_id',CASE WHEN valid THEN a.manager_id ELSE (route->>'manager_id')::uuid END,'ceo_id',CASE WHEN valid THEN a.ceo_id ELSE (route->>'ceo_id')::uuid END,
 'problem',problem,'can_request',public.hiring_preparation_approval_access(p_ws,p_kind,'request') AND r.status='ready' AND route->>'problem' IS NULL AND (a.id IS NULL OR NOT coalesce(valid,false)),
 'can_decide',coalesce(valid,false) AND a.status='pending' AND u=auth.uid() AND auth.uid() NOT IN(r.created_by,a.requested_by) AND problem IS NULL AND public.hiring_preparation_approval_access(p_ws,p_kind,'approve') AND public.hiring_preparation_access(p_ws,p_kind,'reference_view'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id DESC) FROM (SELECT id,revision,actor_id,stage,kind,note,created_at FROM public.hiring_preparation_approval_events WHERE request_id=p_id AND workspace_id=p_ws ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET p_offset)x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.hiring_preparation_approval_context(uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_approval_context(uuid,text,uuid,integer) TO authenticated;
COMMIT;