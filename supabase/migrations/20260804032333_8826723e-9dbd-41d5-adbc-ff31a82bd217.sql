-- 1. deal_contacts: reads for members, writes require deal update permission
DROP POLICY IF EXISTS "deal_contacts_workspace_all" ON public.deal_contacts;

CREATE POLICY "deal_contacts_select_member"
  ON public.deal_contacts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
    )
  );

CREATE POLICY "deal_contacts_insert_perm"
  ON public.deal_contacts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
         AND (
           public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.workspace')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.team')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.own')
         )
    )
  );

CREATE POLICY "deal_contacts_update_perm"
  ON public.deal_contacts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
         AND (
           public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.workspace')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.team')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.own')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
         AND (
           public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.workspace')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.team')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.own')
         )
    )
  );

CREATE POLICY "deal_contacts_delete_perm"
  ON public.deal_contacts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
       WHERE d.id = deal_contacts.deal_id
         AND public.is_workspace_member(d.workspace_id, auth.uid())
         AND (
           public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.workspace')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.team')
           OR public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.update.own')
         )
    )
  );

-- 2. leads: INSERT requires the lead-create permission
DROP POLICY IF EXISTS ws_insert_leads ON public.leads;
CREATE POLICY ws_insert_leads ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND owner_id = auth.uid()
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.leads.create.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.leads.create.team')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.leads.create.own')
    )
  );

-- 3. segment_members: reads for members, writes only for segment owner or workspace admin
DROP POLICY IF EXISTS "segment_members_workspace_all" ON public.segment_members;

CREATE POLICY "segment_members_select_member"
  ON public.segment_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND public.is_workspace_member(s.workspace_id, auth.uid())
    )
  );

CREATE POLICY "segment_members_insert_owner"
  ON public.segment_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND public.is_workspace_member(s.workspace_id, auth.uid())
         AND (s.owner_id = auth.uid() OR public.is_workspace_admin(s.workspace_id, auth.uid()))
    )
  );

CREATE POLICY "segment_members_update_owner"
  ON public.segment_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND (s.owner_id = auth.uid() OR public.is_workspace_admin(s.workspace_id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND (s.owner_id = auth.uid() OR public.is_workspace_admin(s.workspace_id, auth.uid()))
    )
  );

CREATE POLICY "segment_members_delete_owner"
  ON public.segment_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segments s
       WHERE s.id = segment_members.segment_id
         AND (s.owner_id = auth.uid() OR public.is_workspace_admin(s.workspace_id, auth.uid()))
    )
  );