CREATE TABLE public.meeting_reminder_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  sender_phone_number_id text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.meeting_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  offset_minutes integer NOT NULL CHECK (offset_minutes IN (1440,180,60,5)),
  enabled boolean NOT NULL DEFAULT true,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'pt_BR',
  variable_map jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, offset_minutes)
);
CREATE TABLE public.meeting_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  offset_minutes integer NOT NULL,
  meeting_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','skipped')),
  to_phone text,
  template_name text,
  wa_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, offset_minutes, meeting_at)
);
CREATE INDEX meeting_reminder_dispatches_ws_idx ON public.meeting_reminder_dispatches (workspace_id, created_at DESC);
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS wa_reminders_disabled boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS activities_meeting_due_idx ON public.activities (due_date) WHERE type = 'meeting' AND deleted_at IS NULL AND completed = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_reminder_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_reminder_rules TO authenticated;
GRANT SELECT ON public.meeting_reminder_dispatches TO authenticated;
GRANT ALL ON public.meeting_reminder_settings, public.meeting_reminder_rules, public.meeting_reminder_dispatches TO service_role;

ALTER TABLE public.meeting_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reminder_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY mrs_select ON public.meeting_reminder_settings FOR SELECT TO authenticated
  USING (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'view', ARRAY[]::uuid[]));
CREATE POLICY mrs_write ON public.meeting_reminder_settings FOR ALL TO authenticated
  USING (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'update', ARRAY[]::uuid[]))
  WITH CHECK (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'update', ARRAY[]::uuid[]));
CREATE POLICY mrr_select ON public.meeting_reminder_rules FOR SELECT TO authenticated
  USING (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'view', ARRAY[]::uuid[]));
CREATE POLICY mrr_write ON public.meeting_reminder_rules FOR ALL TO authenticated
  USING (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'update', ARRAY[]::uuid[]))
  WITH CHECK (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'update', ARRAY[]::uuid[]));
CREATE POLICY mrd_select ON public.meeting_reminder_dispatches FOR SELECT TO authenticated
  USING (public.sales_context_access((SELECT public.sales_access_context()), workspace_id, 'techsales.meeting_settings', 'view', ARRAY[]::uuid[]));