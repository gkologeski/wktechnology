BEGIN;
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 UPDATE ats_jobs SET title='Bypassed' WHERE id='96000000-0000-4000-8000-000000000002';
 IF NOT FOUND THEN RAISE EXCEPTION 'Expected old membership-only write bypass'; END IF;
 RAISE NOTICE 'JOB BEFORE: membership alone edits another owner job';
END $$;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF can_access_ats_job('96000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Expected old participant-only helper to deny Head'; END IF;
 RAISE NOTICE 'JOB BEFORE: Head workspace access still rejected by participant helper';
END $$;
ROLLBACK;
