
-- Include owner role in is_workspace_admin for consistency with v2
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace
       AND m.user_id = _user
       AND m.role IN ('owner','admin')
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _workspace
       AND w.created_by = _user
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
$function$;

-- bookings
DROP POLICY IF EXISTS ws_insert_bookings ON public.bookings;
CREATE POLICY ws_insert_bookings ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
);

-- meetings (preserve NULL-workspace admin branch)
DROP POLICY IF EXISTS ws_insert_meetings ON public.meetings;
CREATE POLICY ws_insert_meetings ON public.meetings
FOR INSERT TO authenticated
WITH CHECK (
  (
    owner_id = auth.uid()
    AND workspace_id IN (SELECT current_user_workspaces())
    AND user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.create.own')
  )
  OR (
    workspace_id IS NULL
    AND is_workspace_admin_of(owner_id, auth.uid())
  )
);

-- proposals
DROP POLICY IF EXISTS ws_insert_proposals ON public.proposals;
CREATE POLICY ws_insert_proposals ON public.proposals
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
);

-- tickets
DROP POLICY IF EXISTS ws_insert_tickets ON public.tickets;
CREATE POLICY ws_insert_tickets ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.create.own')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.manage.workspace')
  )
);

-- whatsapp_conversations
DROP POLICY IF EXISTS ws_insert_whatsapp_conversations ON public.whatsapp_conversations;
CREATE POLICY ws_insert_whatsapp_conversations ON public.whatsapp_conversations
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
);

-- whatsapp_messages
DROP POLICY IF EXISTS ws_insert_whatsapp_messages ON public.whatsapp_messages;
CREATE POLICY ws_insert_whatsapp_messages ON public.whatsapp_messages
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
);
