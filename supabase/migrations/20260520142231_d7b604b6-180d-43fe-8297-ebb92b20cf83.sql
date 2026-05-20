CREATE TABLE IF NOT EXISTS public.hubspot_owners (
  id text PRIMARY KEY,
  email text,
  first_name text,
  last_name text,
  user_id text,
  team_id text,
  archived boolean NOT NULL DEFAULT false,
  hs_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hubspot_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubspot_owners read auth" ON public.hubspot_owners FOR SELECT TO authenticated USING (true);
CREATE POLICY "hubspot_owners write admin" ON public.hubspot_owners FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), auth.uid()))
  WITH CHECK (public.is_workspace_admin(auth.uid(), auth.uid()));