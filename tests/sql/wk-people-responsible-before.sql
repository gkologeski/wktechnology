-- Must run after 0189 and before 0190, in the disposable fixture only.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
DO $$ DECLARE v_constraint text; BEGIN
  BEGIN
    INSERT INTO public.people(workspace_id,owner_id,created_by,full_name)
    VALUES ('184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','Synthetic baseline');
    RAISE EXCEPTION 'Expected people_assigned_to_fkey failure';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
    IF v_constraint<>'people_assigned_to_fkey' THEN RAISE EXCEPTION 'Unexpected constraint: %',v_constraint; END IF;
    RAISE NOTICE 'PASS original people_assigned_to_fkey reproduced with production trigger';
  END;
END $$;
RESET ROLE;
