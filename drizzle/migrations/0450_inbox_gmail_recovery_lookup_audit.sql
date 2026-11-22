CREATE INDEX inbox_gmail_accepted_provider_lookup ON public.inbox_response_receipts(workspace_id,account_id,(transport_payload->>'provider_id')) WHERE origin='gmail_send' AND channel='email' AND transport_state='accepted' AND NOT(transport_payload ? 'acceptance_id');
CREATE OR REPLACE FUNCTION public.inbox_gmail_recovery_known(p_workspace uuid,p_account uuid,p_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM techerp_api.inbox_gmail_recovery_authorize(p_workspace,p_account);
 RETURN EXISTS(SELECT 1 FROM public.inbox_response_receipts r JOIN techerp_api.inbox_gmail_recovery q ON q.receipt_id=r.id
 WHERE r.workspace_id=p_workspace AND r.account_id=p_account AND r.origin='gmail_send' AND r.channel='email' AND r.transport_state='accepted'
 AND NOT(r.transport_payload ? 'acceptance_id') AND r.transport_payload->>'provider_id'=p_provider);
END $$;
CREATE FUNCTION public.inbox_gmail_recovery_status(p_workspace uuid,p_account uuid,p_receipt uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM techerp_api.inbox_gmail_recovery_authorize(p_workspace,p_account);
 SELECT jsonb_build_object('state',q.state,'attempts',q.attempts,'next_attempt_at',q.next_attempt_at,'last_error_code',q.last_error_code,'completed_at',q.completed_at,
 'audit',coalesce((SELECT jsonb_agg(jsonb_build_object('attempt',a.attempt,'outcome',a.outcome,'error_code',a.error_code,'started_at',a.started_at,'finished_at',a.finished_at) ORDER BY a.attempt)
 FROM techerp_api.inbox_gmail_recovery_attempts a WHERE a.receipt_id=q.receipt_id),'[]'::jsonb)) INTO result
 FROM techerp_api.inbox_gmail_recovery q WHERE q.receipt_id=p_receipt AND q.workspace_id=p_workspace AND q.account_id=p_account;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.inbox_gmail_recovery_status(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_gmail_recovery_status(uuid,uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.inbox_gmail_recovery_status(uuid,uuid,uuid) IS 'Authorized service-only diagnostics; queue state and SQLSTATE audit only, never private transport payload.';
NOTIFY pgrst,'reload schema';
