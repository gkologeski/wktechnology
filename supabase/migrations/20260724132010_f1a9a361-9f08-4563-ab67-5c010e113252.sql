
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['custom_properties','playbook_responses','task_queue_items','workflows','segments','goals','service_catalog','products','email_templates','booking_pages','report_schedules','subscription_types','recurring_plans','dunning_policies'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ws_insert_%1$s ON public.%1$s', t);
    EXECUTE format($f$CREATE POLICY ws_insert_%1$s ON public.%1$s FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()))$f$, t);
  END LOOP;
END $$;
