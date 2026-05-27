
DROP POLICY IF EXISTS ws_select_email_accounts ON public.email_accounts;
DROP POLICY IF EXISTS ws_select_calendar_accounts ON public.calendar_accounts;

CREATE POLICY owner_select_email_accounts ON public.email_accounts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY owner_select_calendar_accounts ON public.calendar_accounts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
