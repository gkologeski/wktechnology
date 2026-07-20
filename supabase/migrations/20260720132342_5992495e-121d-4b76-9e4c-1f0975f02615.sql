
CREATE TABLE public.charging_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject text,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charging_templates TO authenticated;
GRANT ALL ON public.charging_templates TO service_role;
ALTER TABLE public.charging_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_charging_templates" ON public.charging_templates FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_charging_templates" ON public.charging_templates FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_charging_templates" ON public.charging_templates FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces())) WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_charging_templates" ON public.charging_templates FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE INDEX charging_templates_ws_idx ON public.charging_templates(workspace_id, channel, active);

CREATE TRIGGER charging_templates_updated_at BEFORE UPDATE ON public.charging_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
