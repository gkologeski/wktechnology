
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  widget_type text NOT NULL DEFAULT 'report',
  report_id uuid REFERENCES public.custom_reports(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position int NOT NULL DEFAULT 0,
  width int NOT NULL DEFAULT 6,
  height int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboards_owner ON public.dashboards(owner_id);
CREATE INDEX idx_dashboard_widgets_dashboard ON public.dashboard_widgets(dashboard_id);
CREATE UNIQUE INDEX dashboards_one_default_per_owner ON public.dashboards(owner_id) WHERE is_default;

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboards_select" ON public.dashboards FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dashboards_insert" ON public.dashboards FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dashboards_update" ON public.dashboards FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dashboards_delete" ON public.dashboards FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

CREATE POLICY "dw_select" ON public.dashboard_widgets FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dw_insert" ON public.dashboard_widgets FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dw_update" ON public.dashboard_widgets FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dw_delete" ON public.dashboard_widgets FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

CREATE TRIGGER dashboards_upd BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER dw_upd BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
