-- Atribuição de responsável na Inbox guiada pela permissão "editar" do canal.
-- Altera apenas o campo responsável; RLS existente não muda.
CREATE OR REPLACE FUNCTION public.inbox_assign_conversation(p_channel text, p_id uuid, p_assignee uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws uuid;
  v_current uuid;
  v_ok boolean := false;
BEGIN
  IF v_uid IS NULL OR public.is_read_only_view() THEN RETURN false; END IF;
  IF p_channel NOT IN ('whatsapp','email','chat') THEN RETURN false; END IF;

  IF p_channel = 'whatsapp' THEN
    SELECT workspace_id, assigned_to INTO v_ws, v_current FROM public.whatsapp_conversations WHERE id = p_id;
  ELSIF p_channel = 'email' THEN
    SELECT workspace_id, assigned_to INTO v_ws, v_current FROM public.email_threads WHERE id = p_id;
  ELSE
    SELECT workspace_id, assignee_id INTO v_ws, v_current FROM public.live_chat_sessions WHERE id = p_id;
  END IF;
  IF v_ws IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.workspace_members
                  WHERE workspace_id = v_ws AND user_id = v_uid AND status = 'active') THEN
    RETURN false;
  END IF;

  IF v_ws IN (SELECT public.my_perm_workspaces('techsales.inbox.' || p_channel || '.update.workspace')) THEN
    v_ok := true;
  ELSIF v_ws IN (SELECT public.my_perm_workspaces('techsales.inbox.' || p_channel || '.update.team')) THEN
    v_ok := (v_current IS NULL OR v_current = v_uid OR v_current IN (SELECT public.my_team_member_ids()))
        AND (p_assignee IS NULL OR p_assignee = v_uid OR p_assignee IN (SELECT public.my_team_member_ids()));
  ELSIF v_ws IN (SELECT public.my_perm_workspaces('techsales.inbox.' || p_channel || '.update.own')) THEN
    v_ok := (v_current IS NULL OR v_current = v_uid) AND (p_assignee IS NULL OR p_assignee = v_uid);
  END IF;
  IF NOT v_ok THEN RETURN false; END IF;

  IF p_assignee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = v_ws AND user_id = p_assignee AND status <> 'inactive'
  ) AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_ws AND created_by = p_assignee) THEN
    RAISE EXCEPTION 'Selecione um membro ativo deste workspace.';
  END IF;

  IF p_channel = 'whatsapp' THEN
    UPDATE public.whatsapp_conversations SET assigned_to = p_assignee WHERE id = p_id;
  ELSIF p_channel = 'email' THEN
    UPDATE public.email_threads SET assigned_to = p_assignee WHERE id = p_id;
  ELSE
    UPDATE public.live_chat_sessions SET assignee_id = p_assignee WHERE id = p_id;
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.inbox_assign_conversation(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_assign_conversation(text, uuid, uuid) TO authenticated;
