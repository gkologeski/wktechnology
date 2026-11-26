-- Private source screenshots; no operational hours, memberships or financial entries change.
CREATE OR REPLACE FUNCTION public.jibble_import_file_authorize(p_workspace uuid,p_source text,p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Somente o serviço de importação.' USING ERRCODE='42501';END IF;
 PERFORM public.project_import_run_actor(p_workspace,'jibble',p_source,p_run);
 IF NOT EXISTS(SELECT 1 FROM public.time_import_connections c WHERE c.workspace_id=p_workspace AND c.provider='jibble'
   AND c.source_org_id=p_source AND c.credentials_ciphertext IS NOT NULL AND c.source_verified_at IS NOT NULL AND c.source_access IN('owner','admin')) THEN
   RAISE EXCEPTION 'Origem do Jibble indisponível ou sem acesso integral.' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.jibble_import_file_authorize(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jibble_import_file_authorize(uuid,text,uuid) TO service_role;

CREATE TABLE public.jibble_source_files(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 run_id uuid NOT NULL REFERENCES public.time_import_runs(id),
 source_org_id text NOT NULL,
 screenshot_id text NOT NULL CHECK(length(screenshot_id) BETWEEN 1 AND 1024),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 file_key text NOT NULL CHECK(file_key ~ '^[a-f0-9]{64}$'),
 title text NOT NULL,
 sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 storage_path text,
 bytes bigint CHECK(bytes BETWEEN 0 AND 8388608),
 content_type text CHECK(content_type IN('image/png','image/jpeg','image/webp')),
 status text NOT NULL CHECK(status IN('pending','preserved','resolved')),
 issue text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'preserved' OR (storage_path IS NOT NULL AND sha256 IS NOT NULL AND bytes IS NOT NULL AND content_type IS NOT NULL)),
 UNIQUE(workspace_id,source_org_id,screenshot_id,file_key)
);
CREATE INDEX jibble_source_files_record ON public.jibble_source_files(workspace_id,source_org_id,screenshot_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.jibble_source_file_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.jibble_import_file_authorize(NEW.workspace_id,NEW.source_org_id,NEW.run_id);
 IF NEW.storage_path IS NOT NULL AND NEW.storage_path IS DISTINCT FROM NEW.workspace_id::text||'/'||NEW.source_org_id||'/'||NEW.sha256 THEN
   RAISE EXCEPTION 'Caminho de armazenamento fora da origem.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.jibble_source_file_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.jibble_source_file_guard() TO service_role;
CREATE TRIGGER jibble_source_file_guard BEFORE INSERT OR UPDATE ON public.jibble_source_files FOR EACH ROW EXECUTE FUNCTION public.jibble_source_file_guard();
ALTER TABLE public.jibble_source_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jibble_source_files FROM anon,authenticated;
GRANT SELECT ON public.jibble_source_files TO authenticated;
GRANT ALL ON public.jibble_source_files TO service_role;
CREATE POLICY jibble_source_files_read ON public.jibble_source_files FOR SELECT TO authenticated
 USING(public.project_import_access(workspace_id,'jibble','view'));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('time-source-files','time-source-files',false,8388608,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY jibble_source_files_download ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='time-source-files' AND EXISTS(SELECT 1 FROM public.jibble_source_files f WHERE f.storage_path=name AND f.status='preserved'
   AND public.project_import_access(f.workspace_id,'jibble','view')));
