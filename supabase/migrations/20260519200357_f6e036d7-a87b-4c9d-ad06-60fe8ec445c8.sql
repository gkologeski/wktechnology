
CREATE TYPE public.export_frequency AS ENUM ('daily','weekly','monthly');
CREATE TYPE public.export_format AS ENUM ('csv');

CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  report_id uuid NOT NULL REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  frequency public.export_frequency NOT NULL DEFAULT 'weekly',
  hour_of_day int NOT NULL DEFAULT 8 CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 28),
  format public.export_format NOT NULL DEFAULT 'csv',
  email_account_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rs_owner_idx ON public.report_schedules(owner_id);
CREATE INDEX rs_next_run_idx ON public.report_schedules(next_run_at) WHERE enabled = true;

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY rs_select ON public.report_schedules FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY rs_insert ON public.report_schedules FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY rs_update ON public.report_schedules FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY rs_delete ON public.report_schedules FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exports_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
