-- Production RPC/RLS exercised only in the disposable PostgreSQL realm.
BEGIN;
RESET ROLE;
INSERT INTO project_import_records(id,workspace_id,provider,source_id,entity_type,external_id,payload,payload_hash,label,version_count,last_run_id)
VALUES('60010000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','clockify','aaaaaaaaaaaaaaaaaaaaaaaa','time_entry','evidence-many','{}',repeat('a',64),'Evidence',1005,'20000000-0000-4000-8000-000000000001'),
('60010000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','clockify','aaaaaaaaaaaaaaaaaaaaaaaa','time_entry','evidence-other','{}',repeat('a',64),'Other evidence',1,'20000000-0000-4000-8000-000000000001');
INSERT INTO project_import_record_versions(record_id,workspace_id,provider,version_number,payload,payload_hash,run_id)
SELECT '60010000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','clockify',n,jsonb_build_object('original',n),repeat('a',64),'20000000-0000-4000-8000-000000000001' FROM generate_series(1,1005) n;
INSERT INTO project_import_record_versions(record_id,workspace_id,provider,version_number,payload,payload_hash,run_id)
VALUES('60010000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','clockify',1,'{}',repeat('a',64),'20000000-0000-4000-8000-000000000001');
INSERT INTO project_import_record_events(record_id,workspace_id,provider,actor_id,action,note,version_id,created_at)
SELECT '60010000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','clockify','10000000-0000-4000-8000-000000000002','review','Decision evidence '||n,v.id,'2026-01-01T00:00:00Z' FROM generate_series(1,1005) n CROSS JOIN LATERAL(SELECT id FROM project_import_record_versions WHERE record_id='60010000-0000-4000-8000-000000000001' AND version_number=1005) v;
SELECT set_config('request.role','authenticated',true),set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true),set_config('request.readonly','false',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE page jsonb;cur uuid;k text;total integer;pages integer;ids uuid[];foreign_cursor uuid;event_cursor uuid;
BEGIN
 FOREACH k IN ARRAY ARRAY['versions','history'] LOOP
  cur:=NULL;total:=0;pages:=0;ids:='{}';
  LOOP
   page:=project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001',k,cur);
   IF jsonb_array_length(page->k)>50 THEN RAISE EXCEPTION 'Evidence page exceeded 50';END IF;
   ids:=ids||ARRAY(SELECT (value->>'id')::uuid FROM jsonb_array_elements(page->k));
   total:=total+jsonb_array_length(page->k);pages:=pages+1;cur:=(page->>'nextCursor')::uuid;
   EXIT WHEN cur IS NULL;
   IF pages>30 THEN RAISE EXCEPTION 'Evidence cursor did not terminate';END IF;
  END LOOP;
  IF total<>1005 OR pages<>21 OR(SELECT count(DISTINCT x) FROM unnest(ids) x)<>1005 THEN RAISE EXCEPTION 'Evidence lost or repeated beyond PostgREST limit: %, %',total,pages;END IF;
 END LOOP;
 SELECT id INTO foreign_cursor FROM project_import_record_versions WHERE record_id='60010000-0000-4000-8000-000000000002';
 SELECT id INTO event_cursor FROM project_import_record_events WHERE record_id='60010000-0000-4000-8000-000000000001' LIMIT 1;
 BEGIN
  PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','versions',foreign_cursor);
  RAISE EXCEPTION 'Foreign-record evidence cursor accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
 BEGIN
  PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','versions',event_cursor);
  RAISE EXCEPTION 'Wrong evidence type cursor accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
END $$;

-- No effective key.
RESET ROLE;
DELETE FROM grants WHERE user_id='10000000-0000-4000-8000-000000000002' AND workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND key='techprojects.clockify_import.view.workspace';
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN
 PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','versions');RAISE EXCEPTION 'No-key evidence was visible';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;END $$;
RESET ROLE;
INSERT INTO grants VALUES('10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','techprojects.clockify_import.view.workspace','grant');

-- Explicit deny wins over active admin membership.
INSERT INTO grants VALUES('10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','techprojects.clockify_import.view.workspace','deny');
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN
 PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','history');RAISE EXCEPTION 'Denied evidence was visible';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;END $$;
RESET ROLE;
DELETE FROM grants WHERE user_id='10000000-0000-4000-8000-000000000002' AND effect='deny';

-- Foreign active workspace.
UPDATE profiles SET active_workspace_id='aaaaaaaa-0000-4000-8000-00000000000b' WHERE id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN
 PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','versions');RAISE EXCEPTION 'Foreign-workspace evidence was visible';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;END $$;
RESET ROLE;
UPDATE profiles SET active_workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' WHERE id='10000000-0000-4000-8000-000000000002';

-- Inactive historical admin retains neither read permission nor bypass.
UPDATE workspace_members SET status='inactive' WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND user_id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN
 PERFORM project_import_evidence_page('aaaaaaaa-0000-4000-8000-00000000000a','60010000-0000-4000-8000-000000000001','history');RAISE EXCEPTION 'Inactive evidence was visible';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;END $$;
ROLLBACK;
