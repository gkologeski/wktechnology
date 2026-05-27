
DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'ai_summaries','api_keys','booking_pages','bookings','calendar_accounts',
    'calendar_events','contact_subscriptions','credit_ledger','credit_limits',
    'custom_object_records','custom_objects','custom_properties','custom_reports',
    'dashboard_widgets','dashboards','deal_line_items','email_accounts',
    'email_broadcast_recipients','email_broadcasts','email_messages','email_snippets',
    'email_templates','email_threads','email_tracking_events','email_unsubscribes',
    'enrichment_jobs','esign_audit','esign_documents','esign_signers',
    'form_submissions','forms','goals','hubspot_sync_state','integrations',
    'macros','message_sentiments','outbound_webhooks','pipelines',
    'playbook_responses','playbooks','products','property_history',
    'prospecting_results','prospecting_searches','push_subscriptions',
    'quote_line_items','quotes','record_layouts','recurring_plans',
    'report_schedules','rotation_rules','saved_views','score_events',
    'scoring_cursors','scoring_rules','segments','sequence_enrollments',
    'sequences','stage_entries','subscription_invoices','subscription_types',
    'subscriptions','survey_responses','task_queue_items','task_queues',
    'webhook_deliveries','whatsapp_campaign_recipients','whatsapp_campaigns',
    'whatsapp_conversations','whatsapp_messages','workflow_events',
    'workflow_runs','workflows','workspace_invites'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Trigger
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_workspace_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_workspace_%I BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert()',
      t, t
    );

    -- Limpa policies existentes
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      CREATE POLICY "ws_select_%1$s" ON public.%1$I
        FOR SELECT TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_insert_%1$s" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_update_%1$s" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
        WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_delete_%1$s" ON public.%1$I
        FOR DELETE TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);
  END LOOP;
END $$;
