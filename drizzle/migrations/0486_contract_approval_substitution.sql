-- Explicit supervised substitution, independent from the approval decision.
-- No role or workspace is granted this sensitive capability automatically.
INSERT INTO public.permissions(key,module,resource,action,scope,label,description,is_sensitive)
VALUES('techcontracts.approval_substitution.manage.workspace','techcontracts','approval_substitution','manage','workspace',
 'Assumir etapa de aprovação de contrato','Assumir pessoalmente uma etapa pendente, com justificativa e histórico do responsável anterior. A decisão continua no nome de quem a realizar.',true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.contract_approval_substitution_authorize(p_contract uuid,p_write boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();w uuid;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 w:=public.work_area_authorize('techcontracts.contracts','view',p_contract);
 PERFORM public.work_area_authorize('techcontracts.approvals','view');
 IF NOT public.is_workspace_member(w,u) THEN RAISE EXCEPTION 'Membro ativo obrigatório.' USING ERRCODE='42501';END IF;
 IF p_write THEN
  IF public.is_read_only_view() OR NOT public.user_has_permission(u,w,'techcontracts.approval_substitution.manage.workspace')
   OR NOT public.user_has_permission(u,w,'techcontracts.approvals.manage.workspace')
   OR NOT public.user_has_permission(u,w,'techcontracts.approvals.approve.workspace')
   OR NOT public.work_record_access('techcontracts.contracts',p_contract,'update') THEN RAISE EXCEPTION 'Sem permissão para assumir esta aprovação.' USING ERRCODE='42501';END IF;
  PERFORM public.work_area_authorize('techcontracts.approvals','manage');
  PERFORM public.work_area_authorize('techcontracts.approvals','approve');
 END IF;
 RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.contract_approval_substitution_authorize(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_approval_substitution_context(p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;u uuid:=auth.uid();c contracts;allowed boolean;rows jsonb;BEGIN
 w:=public.contract_approval_substitution_authorize(p_contract);
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w;
 allowed:=NOT public.is_read_only_view()
  AND public.user_has_permission(u,w,'techcontracts.approval_substitution.manage.workspace')
  AND public.user_has_permission(u,w,'techcontracts.approvals.manage.workspace')
  AND public.user_has_permission(u,w,'techcontracts.approvals.approve.workspace')
  AND public.work_record_access('techcontracts.contracts',p_contract,'update');
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'stage',a.stage,'status',a.status,'approverId',a.approver_id,
  'approverName',(SELECT full_name FROM profiles WHERE id=a.approver_id),
  'canAssume',allowed AND c.status::text='in_review' AND a.status::text='pending' AND a.approver_id IS DISTINCT FROM u,
  'currentActorIsApprover',coalesce(a.approver_id=u,false),
  'orderBlockedReason',CASE WHEN EXISTS(SELECT 1 FROM contract_approvals prior WHERE prior.contract_id=c.id AND prior.workspace_id=w AND prior.superseded_at IS NULL AND prior.sort_order<a.sort_order AND prior.status::text<>'approved') THEN 'Conclua a etapa anterior antes de aprovar esta etapa.' END
 ) ORDER BY a.sort_order,a.id),'[]') INTO rows FROM (
  SELECT * FROM public.contract_approvals a WHERE a.contract_id=c.id AND a.workspace_id=w AND a.superseded_at IS NULL
   AND public.work_record_access('techcontracts.approvals',a.id,'view') ORDER BY a.sort_order,a.id LIMIT 50
 ) a;
 RETURN jsonb_build_object('canAssume',allowed AND c.status::text='in_review','approvals',rows);
END $$;
REVOKE ALL ON FUNCTION public.contract_approval_substitution_context(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_approval_substitution_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_approval_assume(p_contract uuid,p_approval uuid,p_expected_approver uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;u uuid:=auth.uid();c contracts;a contract_approvals;previous_approver uuid;previous_assigned uuid;h contract_handoffs;BEGIN
 w:=public.contract_approval_substitution_authorize(p_contract,true);
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Informe a justificativa da substituição (10 a 2000 caracteres).' USING ERRCODE='22023';END IF;
 -- Match the canonical decision and billing lock order: contract, then approval.
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 -- The worker owns a handoff before assigning an unclaimed approval. Never wait
 -- on that worker while holding its target approval: return a retryable conflict.
 BEGIN
  PERFORM 1 FROM public.contract_handoffs WHERE workspace_id=w AND contract_id=c.id AND source_id=p_approval
   AND step IN('approval_legal','approval_finance') AND status IN('queued','pending','blocked') FOR UPDATE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'Esta etapa está sendo atualizada pelo encaminhamento. Recarregue e tente novamente.' USING ERRCODE='23514';END;
 SELECT * INTO a FROM public.contract_approvals WHERE id=p_approval AND contract_id=c.id AND workspace_id=w FOR UPDATE;
 PERFORM public.contract_approval_substitution_authorize(p_contract,true);
 IF c.id IS NULL OR a.id IS NULL OR NOT public.work_record_access('techcontracts.approvals',a.id,'view') THEN RAISE EXCEPTION 'Aprovação indisponível.' USING ERRCODE='42501';END IF;
 IF c.status::text<>'in_review' OR a.status::text<>'pending' OR a.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Somente uma etapa pendente do processo atual em revisão pode ser assumida.' USING ERRCODE='23514';END IF;
 IF a.approver_id IS DISTINCT FROM p_expected_approver THEN RAISE EXCEPTION 'O responsável pela etapa mudou. Recarregue antes de assumir.' USING ERRCODE='23514';END IF;
 IF a.approver_id=u THEN RETURN public.contract_approval_substitution_context(c.id);END IF;
 previous_approver:=a.approver_id;previous_assigned:=a.assigned_to;
 UPDATE public.contract_approvals SET approver_id=u,assigned_to=u WHERE id=a.id;
 -- Keep an existing task with the real new approver, without changing the due
 -- date, creating a second task, or impersonating the automation's creator.
 FOR h IN SELECT * FROM public.contract_handoffs WHERE workspace_id=w AND contract_id=c.id AND source_id=a.id
  AND step='approval_'||a.stage::text AND cycle=coalesce(a.generation::text,a.id::text)
  AND status IN('queued','pending','blocked') FOR UPDATE LOOP
  UPDATE public.contract_handoffs SET requested_user_id=u,assignee_id=u,
   assignee_name=(SELECT full_name FROM public.profiles WHERE id=u),
   status=CASE WHEN status='blocked' THEN 'queued' ELSE status END,
   blocked_reason=NULL,next_check_at=now(),updated_at=now() WHERE id=h.id;
  UPDATE public.activities SET assigned_to=u WHERE id=h.activity_id AND workspace_id=w AND NOT coalesce(completed,false);
  INSERT INTO public.contract_handoff_events(workspace_id,handoff_id,actor_id,kind,detail)
   VALUES(w,h.id,u,'approver_substituted',jsonb_build_object('previous_assignee_id',h.assignee_id,'assignee_id',u,'approval_id',a.id,'reason',btrim(p_reason)));
 END LOOP;
 INSERT INTO public.contract_events(workspace_id,contract_id,actor_id,event_type,payload)
 VALUES(w,c.id,u,'approval_substituted',jsonb_build_object('approval_id',a.id,'stage',a.stage,'generation',a.generation,
  'previous_approver_id',previous_approver,'previous_assigned_to',previous_assigned,'acting_approver_id',u,
  'reason',btrim(p_reason),'decision_unchanged',true));
 RETURN public.contract_approval_substitution_context(c.id);
END $$;
REVOKE ALL ON FUNCTION public.contract_approval_assume(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_approval_assume(uuid,uuid,uuid,text) TO authenticated;

-- Some managed environments grant a BYPASSRLS sandbox principal SELECT/INSERT
-- on every new public table by default. Clear only these private feature tables;
-- do not change global defaults or grant any capability to another principal.
DO $private_acl$
DECLARE role_name text; table_name text;
BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN('sandbox_exec','techerp_request_writer') LOOP
  FOREACH table_name IN ARRAY ARRAY['contract_commercial_acceptances','contract_commercial_acceptance_links','contract_acceptance_billing_releases','service_execution_completions','contract_service_signature_anchors'] LOOP
   IF to_regclass(format('public.%I',table_name)) IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',table_name,role_name);
   END IF;
  END LOOP;
 END LOOP;
END $private_acl$;
