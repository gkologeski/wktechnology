DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','contacts','leads','deals','activities'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS view_as_hide_test ON public.%I', t);
    EXECUTE format('CREATE POLICY view_as_hide_test ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.current_role_test_session() IS NOT NULL OR NOT public.is_test_record(id))', t);
  END LOOP;
END $$;