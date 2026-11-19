-- Package 5: new operations revalidate the current manager authority.
-- Prepared only; no historical start, engagement, allocations or permissions are rewritten.
CREATE OR REPLACE FUNCTION public.hiring_execution_activation_ok(w uuid,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_execution_starts s WHERE s.workspace_id=w AND s.contract_id=k AND s.contract_hash=hiring_contract_fingerprint(k)) AND hiring_formalization_signed(w,k) AND EXISTS(SELECT 1 FROM hiring_formalizations f JOIN hiring_execution_starts s ON s.request_id=f.request_id AND s.workspace_id=f.workspace_id JOIN hiring_preparation_requests r ON r.id=f.request_id AND r.workspace_id=f.workspace_id WHERE f.workspace_id=w AND f.contract_id=k AND s.request_revision=r.revision AND s.approval_id=f.approval_id AND hiring_formalization_valid(f.request_id) AND hiring_execution_problem(w,f.request_id) IS NULL)
$$;
-- CREATE OR REPLACE preserves owner and the existing private EXECUTE ACL.
NOTIFY pgrst,'reload schema';
