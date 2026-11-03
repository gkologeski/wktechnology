-- Envio automático é sempre ligado: o agente de e-mail/chat não depende mais das chaves legadas
-- sdr_workspace_settings.auto_send_enabled e sdr_playbooks.mode (removidas da interface).
-- Mantém todas as demais travas: conversa com a IA, identidade do canal, autorização do worker,
-- SDR habilitado no workspace e versão publicada do agente.
CREATE OR REPLACE FUNCTION public.service_agent_begin_send(p_job uuid)
RETURNS SETOF public.service_agent_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;s public.service_agent_sessions;e public.sdr_enrollments;
BEGIN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'ready' OR j.send_started_at IS NOT NULL THEN RETURN;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=j.workspace_id FOR SHARE;
 IF NOT FOUND OR s.ai_owner<>'ai' OR s.ai_version<>j.conversation_version THEN
  UPDATE public.service_agent_jobs SET status='skipped',error='conversation_changed' WHERE id=j.id;RETURN;END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=s.workspace_id;
 IF e.channel_identity IS NULL OR e.channel_identity->>'workspaceId' IS DISTINCT FROM s.workspace_id::text OR e.channel_identity->>'accountId' IS DISTINCT FROM s.account_id::text OR e.channel_identity->>'channel' IS DISTINCT FROM s.channel THEN
  UPDATE public.service_agent_jobs SET status='drafted',error='identity_unavailable' WHERE id=j.id;RETURN;END IF;
 IF NOT public.sales_worker_authorize('sdr_enrollments',e.id,'[]') OR NOT EXISTS(
  SELECT 1 FROM public.sdr_workspace_settings ws JOIN public.sdr_playbooks p ON p.workspace_id=ws.workspace_id
  JOIN public.sdr_agent_versions v ON v.playbook_id=p.id AND v.workspace_id=p.workspace_id AND v.status='published'
  WHERE ws.workspace_id=s.workspace_id AND ws.enabled AND p.id=e.playbook_id AND v.id=j.agent_version_id)
 THEN UPDATE public.service_agent_jobs SET status='drafted',error='automatic_send_unavailable' WHERE id=j.id;RETURN;END IF;
 UPDATE public.service_agent_jobs SET status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',
 send_token=gen_random_uuid(),send_started_at=now(),updated_at=now() WHERE id=j.id RETURNING * INTO j;
 RETURN NEXT j;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_begin_send(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_begin_send(uuid) TO service_role;
COMMENT ON COLUMN public.sdr_workspace_settings.auto_send_enabled IS 'DEPRECATED: envio automático é sempre ligado; não tem efeito no runtime.';
COMMENT ON COLUMN public.sdr_playbooks.mode IS 'DEPRECATED: envio automático é sempre ligado; não tem efeito no runtime.';