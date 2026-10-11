-- Mesma regra de rep_owns_entity (0103), reescrita para leitura única das listas próprias por consulta.
-- Não amplia acesso: conjuntos visíveis idênticos por usuário no harness isolado.
ALTER POLICY rep_scope_select_stage_entries ON public.stage_entries
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR (entity::text IN ('lead','leads') AND entity_id IN (SELECT public.rep_my_lead_ids()))
  OR (entity::text IN ('deal','deals') AND entity_id IN (SELECT public.rep_my_deal_ids()))
  OR (entity::text IN ('contact','contacts') AND entity_id IN (SELECT public.rep_my_contact_ids()))
  OR (entity::text IN ('company','companies') AND entity_id IN (SELECT public.rep_my_company_ids())));
ALTER POLICY rep_scope_select_email_threads ON public.email_threads
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
  OR lead_id IN (SELECT public.rep_my_lead_ids()) OR deal_id IN (SELECT public.rep_my_deal_ids())
  OR contact_id IN (SELECT public.rep_my_contact_ids()) OR company_id IN (SELECT public.rep_my_company_ids()));
ALTER POLICY rep_scope_select_whatsapp_conversations ON public.whatsapp_conversations
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
  OR lead_id IN (SELECT public.rep_my_lead_ids()) OR contact_id IN (SELECT public.rep_my_contact_ids()));
ALTER POLICY rep_scope_select_calendar_events ON public.calendar_events
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR owner_id = auth.uid() OR related_contact_id IN (SELECT public.rep_my_contact_ids())
  OR EXISTS (SELECT 1 FROM public.activities a WHERE a.id = calendar_events.related_activity_id AND a.workspace_id = calendar_events.workspace_id));