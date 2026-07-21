
-- Fix argument order for is_workspace_admin_v2(_workspace, _user) in RLS policies
-- Previously called as (auth.uid(), owner_id) which never matches.

-- people
DROP POLICY IF EXISTS people_insert ON public.people;
DROP POLICY IF EXISTS people_update ON public.people;
DROP POLICY IF EXISTS people_delete ON public.people;
DROP POLICY IF EXISTS people_select ON public.people;

CREATE POLICY people_select ON public.people FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(owner_id, auth.uid())
  OR manager_id = auth.uid()
  OR profile_id = auth.uid()
);
CREATE POLICY people_insert ON public.people FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));
CREATE POLICY people_delete ON public.people FOR DELETE TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()));

-- people_documents
DROP POLICY IF EXISTS people_documents_select ON public.people_documents;
DROP POLICY IF EXISTS people_documents_write ON public.people_documents;

CREATE POLICY people_documents_select ON public.people_documents FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(owner_id, auth.uid())
  OR (is_sensitive = false AND public.can_view_person(person_id))
);
CREATE POLICY people_documents_write ON public.people_documents FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));

-- people_events
DROP POLICY IF EXISTS people_events_select ON public.people_events;
DROP POLICY IF EXISTS people_events_write ON public.people_events;

CREATE POLICY people_events_select ON public.people_events FOR SELECT TO authenticated
USING (
  public.can_view_person(person_id) AND (
    visible_to_person = true
    OR public.is_workspace_admin_v2(owner_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.id = people_events.person_id AND p.manager_id = auth.uid()
    )
  )
);
CREATE POLICY people_events_write ON public.people_events FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));

-- people_benefits
DROP POLICY IF EXISTS people_benefits_select ON public.people_benefits;
DROP POLICY IF EXISTS people_benefits_write ON public.people_benefits;

CREATE POLICY people_benefits_select ON public.people_benefits FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(owner_id, auth.uid())
  OR public.can_view_person(person_id)
);
CREATE POLICY people_benefits_write ON public.people_benefits FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));

-- workflow_subscriptions
DROP POLICY IF EXISTS "admin manage workflow_subscriptions" ON public.workflow_subscriptions;
CREATE POLICY "admin manage workflow_subscriptions" ON public.workflow_subscriptions FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_v2(owner_id, auth.uid()));
