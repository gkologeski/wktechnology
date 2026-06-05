
DROP POLICY IF EXISTS "user_groups_select" ON public.user_groups;
DROP POLICY IF EXISTS "user_groups_modify" ON public.user_groups;
DROP POLICY IF EXISTS "user_group_members_select" ON public.user_group_members;
DROP POLICY IF EXISTS "user_group_members_modify" ON public.user_group_members;

ALTER TABLE public.user_groups RENAME COLUMN workspace_owner_id TO workspace_id;

CREATE POLICY "user_groups_select" ON public.user_groups FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_groups.workspace_id AND wm.user_id = auth.uid())
);
CREATE POLICY "user_groups_modify" ON public.user_groups FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_groups.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_groups.workspace_id AND wm.user_id = auth.uid() AND wm.role = 'admin')
);

CREATE POLICY "user_group_members_select" ON public.user_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups g
    JOIN public.workspace_members wm ON wm.workspace_id = g.workspace_id
    WHERE g.id = user_group_members.group_id AND wm.user_id = auth.uid()
  )
);
CREATE POLICY "user_group_members_modify" ON public.user_group_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups g
    JOIN public.workspace_members wm ON wm.workspace_id = g.workspace_id
    WHERE g.id = user_group_members.group_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_groups g
    JOIN public.workspace_members wm ON wm.workspace_id = g.workspace_id
    WHERE g.id = user_group_members.group_id AND wm.user_id = auth.uid() AND wm.role = 'admin'
  )
);
