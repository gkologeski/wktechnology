\set ON_ERROR_STOP on
BEGIN; RESET ROLE;
INSERT INTO permission_set_items(set_id,permission_key) VALUES('90000000-0000-4000-8000-000000000050','techpeople.people.view.workspace'),('90000000-0000-4000-8000-000000000050','techpeople.documents.view.own'),('90000000-0000-4000-8000-000000000050','techpeople.documents.create.own');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN BEGIN INSERT INTO people_documents(workspace_id,owner_id,person_id) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d','95600000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'Expected legacy responsible regression'; EXCEPTION WHEN check_violation THEN NULL; END; RAISE NOTICE 'Legacy workspace-as-assignee creation regression reproduced'; END $$;
ROLLBACK;
