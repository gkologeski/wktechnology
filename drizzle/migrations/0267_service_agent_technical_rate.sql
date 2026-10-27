-- Same existing technical per-conversation setting as WhatsApp; never commercial/follow-up quotas.
CREATE INDEX service_agent_sent_window ON public.service_agent_jobs(session_id,sent_at) WHERE status='sent';
CREATE FUNCTION public.service_agent_technical_limit(p_job uuid,p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;maximum integer;sent_count bigint;
BEGIN
 IF public.service_agent_guard(p_job,p_lease)<>'ok' THEN RAISE EXCEPTION 'Atendimento sem autorização atual.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job;
 SELECT coalesce(tech_conv_turns_per_hour,40) INTO maximum FROM public.sdr_workspace_settings WHERE workspace_id=j.workspace_id;
 SELECT count(*) INTO sent_count FROM public.service_agent_jobs WHERE session_id=j.session_id AND workspace_id=j.workspace_id AND status='sent' AND sent_at>=now()-interval '1 hour';
 RETURN sent_count>=coalesce(maximum,40);
END $$;
REVOKE ALL ON FUNCTION public.service_agent_technical_limit(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_technical_limit(uuid,uuid) TO service_role;
