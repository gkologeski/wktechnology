\set ON_ERROR_STOP on
BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM ats_candidates WHERE id='95100000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'expected broad read before 0193'; END IF; UPDATE ats_candidates SET full_name='Unprivileged pre-migration mutation' WHERE id='95100000-0000-4000-8000-000000000001'; IF NOT FOUND THEN RAISE EXCEPTION 'expected broad write before 0193'; END IF; END $$;
ROLLBACK;
