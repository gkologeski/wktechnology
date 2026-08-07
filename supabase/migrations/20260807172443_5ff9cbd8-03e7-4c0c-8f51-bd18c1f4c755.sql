-- 1) Canonical SELECT policy missing on custom_reports (legacy admin_select was the only read path)
CREATE POLICY "ws_select_custom_reports" ON public.custom_reports
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

-- 2) Drop legacy *_admin_* / *_team_* policies where the canonical ws_* set fully covers SELECT/INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS custom_object_records_admin_delete ON public.custom_object_records;
DROP POLICY IF EXISTS custom_object_records_admin_select ON public.custom_object_records;
DROP POLICY IF EXISTS custom_object_records_admin_update ON public.custom_object_records;
DROP POLICY IF EXISTS custom_object_records_team_delete ON public.custom_object_records;
DROP POLICY IF EXISTS custom_object_records_team_update ON public.custom_object_records;

DROP POLICY IF EXISTS custom_objects_admin_delete ON public.custom_objects;
DROP POLICY IF EXISTS custom_objects_admin_select ON public.custom_objects;
DROP POLICY IF EXISTS custom_objects_admin_update ON public.custom_objects;
DROP POLICY IF EXISTS custom_objects_team_delete ON public.custom_objects;
DROP POLICY IF EXISTS custom_objects_team_update ON public.custom_objects;

DROP POLICY IF EXISTS custom_reports_admin_delete ON public.custom_reports;
DROP POLICY IF EXISTS custom_reports_admin_select ON public.custom_reports;
DROP POLICY IF EXISTS custom_reports_admin_update ON public.custom_reports;
DROP POLICY IF EXISTS custom_reports_team_delete ON public.custom_reports;
DROP POLICY IF EXISTS custom_reports_team_update ON public.custom_reports;

DROP POLICY IF EXISTS dashboard_widgets_admin_delete ON public.dashboard_widgets;
DROP POLICY IF EXISTS dashboard_widgets_admin_select ON public.dashboard_widgets;
DROP POLICY IF EXISTS dashboard_widgets_admin_update ON public.dashboard_widgets;
DROP POLICY IF EXISTS dashboard_widgets_team_delete ON public.dashboard_widgets;
DROP POLICY IF EXISTS dashboard_widgets_team_update ON public.dashboard_widgets;

DROP POLICY IF EXISTS dashboards_admin_delete ON public.dashboards;
DROP POLICY IF EXISTS dashboards_admin_select ON public.dashboards;
DROP POLICY IF EXISTS dashboards_admin_update ON public.dashboards;
DROP POLICY IF EXISTS dashboards_team_delete ON public.dashboards;
DROP POLICY IF EXISTS dashboards_team_update ON public.dashboards;

DROP POLICY IF EXISTS email_snippets_admin_delete ON public.email_snippets;
DROP POLICY IF EXISTS email_snippets_admin_select ON public.email_snippets;
DROP POLICY IF EXISTS email_snippets_admin_update ON public.email_snippets;
DROP POLICY IF EXISTS email_snippets_team_delete ON public.email_snippets;
DROP POLICY IF EXISTS email_snippets_team_update ON public.email_snippets;

DROP POLICY IF EXISTS email_templates_admin_delete ON public.email_templates;
DROP POLICY IF EXISTS email_templates_admin_select ON public.email_templates;
DROP POLICY IF EXISTS email_templates_admin_update ON public.email_templates;
DROP POLICY IF EXISTS email_templates_team_delete ON public.email_templates;
DROP POLICY IF EXISTS email_templates_team_update ON public.email_templates;

DROP POLICY IF EXISTS form_submissions_admin_delete ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_admin_select ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_admin_update ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_team_delete ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_team_update ON public.form_submissions;

DROP POLICY IF EXISTS forms_admin_delete ON public.forms;
DROP POLICY IF EXISTS forms_admin_select ON public.forms;
DROP POLICY IF EXISTS forms_admin_update ON public.forms;
DROP POLICY IF EXISTS forms_team_delete ON public.forms;
DROP POLICY IF EXISTS forms_team_update ON public.forms;

DROP POLICY IF EXISTS macros_admin_delete ON public.macros;
DROP POLICY IF EXISTS macros_admin_select ON public.macros;
DROP POLICY IF EXISTS macros_admin_update ON public.macros;
DROP POLICY IF EXISTS macros_team_delete ON public.macros;
DROP POLICY IF EXISTS macros_team_update ON public.macros;

DROP POLICY IF EXISTS saved_views_admin_delete ON public.saved_views;
DROP POLICY IF EXISTS saved_views_admin_select ON public.saved_views;
DROP POLICY IF EXISTS saved_views_admin_update ON public.saved_views;
DROP POLICY IF EXISTS saved_views_team_delete ON public.saved_views;
DROP POLICY IF EXISTS saved_views_team_update ON public.saved_views;

DROP POLICY IF EXISTS sequence_enrollments_admin_delete ON public.sequence_enrollments;
DROP POLICY IF EXISTS sequence_enrollments_admin_select ON public.sequence_enrollments;
DROP POLICY IF EXISTS sequence_enrollments_admin_update ON public.sequence_enrollments;
DROP POLICY IF EXISTS sequence_enrollments_team_delete ON public.sequence_enrollments;
DROP POLICY IF EXISTS sequence_enrollments_team_update ON public.sequence_enrollments;

DROP POLICY IF EXISTS sequences_admin_delete ON public.sequences;
DROP POLICY IF EXISTS sequences_admin_select ON public.sequences;
DROP POLICY IF EXISTS sequences_admin_update ON public.sequences;
DROP POLICY IF EXISTS sequences_team_delete ON public.sequences;
DROP POLICY IF EXISTS sequences_team_update ON public.sequences;

DROP POLICY IF EXISTS webhook_deliveries_admin_delete ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_deliveries_admin_select ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_deliveries_admin_update ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_deliveries_team_delete ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_deliveries_team_update ON public.webhook_deliveries;

DROP POLICY IF EXISTS workflow_runs_admin_delete ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_admin_select ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_admin_update ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_team_delete ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_team_update ON public.workflow_runs;

-- 3) Scope sensitive-table policies to the authenticated role (were targeting 'public'/anon)
ALTER POLICY ws_update_customer_invoices ON public.customer_invoices TO authenticated;
ALTER POLICY ws_financial_entries_update ON public.financial_entries TO authenticated;
ALTER POLICY ws_financial_payments_update ON public.financial_payments TO authenticated;
ALTER POLICY ws_contracts_update ON public.contracts TO authenticated;
ALTER POLICY ws_services_update ON public.services TO authenticated;
ALTER POLICY ws_insert_sequence_enrollments ON public.sequence_enrollments TO authenticated;