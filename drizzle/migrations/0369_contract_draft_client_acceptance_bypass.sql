INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.contract_draft_client_bypass.approve.workspace','techcontracts','contract_draft_client_bypass','approve','workspace','Dispensar aceite do cliente na minuta','Liberar a criação do contrato sem o aceite do cliente, após aprovação jurídica, com justificativa registrada no histórico.',true)
ON CONFLICT(key) DO NOTHING;

ALTER TABLE public.contract_drafts
  ADD COLUMN IF NOT EXISTS client_acceptance_bypassed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_acceptance_bypassed_by uuid,
  ADD COLUMN IF NOT EXISTS client_acceptance_bypass_reason text;

CREATE OR REPLACE FUNCTION public.contract_draft_bypass_client_acceptance(p_draft uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;u uuid:=auth.uid();moved boolean:=false;r text:=left(btrim(coalesce(p_reason,'')),2000);
BEGIN
 IF u IS NULL OR is_read_only_view() THEN RAISE EXCEPTION 'Sem permissão para dispensar o aceite.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid
   OR NOT contract_draft_is_approver(d.workspace_id,u)
   OR NOT user_has_permission(u,d.workspace_id,'techcontracts.contract_draft_client_bypass.approve.workspace') THEN
  RAISE EXCEPTION 'Sem permissão para dispensar o aceite do cliente.' USING ERRCODE='42501';END IF;
 IF d.status NOT IN('approved','sent') OR d.decided_at IS NULL THEN
  RAISE EXCEPTION 'A minuta precisa estar aprovada pelo Jurídico antes de dispensar o aceite.' USING ERRCODE='22023';END IF;
 IF length(r)<10 THEN RAISE EXCEPTION 'Explique o motivo da dispensa (mínimo 10 caracteres).' USING ERRCODE='22023';END IF;
 UPDATE contract_drafts SET status='accepted',client_decided_at=now(),client_name='Aceite dispensado',
  client_note=r,client_acceptance_bypassed_at=now(),client_acceptance_bypassed_by=u,client_acceptance_bypass_reason=r,
  revision=revision+1,updated_at=now() WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(d.workspace_id,d.id,u,'client_acceptance_bypassed',jsonb_build_object('reason',r));
 moved:=contract_draft_set_deal_substatus(d.id,'Contrato em elaboração');
 RETURN jsonb_build_object('id',d.id,'status','accepted','deal_moved',moved);
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_bypass_client_acceptance(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_bypass_client_acceptance(uuid,text) TO authenticated;