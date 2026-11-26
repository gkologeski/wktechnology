-- Only executed against the disposable import-preservation test database.
BEGIN;
RESET ROLE;
SELECT set_config('request.role','service_role',true),set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true),set_config('request.readonly','false',true);
SET LOCAL ROLE service_role;
SELECT public.jibble_import_file_authorize('aaaaaaaa-0000-4000-8000-00000000000a','jibble-org','20000000-0000-4000-8000-000000000002');
INSERT INTO public.jibble_source_files(id,workspace_id,run_id,source_org_id,screenshot_id,source_hash,file_key,title,sha256,storage_path,bytes,content_type,status)
VALUES('60000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','20000000-0000-4000-8000-000000000002','jibble-org','capture-fixture',repeat('a',64),repeat('b',64),'Captura de teste',repeat('c',64),'aaaaaaaa-0000-4000-8000-00000000000a/jibble-org/'||repeat('c',64),8,'image/png','preserved');
INSERT INTO storage.objects(bucket_id,name) VALUES('time-source-files','aaaaaaaa-0000-4000-8000-00000000000a/jibble-org/'||repeat('c',64));

RESET ROLE;
SELECT set_config('request.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.jibble_source_files WHERE screenshot_id='capture-fixture')<>1 THEN RAISE EXCEPTION 'Allowed admin cannot read source file';END IF;
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='time-source-files')<>1 THEN RAISE EXCEPTION 'Allowed admin cannot read private storage';END IF;
 BEGIN
  PERFORM public.jibble_import_file_authorize('aaaaaaaa-0000-4000-8000-00000000000a','jibble-org','20000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Authenticated browser called service-only file import';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
END $$;

-- No effective view key: both metadata and object are hidden, service writes are refused too.
RESET ROLE;
DELETE FROM public.grants WHERE user_id='10000000-0000-4000-8000-000000000002' AND workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND key='techprojects.jibble_import.view.workspace' AND effect='grant';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.jibble_source_files WHERE screenshot_id='capture-fixture') OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='time-source-files') THEN RAISE EXCEPTION 'No-key caller saw a source file';END IF;
END $$;
RESET ROLE;
SELECT set_config('request.role','service_role',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN BEGIN
 PERFORM public.jibble_import_file_authorize('aaaaaaaa-0000-4000-8000-00000000000a','jibble-org','20000000-0000-4000-8000-000000000002');
 RAISE EXCEPTION 'No-key actor authorized service import';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;END $$;
RESET ROLE;
INSERT INTO public.grants(user_id,workspace_id,key,effect) VALUES('10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','techprojects.jibble_import.view.workspace','grant');

-- Explicit deny wins over the still-present grant and admin membership.
INSERT INTO public.grants(user_id,workspace_id,key,effect) VALUES('10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','techprojects.jibble_import.view.workspace','deny');
SELECT set_config('request.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.jibble_source_files) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='time-source-files') THEN RAISE EXCEPTION 'Explicit deny did not hide source file';END IF;
END $$;
RESET ROLE;
DELETE FROM public.grants WHERE user_id='10000000-0000-4000-8000-000000000002' AND workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND key='techprojects.jibble_import.view.workspace' AND effect='deny';

-- The active workspace must match; membership in another tenant never exposes the file.
UPDATE public.profiles SET active_workspace_id='bbbbbbbb-0000-4000-8000-00000000000b' WHERE id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.jibble_source_files) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='time-source-files') THEN RAISE EXCEPTION 'Other active workspace saw source file';END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET active_workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' WHERE id='10000000-0000-4000-8000-000000000002';

-- Inactive admin loses access despite retained keys and historical identity.
UPDATE public.workspace_members SET status='inactive' WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND user_id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.jibble_source_files) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='time-source-files') THEN RAISE EXCEPTION 'Inactive admin saw source file';END IF;
END $$;
RESET ROLE;
UPDATE public.workspace_members SET status='active' WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND user_id='10000000-0000-4000-8000-000000000002';

-- Service actor cannot redirect storage to another workspace/origin or use an unrelated run.
SELECT set_config('request.role','service_role',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.jibble_import_file_authorize('aaaaaaaa-0000-4000-8000-00000000000a','other-org','20000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Foreign origin authorized file import';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
 BEGIN
  UPDATE public.jibble_source_files SET storage_path='bbbbbbbb-0000-4000-8000-00000000000b/jibble-org/'||repeat('c',64) WHERE screenshot_id='capture-fixture';
  RAISE EXCEPTION 'Foreign storage path accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END;
END $$;
ROLLBACK;
