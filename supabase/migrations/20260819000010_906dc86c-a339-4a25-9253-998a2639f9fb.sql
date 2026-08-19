DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ads_accounts','ads_audiences','ads_lead_forms',
    'ab_tests','ab_test_events','attribution_touchpoints',
    'landing_pages','landing_page_events',
    'live_chat_sessions','live_chat_messages',
    'kb_categories','ats_sourcing_step_log'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END;
$$;