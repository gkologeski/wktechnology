-- Service writers already insert audit events. An expression index evaluates
-- this pure input-only normalizer during INSERT/UPDATE; it reads no table.
GRANT EXECUTE ON FUNCTION public.shared_audit_workspace(jsonb,jsonb) TO service_role;
