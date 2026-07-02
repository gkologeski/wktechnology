
DROP POLICY IF EXISTS ws_update_wa_phone_numbers ON public.wa_phone_numbers;
CREATE POLICY ws_update_wa_phone_numbers ON public.wa_phone_numbers
  FOR UPDATE
  USING (is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_insert_wa_phone_numbers ON public.wa_phone_numbers;
CREATE POLICY ws_insert_wa_phone_numbers ON public.wa_phone_numbers
  FOR INSERT
  WITH CHECK (is_workspace_admin_v2(workspace_id, auth.uid()));
