
CREATE TABLE public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_groups TO authenticated;
GRANT ALL ON public.user_groups TO service_role;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_groups_select" ON public.user_groups FOR SELECT TO authenticated
USING (
  workspace_owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.workspace_owner_id = user_groups.workspace_owner_id AND tm.member_user_id = auth.uid())
);
CREATE POLICY "user_groups_modify" ON public.user_groups FOR ALL TO authenticated
USING (workspace_owner_id = auth.uid())
WITH CHECK (workspace_owner_id = auth.uid());

CREATE TABLE public.user_group_members (
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_members TO authenticated;
GRANT ALL ON public.user_group_members TO service_role;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_group_members_select" ON public.user_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups g
    WHERE g.id = user_group_members.group_id
      AND (
        g.workspace_owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.workspace_owner_id = g.workspace_owner_id AND tm.member_user_id = auth.uid())
      )
  )
);
CREATE POLICY "user_group_members_modify" ON public.user_group_members FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = user_group_members.group_id AND g.workspace_owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_groups g WHERE g.id = user_group_members.group_id AND g.workspace_owner_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.set_updated_at_user_groups()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER user_groups_updated_at BEFORE UPDATE ON public.user_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_user_groups();
