-- A fully signed current native document also fulfills the send step; a removed deal cancels pending work.
CREATE OR REPLACE FUNCTION public.contract_handoff_state(p_h public.contract_handoffs)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;d contract_drafts;a contract_approvals;BEGIN
 IF NOT EXISTS(SELECT 1 FROM deals WHERE id=p_h.deal_id AND workspace_id=p_h.workspace_id AND deleted_at IS NULL) THEN RETURN 'canceled';END IF;
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
  IF EXISTS(SELECT 1 FROM hiring_contract_evidence e JOIN esign_documents doc ON doc.id=e.document_id WHERE e.workspace_id=p_h.workspace_id AND e.contract_id=c.id AND e.kind='native' AND e.revoked_at IS NULL AND e.contract_hash=hiring_contract_fingerprint(c.id) AND doc.status::text IN('sent','partially_signed','completed') AND ((doc.status::text='completed' AND EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=doc.id AND z.workspace_id=p_h.workspace_id) AND NOT EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=doc.id AND z.workspace_id=p_h.workspace_id AND z.status::text<>'signed')) OR (NOT EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=doc.id AND z.workspace_id=p_h.workspace_id AND z.status::text IN('pending','viewed') AND NOT EXISTS(SELECT 1 FROM contract_esign_deliveries x WHERE x.document_id=doc.id AND x.signer_id=z.id AND x.workspace_id=p_h.workspace_id AND x.status='accepted')) AND EXISTS(SELECT 1 FROM contract_esign_deliveries x WHERE x.document_id=doc.id AND x.workspace_id=p_h.workspace_id AND x.status='accepted')))) THEN RETURN 'done';END IF;
  RETURN 'pending';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.contract_handoff_state(public.contract_handoffs) FROM PUBLIC,anon,authenticated;
