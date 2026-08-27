CREATE TABLE public.apollo_phone_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('lead','contact')),
  entity_id uuid NOT NULL,
  apollo_person_id text,
  linkedin_url text,
  email text,
  signal text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','empty')),
  mobile_phone text,
  work_phone text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX apollo_phone_reveals_entity_idx ON public.apollo_phone_reveals (entity_type, entity_id);
CREATE INDEX apollo_phone_reveals_person_idx ON public.apollo_phone_reveals (apollo_person_id) WHERE apollo_person_id IS NOT NULL;
CREATE INDEX apollo_phone_reveals_linkedin_idx ON public.apollo_phone_reveals (linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX apollo_phone_reveals_email_idx ON public.apollo_phone_reveals (email) WHERE email IS NOT NULL;
CREATE INDEX apollo_phone_reveals_status_idx ON public.apollo_phone_reveals (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apollo_phone_reveals TO authenticated;
GRANT ALL ON public.apollo_phone_reveals TO service_role;

ALTER TABLE public.apollo_phone_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apollo_phone_reveals_select" ON public.apollo_phone_reveals
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "apollo_phone_reveals_insert" ON public.apollo_phone_reveals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "apollo_phone_reveals_update" ON public.apollo_phone_reveals
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "apollo_phone_reveals_delete" ON public.apollo_phone_reveals
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE TRIGGER apollo_phone_reveals_touch
  BEFORE UPDATE ON public.apollo_phone_reveals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();