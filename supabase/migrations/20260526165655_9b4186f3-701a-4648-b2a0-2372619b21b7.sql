
-- 1) Remove public-read policy that exposed owner_id on workspace_branding
DROP POLICY IF EXISTS "branding read public by domain" ON public.workspace_branding;

-- 2) Fix swapped is_workspace_admin args on affected policies
-- workspace_branding
ALTER POLICY "booking_pages owner select" ON public.booking_pages
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "booking_pages owner write" ON public.booking_pages
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "bookings owner select" ON public.bookings
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "bookings owner write" ON public.bookings
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "dw_delete" ON public.dashboard_widgets
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "dw_insert" ON public.dashboard_widgets
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "dw_update" ON public.dashboard_widgets
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "dashboards_delete" ON public.dashboards
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "dashboards_insert" ON public.dashboards
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "dashboards_update" ON public.dashboards
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "dli owner delete" ON public.deal_line_items
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "dli owner update" ON public.deal_line_items
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "ebr_delete" ON public.email_broadcast_recipients
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "ebr_update" ON public.email_broadcast_recipients
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "eb_delete" ON public.email_broadcasts
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "eb_update" ON public.email_broadcasts
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "eu_delete" ON public.email_unsubscribes
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "eu_select" ON public.email_unsubscribes
  USING ((owner_id = auth.uid()) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "form_subs_delete_owner_admin" ON public.form_submissions
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "form_subs_select_owner_admin" ON public.form_submissions
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "forms_delete_owner_admin" ON public.forms
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "forms_select_owner_admin" ON public.forms
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "forms_update_owner_admin" ON public.forms
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));

ALTER POLICY "products owner delete" ON public.products
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "products owner select" ON public.products
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
ALTER POLICY "products owner update" ON public.products
  USING ((auth.uid() = owner_id) OR public.is_workspace_admin(owner_id, auth.uid()));
