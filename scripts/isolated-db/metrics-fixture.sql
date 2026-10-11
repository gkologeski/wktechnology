-- Disposable local performance data, never a migration.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness')
 OR EXISTS(SELECT 1 FROM pg_extension WHERE extname IN('pg_net','pg_cron','http'))
 THEN RAISE EXCEPTION 'Local isolated environment required'; END IF;
END $$;
INSERT INTO public.projects(id,workspace_id,owner_id,name)
SELECT ('84000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
'aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','[ISO metrics14] Project '||i
FROM generate_series(1,500) i ON CONFLICT DO NOTHING;
INSERT INTO public.ats_jobs(id,workspace_id,owner_id,title)
SELECT ('85000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
'aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','[ISO metrics14] Job '||i
FROM generate_series(1,500) i ON CONFLICT DO NOTHING;
