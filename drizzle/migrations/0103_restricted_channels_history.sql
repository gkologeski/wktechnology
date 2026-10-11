-- Extend the existing restricted_visibility contract to channels and history.
-- Restrictive SELECT policies only: never grant access that the current policies deny.
-- Unrestricted roles/admins retain their current access. No customer data is changed.
CREATE OR REPLACE FUNCTION public.rep_owns_entity(p_entity text, p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT CASE
    WHEN p_id IS NULL THEN false
    WHEN p_entity IN ('lead','leads') THEN p_id IN (SELECT public.rep_my_lead_ids())
    WHEN p_entity IN ('deal','deals') THEN p_id IN (SELECT public.rep_my_deal_ids())
    WHEN p_entity IN ('contact','contacts') THEN p_id IN (SELECT public.rep_my_contact_ids())
    WHEN p_entity IN ('company','companies') THEN p_id IN (SELECT public.rep_my_company_ids())
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.rep_owns_entity(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rep_owns_entity(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS rep_scope_select_email_threads ON public.email_threads;
CREATE POLICY rep_scope_select_email_threads ON public.email_threads AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
  OR public.rep_owns_entity('lead', lead_id) OR public.rep_owns_entity('deal', deal_id)
  OR public.rep_owns_entity('contact', contact_id) OR public.rep_owns_entity('company', company_id));

DROP POLICY IF EXISTS rep_scope_select_email_messages ON public.email_messages;
CREATE POLICY rep_scope_select_email_messages ON public.email_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR EXISTS (SELECT 1 FROM public.email_threads t WHERE t.id = email_messages.thread_id AND t.workspace_id = email_messages.workspace_id));

DROP POLICY IF EXISTS rep_scope_select_whatsapp_conversations ON public.whatsapp_conversations;
CREATE POLICY rep_scope_select_whatsapp_conversations ON public.whatsapp_conversations AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
  OR public.rep_owns_entity('lead', lead_id) OR public.rep_owns_entity('contact', contact_id));

DROP POLICY IF EXISTS rep_scope_select_whatsapp_messages ON public.whatsapp_messages;
CREATE POLICY rep_scope_select_whatsapp_messages ON public.whatsapp_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR EXISTS (SELECT 1 FROM public.whatsapp_conversations c WHERE c.id = whatsapp_messages.conversation_id AND c.workspace_id = whatsapp_messages.workspace_id));

DROP POLICY IF EXISTS rep_scope_select_calendar_events ON public.calendar_events;
CREATE POLICY rep_scope_select_calendar_events ON public.calendar_events AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR owner_id = auth.uid() OR public.rep_owns_entity('contact', related_contact_id)
  OR EXISTS (SELECT 1 FROM public.activities a WHERE a.id = calendar_events.related_activity_id AND a.workspace_id = calendar_events.workspace_id));

DROP POLICY IF EXISTS rep_scope_select_property_history ON public.property_history;
CREATE POLICY rep_scope_select_property_history ON public.property_history AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR public.rep_owns_entity(entity::text, entity_id));

DROP POLICY IF EXISTS rep_scope_select_stage_entries ON public.stage_entries;
CREATE POLICY rep_scope_select_stage_entries ON public.stage_entries AS RESTRICTIVE FOR SELECT TO authenticated
USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
  OR public.rep_owns_entity(entity::text, entity_id));
