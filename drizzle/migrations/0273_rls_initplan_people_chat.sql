-- Performance only: same access semantics, evaluated once per query instead of once per row.
CREATE OR REPLACE FUNCTION public.hr_people_full_workspaces(_action text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT w FROM public.current_user_workspaces() w
   WHERE public.hr_scope_permission(w,'techpeople.people',_action,false,false)
$$;
REVOKE ALL ON FUNCTION public.hr_people_full_workspaces(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_people_full_workspaces(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.shared_chat_view_ids()
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE u uuid := (public.work_access_context()->>'actor')::uuid;
BEGIN
  RETURN QUERY SELECT m.conversation_id FROM public.chat_conversation_members m
   WHERE m.user_id = u AND public.shared_chat_access(m.conversation_id,'view');
END $$;
REVOKE ALL ON FUNCTION public.shared_chat_view_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_chat_view_ids() TO authenticated, service_role;

ALTER POLICY hr_view ON public.people USING (
  workspace_id IN (SELECT public.hr_people_full_workspaces('view'))
  OR public.hr_people_access(workspace_id,'view',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
ALTER POLICY hr_update ON public.people USING (
  workspace_id IN (SELECT public.hr_people_full_workspaces('update'))
  OR public.hr_people_access(workspace_id,'update',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)))
  WITH CHECK (
  workspace_id IN (SELECT public.hr_people_full_workspaces('update'))
  OR public.hr_people_access(workspace_id,'update',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
ALTER POLICY hr_delete ON public.people USING (
  workspace_id IN (SELECT public.hr_people_full_workspaces('delete'))
  OR public.hr_people_access(workspace_id,'delete',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));

ALTER POLICY shared_chat_read ON public.chat_messages USING (conversation_id IN (SELECT public.shared_chat_view_ids()));
ALTER POLICY shared_chat_read ON public.chat_conversation_members USING (conversation_id IN (SELECT public.shared_chat_view_ids()));
ALTER POLICY shared_chat_read ON public.chat_conversations USING (id IN (SELECT public.shared_chat_view_ids()));
