\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM __isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated catalog required';END IF;END $$;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a','30000000-0000-4000-8000-0000000000a8',k,'grant','10000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['techfinance.entries.view.own','techfinance.entries.create.own','techfinance.recurrences.view.own','techfinance.recurrences.create.own','techfinance.recurrences.update.own','techfinance.recurrences.delete.own'])k
ON CONFLICT(workspace_id,role_id,permission_key) DO UPDATE SET effect='grant';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
INSERT INTO financial_recurrences(id,workspace_id,owner_id,direction,template,cadence,start_date,next_run_date,max_occurrences)
VALUES('99800000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a',auth.uid(),'payable','{"description":"[ISO] Atomic schedule","amount":50,"currency":"BRL"}','monthly',current_date,current_date,2);
DO $$ DECLARE r jsonb;BEGIN
 r:=finance_advance_recurrence('99800000-0000-4000-8000-000000000001',current_date);
 IF (r->>'occurrences_generated')::integer<>1 OR NOT (r->>'active')::boolean THEN RAISE EXCEPTION 'Counter wrong';END IF;
 IF NOT EXISTS(SELECT 1 FROM financial_entries WHERE external_ref='recurrence:99800000-0000-4000-8000-000000000001' AND competence_date=current_date AND due_date=current_date AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Entry missing';END IF;
 IF finance_advance_recurrence('99800000-0000-4000-8000-000000000001',current_date) IS NOT NULL THEN RAISE EXCEPTION 'Replayed same period';END IF;
 BEGIN UPDATE financial_recurrences SET next_run_date=current_date,occurrences_generated=0 WHERE id='99800000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Cursor forged';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM financial_recurrences WHERE id='99800000-0000-4000-8000-000000000001';RAISE EXCEPTION 'History erased';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE financial_recurrences SET active=false WHERE id='99800000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Pause denied';END IF;
 RAISE NOTICE 'RECURRENCE PASS 1: atomic generation, real competence, no replay, immutable cursor and preserved history';END $$;
INSERT INTO financial_recurrences(id,workspace_id,owner_id,direction,template,cadence,start_date,next_run_date)
VALUES('99800000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a',auth.uid(),'payable','{"description":"[ISO] Invalid link","amount":50,"category_id":"99900000-0000-4000-8000-000000000009"}','monthly',current_date,current_date);
DO $$ BEGIN
 BEGIN PERFORM finance_advance_recurrence('99800000-0000-4000-8000-000000000002',current_date);RAISE EXCEPTION 'Bad template accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 IF EXISTS(SELECT 1 FROM financial_entries WHERE external_ref='recurrence:99800000-0000-4000-8000-000000000002') OR NOT EXISTS(SELECT 1 FROM financial_recurrences WHERE id='99800000-0000-4000-8000-000000000002' AND occurrences_generated=0 AND next_run_date=current_date) THEN RAISE EXCEPTION 'Partial generation';END IF;
 BEGIN PERFORM finance_advance_recurrence('99800000-0000-4000-8000-000000000002',current_date+1);RAISE EXCEPTION 'Future forced';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 RAISE NOTICE 'RECURRENCE PASS 2: failure preserves entry/cursor and forbids future anticipation';END $$;
RESET ROLE;UPDATE job_role_permission_overrides SET effect='deny' WHERE role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key='techfinance.recurrences.update.own';SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM finance_advance_recurrence('99800000-0000-4000-8000-000000000002',current_date);RAISE EXCEPTION 'Deny bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'RECURRENCE PASS 3: owner and entry-create permission do not override update deny';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM financial_recurrences WHERE id::text LIKE '99800000%') THEN RAISE EXCEPTION 'No-key read bypass';END IF;
 BEGIN PERFORM finance_advance_recurrence('99800000-0000-4000-8000-000000000001',current_date);RAISE EXCEPTION 'No-key generation';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'RECURRENCE PASS 4: no-key actor cannot view or generate';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE user_id='10000000-0000-4000-8000-000000000002';SELECT set_config('request.jwt.claim.sub','',true);SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM finance_advance_recurrence('99800000-0000-4000-8000-000000000001',current_date);RAISE EXCEPTION 'Inactive delegated owner';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'RECURRENCE PASS 5: cron delegation is revoked for inactive schedule owner';END $$;
ROLLBACK;
