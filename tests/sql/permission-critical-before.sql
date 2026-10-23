\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM get_entity_field_catalog('leads','90000000-0000-4000-8000-000000000003') WHERE distinct_values @> ARRAY['secret@example.test']) THEN RAISE EXCEPTION 'baseline sample not reproduced'; END IF;
 PERFORM anonymize_ats_candidate('91000000-0000-4000-8000-000000000001');
 RAISE NOTICE 'BASELINE PASS: anonymous samples and anonymous anonymization reproduced in synthetic data';
END $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM ats_candidates WHERE id='91000000-0000-4000-8000-000000000001' AND full_name='[REDACTED]') THEN RAISE EXCEPTION 'baseline NULL bug not reproduced'; END IF; END $$;
ROLLBACK;
