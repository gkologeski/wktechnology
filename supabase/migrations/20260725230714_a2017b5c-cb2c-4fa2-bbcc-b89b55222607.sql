
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['ai_summaries','credit_ledger','credit_limits','email_tracking_events','hubspot_sync_state','message_sentiments','property_history','score_events','scoring_cursors','scoring_rules','stage_entries','workflow_events'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ws_insert_%1$I ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY ws_insert_%1$I ON public.%1$I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()))',
      t
    );
  END LOOP;
END $$;
