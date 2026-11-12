CREATE TABLE public.import_connector_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('clockify','jibble','clickup')),
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly','every_6h','every_12h','daily','weekly')),
  run_hour smallint NOT NULL DEFAULT 2 CHECK (run_hour BETWEEN 0 AND 23),
  run_weekday smallint NOT NULL DEFAULT 1 CHECK (run_weekday BETWEEN 0 AND 6),
  time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
  mode text NOT NULL DEFAULT 'preview' CHECK (mode IN ('preview','auto_import')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  last_run_id uuid,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);
GRANT SELECT, INSERT, UPDATE ON public.import_connector_schedules TO authenticated;
GRANT ALL ON public.import_connector_schedules TO service_role;
ALTER TABLE public.import_connector_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY ics_select ON public.import_connector_schedules FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, (SELECT auth.uid())));
CREATE POLICY ics_insert ON public.import_connector_schedules FOR INSERT TO authenticated
  WITH CHECK (public.is_active_workspace_admin(workspace_id, (SELECT auth.uid())) AND owner_user_id = (SELECT auth.uid()));
CREATE POLICY ics_update ON public.import_connector_schedules FOR UPDATE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, (SELECT auth.uid())))
  WITH CHECK (public.is_active_workspace_admin(workspace_id, (SELECT auth.uid())) AND owner_user_id = (SELECT auth.uid()));
CREATE INDEX import_connector_schedules_due ON public.import_connector_schedules (next_run_at) WHERE enabled;