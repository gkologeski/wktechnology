CREATE TABLE IF NOT EXISTS public.people_allocation_company_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES public.people_allocations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  pct numeric(5,2) NOT NULL CHECK (pct > 0 AND pct <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE (allocation_id, company_id)
);
CREATE INDEX IF NOT EXISTS people_alloc_splits_alloc_idx
  ON public.people_allocation_company_splits(allocation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_allocation_company_splits TO authenticated;
GRANT ALL ON public.people_allocation_company_splits TO service_role;

ALTER TABLE public.people_allocation_company_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY alloc_splits_select ON public.people_allocation_company_splits
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.people_allocations a
    WHERE a.id = allocation_id AND a.workspace_id = people_allocation_company_splits.workspace_id
  ));

CREATE POLICY alloc_splits_write ON public.people_allocation_company_splits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.people_allocations a
    JOIN public.workspace_members wm
      ON wm.workspace_id = a.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active'
    WHERE a.id = allocation_id
      AND a.workspace_id = people_allocation_company_splits.workspace_id
      AND (public.is_workspace_admin_v2(a.workspace_id, auth.uid())
        OR (a.owner_id = auth.uid()
            AND public.user_has_permission(auth.uid(), a.workspace_id, 'techpeople.allocations.create.own'))
        OR public.user_has_permission(auth.uid(), a.workspace_id, 'techpeople.allocations.update.workspace'))
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.people_allocations a
      JOIN public.workspace_members wm
        ON wm.workspace_id = a.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active'
      WHERE a.id = allocation_id
        AND a.workspace_id = people_allocation_company_splits.workspace_id
        AND (public.is_workspace_admin_v2(a.workspace_id, auth.uid())
          OR (a.owner_id = auth.uid()
              AND public.user_has_permission(auth.uid(), a.workspace_id, 'techpeople.allocations.create.own'))
          OR public.user_has_permission(auth.uid(), a.workspace_id, 'techpeople.allocations.update.workspace'))
    )
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.workspace_id = people_allocation_company_splits.workspace_id
    )
  );

CREATE POLICY view_as_ro_ins ON public.people_allocation_company_splits
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_read_only_view());
CREATE POLICY view_as_ro_upd ON public.people_allocation_company_splits
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_read_only_view());
CREATE POLICY view_as_ro_del ON public.people_allocation_company_splits
  AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_read_only_view());

CREATE OR REPLACE FUNCTION public.people_timesheet_email_user(_person_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid; v_email text; v_profile uuid; v_user uuid; v_n int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_person(_person_id) THEN
    RETURN NULL;
  END IF;
  SELECT workspace_id, lower(trim(email)), profile_id INTO v_ws, v_email, v_profile
  FROM public.people WHERE id = _person_id;
  IF v_ws IS NULL OR coalesce(v_email, '') = '' THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members
                 WHERE workspace_id = v_ws AND user_id = auth.uid() AND status = 'active') THEN
    RETURN NULL;
  END IF;
  SELECT count(*) INTO v_n FROM public.people
  WHERE workspace_id = v_ws AND lower(trim(email)) = v_email;
  IF v_n <> 1 THEN RETURN NULL; END IF;
  SELECT count(*), min(wm.user_id::text)::uuid INTO v_n, v_user
  FROM public.workspace_members wm JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = v_ws AND lower(u.email) = v_email;
  IF v_n <> 1 THEN RETURN NULL; END IF;
  IF v_profile IS NOT NULL AND v_profile <> v_user THEN RETURN NULL; END IF;
  RETURN v_user;
END $$;

REVOKE ALL ON FUNCTION public.people_timesheet_email_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.people_timesheet_email_user(uuid) TO authenticated;