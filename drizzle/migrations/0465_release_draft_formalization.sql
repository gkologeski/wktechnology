CREATE OR REPLACE FUNCTION public.contract_release_draft_formalization(p_contract uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c contracts; f record; n integer := 0;
BEGIN
  SELECT * INTO c FROM contracts WHERE id = p_contract;
  IF c.id IS NULL OR NOT work_context_access(work_access_context(), c.workspace_id, 'techcontracts.contracts', 'delete', ARRAY[c.owner_id, c.assigned_to]) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este contrato' USING ERRCODE = '42501';
  END IF;
  FOR f IN SELECT * FROM hiring_formalizations WHERE contract_id = p_contract LOOP
    IF c.status <> 'draft' OR f.workspace_id <> c.workspace_id OR f.status <> 'editing'
       OR f.legal_at IS NOT NULL OR f.accepted_at IS NOT NULL OR f.finance_at IS NOT NULL THEN
      RAISE EXCEPTION 'Este contrato tem formalização em andamento e não pode ser excluído' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM hiring_formalizations WHERE request_id = f.request_id AND contract_id = p_contract;
    IF f.draft_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hiring_formalizations WHERE draft_id = f.draft_id) THEN
      DELETE FROM contract_drafts WHERE id = f.draft_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.contract_release_draft_formalization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_release_draft_formalization(uuid) TO authenticated;