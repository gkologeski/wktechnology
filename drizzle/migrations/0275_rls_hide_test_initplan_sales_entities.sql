-- Performance only: same access semantics as before, evaluated once per query instead of once per row.
-- Mirrors the form already used on public.activities (0117): the test-session lookup becomes an InitPlan
-- and the test-record check becomes a hashed subplan over view_as_test_record_ids().
ALTER POLICY view_as_hide_test ON public.contacts
USING (((SELECT public.current_role_test_session()) IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));

ALTER POLICY view_as_hide_test ON public.companies
USING (((SELECT public.current_role_test_session()) IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));

ALTER POLICY view_as_hide_test ON public.leads
USING (((SELECT public.current_role_test_session()) IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));

ALTER POLICY view_as_hide_test ON public.deals
USING (((SELECT public.current_role_test_session()) IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));