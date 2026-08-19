-- 1. Trigger genérico de sincronização workspace_id <-> owner_id
CREATE OR REPLACE FUNCTION public.sync_workspace_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.workspace_id := NEW.owner_id;
  ELSIF NEW.owner_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
    NEW.owner_id := NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Coluna, backfill, FK, índice e trigger em cada tabela
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ads_accounts','ads_audiences','ads_lead_forms',
    'ab_tests','ab_test_events','attribution_touchpoints',
    'landing_pages','landing_page_events',
    'live_chat_sessions','live_chat_messages',
    'kb_categories','ats_sourcing_step_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', t);
    EXECUTE format('UPDATE public.%I SET workspace_id = owner_id WHERE workspace_id IS NULL', t);
    EXECUTE format('DELETE FROM public.%I WHERE workspace_id IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE',
      t, t || '_workspace_id_fkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)', 'idx_' || t || '_workspace_id', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_sync_workspace ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_sync_workspace BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_owner_id()',
      t, t);
  END LOOP;
END;
$$;

-- 3. Políticas reescritas com base em workspace_id

-- ads_accounts (administrador do workspace)
DROP POLICY IF EXISTS ads_admin_all ON public.ads_accounts;
CREATE POLICY ads_accounts_ws_admin_all ON public.ads_accounts
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

-- ads_audiences
DROP POLICY IF EXISTS ads_aud_member_all ON public.ads_audiences;
CREATE POLICY ads_audiences_ws_member_all ON public.ads_audiences
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- ads_lead_forms
DROP POLICY IF EXISTS ads_lf_member_all ON public.ads_lead_forms;
CREATE POLICY ads_lead_forms_ws_member_all ON public.ads_lead_forms
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- ab_tests
DROP POLICY IF EXISTS abt_member_all ON public.ab_tests;
CREATE POLICY ab_tests_ws_member_all ON public.ab_tests
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- ab_test_events
DROP POLICY IF EXISTS abte_member_all ON public.ab_test_events;
CREATE POLICY ab_test_events_ws_member_all ON public.ab_test_events
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- attribution_touchpoints
DROP POLICY IF EXISTS att_member_all ON public.attribution_touchpoints;
CREATE POLICY attribution_touchpoints_ws_member_all ON public.attribution_touchpoints
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- landing_pages
DROP POLICY IF EXISTS landing_pages_admin_delete ON public.landing_pages;
DROP POLICY IF EXISTS landing_pages_admin_select ON public.landing_pages;
DROP POLICY IF EXISTS landing_pages_admin_update ON public.landing_pages;
DROP POLICY IF EXISTS landing_pages_team_delete ON public.landing_pages;
DROP POLICY IF EXISTS landing_pages_team_update ON public.landing_pages;
DROP POLICY IF EXISTS lp_member_insert ON public.landing_pages;
DROP POLICY IF EXISTS lp_member_select ON public.landing_pages;

CREATE POLICY landing_pages_ws_select ON public.landing_pages
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY landing_pages_ws_insert ON public.landing_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND (public.is_workspace_admin_of(workspace_id, auth.uid())
             OR public.can_write_owner(workspace_id, auth.uid())))
  );

CREATE POLICY landing_pages_ws_update ON public.landing_pages
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND (public.is_workspace_admin_of(workspace_id, auth.uid())
             OR public.can_write_owner(workspace_id, auth.uid())))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND (public.is_workspace_admin_of(workspace_id, auth.uid())
             OR public.can_write_owner(workspace_id, auth.uid())))
  );

CREATE POLICY landing_pages_ws_delete ON public.landing_pages
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND (public.is_workspace_admin_of(workspace_id, auth.uid())
             OR public.can_write_owner(workspace_id, auth.uid())))
  );

-- landing_page_events (somente leitura para membros; escrita via servidor)
DROP POLICY IF EXISTS lpe_member_read ON public.landing_page_events;
CREATE POLICY landing_page_events_ws_select ON public.landing_page_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- live_chat_sessions
DROP POLICY IF EXISTS lcs_member_read ON public.live_chat_sessions;
DROP POLICY IF EXISTS lcs_member_update ON public.live_chat_sessions;
CREATE POLICY live_chat_sessions_ws_select ON public.live_chat_sessions
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY live_chat_sessions_ws_update ON public.live_chat_sessions
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- live_chat_messages
DROP POLICY IF EXISTS lcm_member_read ON public.live_chat_messages;
DROP POLICY IF EXISTS lcm_member_insert ON public.live_chat_messages;
CREATE POLICY live_chat_messages_ws_select ON public.live_chat_messages
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY live_chat_messages_ws_insert ON public.live_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- kb_categories
DROP POLICY IF EXISTS kbcat_member_read ON public.kb_categories;
DROP POLICY IF EXISTS kbcat_member_write ON public.kb_categories;
CREATE POLICY kb_categories_ws_select ON public.kb_categories
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY kb_categories_ws_write ON public.kb_categories
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));

-- ats_sourcing_step_log (remove atalho owner_id = auth.uid())
DROP POLICY IF EXISTS seq_log_workspace_select ON public.ats_sourcing_step_log;
DROP POLICY IF EXISTS seq_log_workspace_insert ON public.ats_sourcing_step_log;
CREATE POLICY ats_sourcing_step_log_ws_select ON public.ats_sourcing_step_log
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ats_sourcing_step_log_ws_insert ON public.ats_sourcing_step_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) OR workspace_id IN (SELECT public.current_user_workspaces()));