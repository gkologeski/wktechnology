DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'meetings','proposals','quotes','services','contracts','contract_approvals',
    'deal_loss_reasons','forms','form_submissions','survey_responses',
    'prospecting_searches','prospecting_queues','prospecting_enrollments',
    'prospecting_cadences','prospecting_campaigns','prospecting_scripts',
    'prospecting_questionnaires','enrichment_jobs','playbooks','scoring_rules','sequences',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers',
    'ats_referrals','ats_talent_pools','ats_sourcing_sequences',
    'people','people_allocations','people_documents','people_goals','people_incidents',
    'people_reviews','people_one_on_ones','people_onboarding_plans',
    'projects','project_lists','project_milestones',
    'financial_entries','financial_recurrences','customer_invoices','customer_payments',
    'nfse_invoices','bank_charges','bank_payments','legal_entities',
    'email_broadcasts','landing_pages','dashboards','custom_reports','custom_object_records',
    'media_assets','bookings','kb_articles','macros'
  ];
  has_created_by boolean;
  has_owner boolean;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name=t
    ) THEN
      RAISE NOTICE 'skip missing table %', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (assigned_to)', 'idx_' || t || '_assigned_to', t);

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='created_by')
      INTO has_created_by;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name=t AND column_name='owner_id')
      INTO has_owner;

    IF has_created_by OR has_owner THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);

      IF has_created_by THEN
        EXECUTE format(
          'UPDATE public.%I s SET assigned_to = s.created_by
             WHERE s.assigned_to IS NULL AND s.created_by IS NOT NULL
               AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.created_by)', t);
      END IF;

      IF has_owner THEN
        EXECUTE format(
          'UPDATE public.%I s SET assigned_to = s.owner_id
             WHERE s.assigned_to IS NULL AND s.owner_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.owner_id)', t);
      END IF;

      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    END IF;
  END LOOP;
END $$;