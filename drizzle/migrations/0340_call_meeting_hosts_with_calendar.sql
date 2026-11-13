CREATE OR REPLACE FUNCTION public.call_meeting_hosts_with_calendar(_workspace uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Só ids (sem e-mail/token) de membros ativos com agenda Google conectada.
  SELECT DISTINCT ca.owner_id
  FROM public.calendar_accounts ca
  JOIN public.workspace_members wm
    ON wm.workspace_id = ca.workspace_id AND wm.user_id = ca.owner_id AND wm.status = 'active'
  WHERE ca.workspace_id = _workspace
    AND ca.provider = 'google'
    AND public.is_workspace_member(_workspace, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.call_meeting_hosts_with_calendar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_meeting_hosts_with_calendar(uuid) TO authenticated, service_role;