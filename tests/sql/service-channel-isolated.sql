-- Run inside a transaction after 0256 on the isolated fixture database; always roll back.
INSERT INTO public.service_channel_accounts(id,workspace_id,channel,source_key,label) VALUES
 ('76000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','whatsapp','test-number-a','[ISO] Lia'),
 ('76000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000b','whatsapp','test-number-b','[ISO] Bruna');
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a',r::uuid,k,'grant','10000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['30000000-0000-4000-8000-0000000000a8','30000000-0000-4000-8000-0000000000a3'])r
CROSS JOIN unnest(ARRAY['system.channels.view.workspace','system.channels.manage.workspace'])k
ON CONFLICT(workspace_id,role_id,permission_key) DO UPDATE SET effect='grant';

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 PERFORM public.service_channel_authorize('manage');
 PERFORM public.service_channel_save('76000000-0000-4000-8000-000000000001','[ISO] Lia','Lia',false,NULL,'',false,false,false);
 IF (SELECT count(*) FROM public.service_channel_accounts)<>1 THEN RAISE EXCEPTION 'Foreign account exposed'; END IF;
 RAISE NOTICE 'PASS allowed active manager and tenant RLS';
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM public.service_channel_save('76000000-0000-4000-8000-000000000002','foreign','Bruna',false,NULL,'',false,false,false);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Foreign workspace write succeeded'; END IF;
 RAISE NOTICE 'PASS foreign workspace';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM public.service_channel_authorize('view'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Missing permission accepted'; END IF;
 RAISE NOTICE 'PASS missing permission';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM public.service_channel_authorize('view'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Inactive member accepted'; END IF;
 RAISE NOTICE 'PASS inactive member';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.job_role_permission_overrides SET effect='deny' WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a'
 AND role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key='system.channels.manage.workspace';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false; BEGIN
 PERFORM public.service_channel_authorize('view');
 BEGIN PERFORM public.service_channel_authorize('manage'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Explicit deny accepted'; END IF;
 RAISE NOTICE 'PASS explicit deny';
END $$;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN UPDATE public.service_channel_accounts SET enabled=true; EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct write bypass'; END IF;
 RAISE NOTICE 'PASS direct write denied';
END $$;
RESET ROLE;
