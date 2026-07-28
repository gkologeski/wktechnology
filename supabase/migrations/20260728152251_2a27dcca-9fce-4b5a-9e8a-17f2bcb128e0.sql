CREATE TABLE public.workspace_invite_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject text,
  greeting text,
  body_intro text,
  cta_label text,
  footer_note text,
  expires_note text,
  product_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invite_settings TO authenticated;
GRANT ALL ON public.workspace_invite_settings TO service_role;

ALTER TABLE public.workspace_invite_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_settings_admin_select"
  ON public.workspace_invite_settings FOR SELECT TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "invite_settings_admin_insert"
  ON public.workspace_invite_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "invite_settings_admin_update"
  ON public.workspace_invite_settings FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "invite_settings_admin_delete"
  ON public.workspace_invite_settings FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.workspace_invite_settings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_invite_settings_updated_at
  BEFORE UPDATE ON public.workspace_invite_settings
  FOR EACH ROW EXECUTE FUNCTION public.workspace_invite_settings_touch_updated_at();