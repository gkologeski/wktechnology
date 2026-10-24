-- Run only against the catalog-derived, synthetic local Supabase stack.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated catalog required';END IF;END $$;
DELETE FROM job_role_permission_overrides WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key LIKE 'techfinance.%';
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a','30000000-0000-4000-8000-0000000000a8',k,'grant','10000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['techfinance.entries.view.own','techfinance.entries.create.own','techfinance.payments.view.own','techfinance.payments.create.own','techfinance.payments.delete.own'])k
ON CONFLICT(workspace_id,role_id,permission_key) DO UPDATE SET effect='grant';
INSERT INTO financial_entries(id,workspace_id,owner_id,direction,origin_type,description,amount,competence_date,due_date) VALUES
('99700000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','payable','manual','[ISO FINANCE] own',100,current_date,current_date),
('99700000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000004','payable','manual','[ISO FINANCE] another',100,current_date,current_date),
('99700000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','payable','manual','[ISO FINANCE] foreign',100,current_date,current_date);
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM financial_entries WHERE id::text LIKE '99700000%')<>1 THEN RAISE EXCEPTION 'own/tenant read bypass';END IF;
 UPDATE financial_entries SET notes='forbidden' WHERE id='99700000-0000-4000-8000-000000000001';IF FOUND THEN RAISE EXCEPTION 'Owner bypass update';END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,description,amount,competence_date,due_date) VALUES('aaaaaaaa-0000-4000-8000-00000000000a',auth.uid(),'payable','[ISO FINANCE] created',50,current_date,current_date);
 BEGIN INSERT INTO financial_entries(workspace_id,owner_id,direction,description,amount,competence_date,due_date) VALUES('aaaaaaaa-0000-4000-8000-00000000000b',auth.uid(),'payable','bad tenant',50,current_date,current_date);RAISE EXCEPTION 'Foreign creation';EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;END;
 BEGIN INSERT INTO financial_entries(workspace_id,owner_id,direction,description,amount,competence_date,due_date) VALUES('aaaaaaaa-0000-4000-8000-00000000000a',auth.uid(),'payable','bad amount','NaN'::numeric,current_date,current_date);RAISE EXCEPTION 'NaN accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 1: own view/create; ownership does not grant update; other tenant denied';END $$;
DO $$ DECLARE p uuid;BEGIN
 INSERT INTO financial_payments(workspace_id,entry_id,created_by,amount,paid_at) VALUES('aaaaaaaa-0000-4000-8000-00000000000a','99700000-0000-4000-8000-000000000001',auth.uid(),40,current_date) RETURNING id INTO p;
 IF NOT EXISTS(SELECT 1 FROM financial_entries WHERE id='99700000-0000-4000-8000-000000000001' AND paid_amount=40 AND status='partial') THEN RAISE EXCEPTION 'Recalc failed without update permission';END IF;
 BEGIN INSERT INTO financial_payments(workspace_id,entry_id,created_by,amount,paid_at) VALUES('aaaaaaaa-0000-4000-8000-00000000000a','99700000-0000-4000-8000-000000000001',auth.uid(),61,current_date);RAISE EXCEPTION 'Overpayment';EXCEPTION WHEN check_violation THEN NULL;END;
 UPDATE financial_payments SET amount=1 WHERE id=p;IF FOUND THEN RAISE EXCEPTION 'Payment edited';END IF;
 DELETE FROM financial_payments WHERE id=p;
 IF NOT EXISTS(SELECT 1 FROM financial_entries WHERE id='99700000-0000-4000-8000-000000000001' AND paid_amount=0 AND status='open') THEN RAISE EXCEPTION 'Reversal failed';END IF;
 RAISE NOTICE 'FINANCE PASS 2: post/reverse independently of entry edit, authoritative recalculation and balance limit';END $$;
RESET ROLE;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a','30000000-0000-4000-8000-0000000000a8',k,'grant','10000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['techfinance.entries.update.own','techfinance.entries.delete.own'])k ON CONFLICT(workspace_id,role_id,permission_key) DO UPDATE SET effect='grant';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 UPDATE financial_entries SET notes='allowed' WHERE id='99700000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Update not granted';END IF;
 BEGIN UPDATE financial_entries SET paid_amount=100,status='paid' WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Forged paid';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE financial_entries SET status='cancelled' WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Edit cancels';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE financial_entries SET owner_id='10000000-0000-4000-8000-000000000004' WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Ownership forged';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE financial_entries SET assigned_to='10000000-0000-4000-8000-000000000004' WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Assignment bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 3: edit does not imply cancellation, posting, or reassignment';END $$;
DO $$ DECLARE p uuid;BEGIN
 INSERT INTO financial_payments(workspace_id,entry_id,created_by,amount,paid_at) VALUES('aaaaaaaa-0000-4000-8000-00000000000a','99700000-0000-4000-8000-000000000001',auth.uid(),40,current_date) RETURNING id INTO p;
 BEGIN UPDATE financial_entries SET amount=200 WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Paid terms changed';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN DELETE FROM financial_entries WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Paid entry deleted';EXCEPTION WHEN check_violation THEN NULL;END;
 DELETE FROM financial_payments WHERE id=p;
 RAISE NOTICE 'FINANCE PASS 4: posted conditions and payments protected from destructive entry changes';END $$;
DO $$ DECLARE r jsonb;c integer;BEGIN
 SELECT count(*) INTO c FROM financial_entries;
 BEGIN PERFORM finance_create_installments(jsonb_build_array(jsonb_build_object('direction','payable','origin_type','manual','description','atomic','amount',50,'competence_date',current_date,'due_date',current_date),jsonb_build_object('direction','payable','origin_type','manual','description','atomic','amount',0,'competence_date',current_date,'due_date',current_date)));RAISE EXCEPTION 'Invalid installment accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 IF (SELECT count(*) FROM financial_entries)<>c THEN RAISE EXCEPTION 'Partial installment created';END IF;
 r:=finance_create_installments(jsonb_build_array(jsonb_build_object('direction','payable','origin_type','manual','description','atomic','amount',50,'competence_date',current_date,'due_date',current_date),jsonb_build_object('direction','payable','origin_type','manual','description','atomic','amount',50,'competence_date',current_date,'due_date',current_date)));
 IF (SELECT count(*) FROM financial_entries WHERE id=(r->>'parent_id')::uuid OR parent_entry_id=(r->>'parent_id')::uuid)<>2 THEN RAISE EXCEPTION 'Missing installments';END IF;
 r:=finance_delete_installments((r->>'parent_id')::uuid,false);IF r->>'deleted'<>'2' THEN RAISE EXCEPTION 'Group not deleted';END IF;
 RAISE NOTICE 'FINANCE PASS 5: installment creation/deletion is atomic on real row permissions';END $$;
RESET ROLE;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
VALUES('aaaaaaaa-0000-4000-8000-00000000000a','30000000-0000-4000-8000-0000000000a8','techfinance.entry_cancellation.manage.workspace','grant','10000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 UPDATE financial_entries SET status='cancelled' WHERE id='99700000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Cancellation failed';END IF;
 BEGIN INSERT INTO financial_payments(workspace_id,entry_id,created_by,amount,paid_at) VALUES('aaaaaaaa-0000-4000-8000-00000000000a','99700000-0000-4000-8000-000000000001',auth.uid(),1,current_date);RAISE EXCEPTION 'Cancelled posting';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 6: separate cancellation works and blocks new payments';END $$;
RESET ROLE;UPDATE job_role_permission_overrides SET effect='deny' WHERE role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key='techfinance.entries.update.own';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF finance_entry_access('99700000-0000-4000-8000-000000000001','update') THEN RAISE EXCEPTION 'Deny bypass';END IF;
 BEGIN UPDATE financial_entries SET notes='deny bypass' WHERE id='99700000-0000-4000-8000-000000000001';IF FOUND THEN RAISE EXCEPTION 'Deny update bypass';END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 7: explicit deny is preserved even with ownership/cancellation';END $$;
RESET ROLE;
UPDATE job_role_permission_overrides SET effect='grant' WHERE role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key='techfinance.entries.update.own';
CREATE ROLE finance_api_guard_test NOLOGIN INHERIT;
GRANT authenticated TO finance_api_guard_test;
GRANT finance_api_guard_test TO postgres;
SET LOCAL ROLE finance_api_guard_test;
DO $$ BEGIN
 BEGIN UPDATE financial_entries SET paid_amount=100,status='paid' WHERE id='99700000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Technical API role bypassed state guard';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 11: nonprivileged technical API role is guarded too';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE user_id='10000000-0000-4000-8000-000000000002';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM financial_entries WHERE id::text LIKE '99700000%') OR finance_entry_access('99700000-0000-4000-8000-000000000001','cancel') THEN RAISE EXCEPTION 'Inactive bypass';END IF;RAISE NOTICE 'FINANCE PASS 8: inactive membership denied';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);SET LOCAL ROLE authenticated;
DO $$ BEGIN IF finance_entry_access('99700000-0000-4000-8000-000000000001','view') THEN RAISE EXCEPTION 'Foreign admin bypass';END IF;RAISE NOTICE 'FINANCE PASS 9: foreign admin cannot access another tenant';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM finance_entry_capabilities(ARRAY['99700000-0000-4000-8000-000000000001'::uuid]);RAISE EXCEPTION 'Anonymous capability bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM finance_lock_payment_entry('99700000-0000-4000-8000-000000000001','create');RAISE EXCEPTION 'Anonymous lock bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'FINANCE PASS 10: anonymous RPCs denied';END $$;
ROLLBACK;
