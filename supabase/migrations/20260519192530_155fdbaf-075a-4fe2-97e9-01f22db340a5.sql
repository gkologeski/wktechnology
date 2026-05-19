
CREATE TABLE public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  entity TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_custom_reports_owner ON public.custom_reports(owner_id);

CREATE TRIGGER custom_reports_updated_at BEFORE UPDATE ON public.custom_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "custom_reports owner/admin all"
  ON public.custom_reports FOR ALL
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
