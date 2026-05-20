
DO $$
DECLARE
  v_owner uuid := '1c237fbe-079e-4eb9-a3e6-c08d85e79688';
BEGIN
  DELETE FROM public.webhook_deliveries WHERE owner_id=v_owner AND payload::text LIKE '%e2e%';
  DELETE FROM public.outbound_webhooks WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%';
  DELETE FROM public.workflow_runs WHERE owner_id=v_owner AND workflow_id IN (SELECT id FROM public.workflows WHERE name LIKE 'TEST_E2E%');
  DELETE FROM public.workflow_events WHERE owner_id=v_owner AND (after->>'name' LIKE 'TEST_E2E%' OR entity_id IN (SELECT id FROM public.deals WHERE name LIKE 'TEST_E2E%'));
  DELETE FROM public.workflows WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%';
  DELETE FROM public.sequence_enrollments WHERE owner_id=v_owner AND sequence_id IN (SELECT id FROM public.sequences WHERE name LIKE 'TEST_E2E%');
  DELETE FROM public.sequences WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%';
  DELETE FROM public.scoring_rules WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%';
  DELETE FROM public.message_sentiments WHERE owner_id=v_owner AND source='test';
  DELETE FROM public.activities WHERE owner_id=v_owner AND subject LIKE '%E2E%';
  DELETE FROM public.stage_entries WHERE entity_id IN (SELECT id FROM public.deals WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%');
  DELETE FROM public.deals WHERE owner_id=v_owner AND name LIKE 'TEST_E2E%';
  DELETE FROM public.contacts WHERE owner_id=v_owner AND label='TEST_E2E_2026';
  DELETE FROM public.companies WHERE owner_id=v_owner AND type='TEST_E2E_2026';
  DELETE FROM public.leads WHERE owner_id=v_owner AND label='TEST_E2E_2026';
  DELETE FROM public.api_keys WHERE owner_id=v_owner AND name='e2e-test';
END $$;
