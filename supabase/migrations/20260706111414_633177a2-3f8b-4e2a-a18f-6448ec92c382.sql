CREATE TABLE public.survey_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'csat' CHECK (kind IN ('csat','nps')),
  question text NOT NULL,
  invite_subject text,
  invite_body text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','whatsapp','both')),
  trigger_event text NOT NULL DEFAULT 'ticket_resolved' CHECK (trigger_event IN ('ticket_resolved','ticket_closed','manual')),
  delay_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_templates TO authenticated;
GRANT ALL ON public.survey_templates TO service_role;

ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_select_survey_templates ON public.survey_templates
  FOR SELECT USING ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()) OR (workspace_id IN (SELECT current_user_workspaces())));

CREATE POLICY ws_insert_survey_templates ON public.survey_templates
  FOR INSERT WITH CHECK ((owner_id = auth.uid()) AND (workspace_id IN (SELECT current_user_workspaces())));

CREATE POLICY owner_update_survey_templates ON public.survey_templates
  FOR UPDATE USING ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY owner_delete_survey_templates ON public.survey_templates
  FOR DELETE USING ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE TRIGGER trg_survey_templates_updated_at
  BEFORE UPDATE ON public.survey_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_survey_templates_ws ON public.survey_templates(workspace_id);