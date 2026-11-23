CREATE OR REPLACE FUNCTION public.contract_draft_merge_source(p_draft uuid,p_template uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.contract_drafts;t public.contract_templates;r public.hiring_preparation_requests;
BEGIN
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR NOT contract_draft_is_approver(d.workspace_id,auth.uid()) OR is_read_only_view() THEN
  RAISE EXCEPTION 'Sem permissão para preparar o texto desta minuta.' USING ERRCODE='42501';END IF;
 SELECT * INTO t FROM contract_templates WHERE id=p_template AND workspace_id=d.workspace_id AND coalesce(status,'active')<>'archived';
 IF t.id IS NULL THEN RAISE EXCEPTION 'Modelo indisponível neste workspace.' USING ERRCODE='42501';END IF;
 SELECT q.* INTO r FROM hiring_formalizations f JOIN hiring_preparation_requests q ON q.id=f.request_id
  WHERE f.draft_id=d.id AND q.workspace_id=d.workspace_id LIMIT 1;
 RETURN jsonb_build_object('workspace_id',d.workspace_id,'proposal_id',d.proposal_id,'deal_id',d.deal_id,
  'prepared_terms',d.prepared_terms,'template',jsonb_build_object('id',t.id,'body_html',t.body_html,'defaults',t.defaults,'service_type',t.service_type),
  'supplier',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('company_id',r.company_id,'contact_id',r.contact_id,'legal_entity_id',r.legal_entity_id) END);
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_merge_source(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_merge_source(uuid,uuid) TO authenticated;