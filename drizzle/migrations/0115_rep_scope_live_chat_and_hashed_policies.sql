-- 1) Chat ao vivo: cargo restrito só vê sessões ligadas a lead/contato próprio.
DROP POLICY IF EXISTS rep_scope_select_live_chat_sessions ON public.live_chat_sessions;
CREATE POLICY rep_scope_select_live_chat_sessions ON public.live_chat_sessions AS RESTRICTIVE FOR SELECT TO authenticated
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR (lead_id IN (SELECT public.rep_my_lead_ids()))
  OR (contact_id IN (SELECT public.rep_my_contact_ids())));
DROP POLICY IF EXISTS rep_scope_update_live_chat_sessions ON public.live_chat_sessions;
CREATE POLICY rep_scope_update_live_chat_sessions ON public.live_chat_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR (lead_id IN (SELECT public.rep_my_lead_ids()))
  OR (contact_id IN (SELECT public.rep_my_contact_ids())));
-- 2) Histórico: mesma regra de rep_owns_entity, avaliada uma vez por consulta em vez de por linha.
ALTER POLICY rep_scope_select_property_history ON public.property_history
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR (entity IN ('lead','leads') AND entity_id IN (SELECT public.rep_my_lead_ids()))
  OR (entity IN ('deal','deals') AND entity_id IN (SELECT public.rep_my_deal_ids()))
  OR (entity IN ('contact','contacts') AND entity_id IN (SELECT public.rep_my_contact_ids()))
  OR (entity IN ('company','companies') AND entity_id IN (SELECT public.rep_my_company_ids())));
-- 3) Registros de teste do "Ver como": lista lida uma vez por consulta.
CREATE OR REPLACE FUNCTION public.view_as_test_record_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT r.record_id FROM public.view_as_test_records r WHERE r.record_id IS NOT NULL $$;
REVOKE ALL ON FUNCTION public.view_as_test_record_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.view_as_test_record_ids() TO authenticated, service_role;
ALTER POLICY view_as_hide_test ON public.activities
USING ((public.current_role_test_session() IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));