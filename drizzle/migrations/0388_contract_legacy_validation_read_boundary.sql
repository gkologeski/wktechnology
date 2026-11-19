-- Review complement: the commercial guard's boolean must not disclose a legacy
-- classification to a caller who cannot read the canonical contract.
-- Additive body-only replacement; already applied 0385–0387 stay immutable.
CREATE OR REPLACE FUNCTION public.contract_legacy_validated(p_contract uuid,w uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;ctx jsonb;
BEGIN
 -- Trusted service reads retain the existing bounded boolean exception. Both the
 -- signed claim and the actual selected database role must match (not a GUC alone).
 IF NOT (coalesce(auth.role()='service_role',false) AND current_setting('role',true)='service_role') THEN
  SELECT * INTO c FROM contracts WHERE id=p_contract AND workspace_id=w;
  ctx:=work_access_context();
  IF auth.uid() IS NULL OR c.id IS NULL OR NOT is_workspace_member(w,auth.uid())
   OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
   OR NOT EXISTS(SELECT 1 FROM workspaces WHERE id=w AND coalesce(status,'active')='active')
   OR NOT work_context_access(ctx,w,'techcontracts.contracts','view',ARRAY[coalesce(c.assigned_to,c.owner_id)]) THEN
   RETURN false;
  END IF;
 END IF;
 RETURN EXISTS(SELECT 1 FROM contract_legacy_records r JOIN contract_legacy_evidence e ON e.id=r.evidence_id AND e.status='used'
  WHERE r.contract_id=p_contract AND r.workspace_id=w AND r.status='regularized');
END $$;
-- No new privileges: preserve the existing authenticated/service-only helper ACL.
NOTIFY pgrst,'reload schema';
