-- Disposable test realm only. Production migrations/RPCs/RLS below remain unmodified.
-- RBAC graph is represented by explicit effective-key fixtures; claims are SQL fixtures, not GoTrue JWTs.
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,active_workspace_id uuid,full_name text);
CREATE TABLE public.workspace_members(workspace_id uuid,user_id uuid,status text DEFAULT 'active',role text DEFAULT 'admin',PRIMARY KEY(workspace_id,user_id));
CREATE TABLE public.grants(user_id uuid,workspace_id uuid,key text,effect text);
CREATE TABLE public.permissions(key text PRIMARY KEY,module text,resource text,action text,scope text,label_pt text,is_system boolean);
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.uid',true),''))::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.role',true),'')$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
CREATE FUNCTION public.is_read_only_view() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.readonly',true),''),'false')::boolean$$;
CREATE FUNCTION public.is_active_workspace_admin(w uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND status='active' AND role IN('owner','admin'))
$$;
CREATE FUNCTION public.work_subject_context(w uuid,u uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE keys jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND status='active') THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_object_agg(k.key,true),'{}') INTO keys FROM (
 SELECT DISTINCT g.key FROM grants g WHERE g.workspace_id=w AND g.user_id=u AND g.effect='grant'
   AND NOT EXISTS(SELECT 1 FROM grants d WHERE d.workspace_id=w AND d.user_id=u AND d.key=g.key AND d.effect='deny')
 ) k;
 RETURN jsonb_build_object('actor',u,'workspace',w,'keys',keys,'read_only',is_read_only_view());
END $$;
CREATE FUNCTION public.work_access_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.work_subject_context(p.active_workspace_id,p.id) FROM profiles p WHERE p.id=auth.uid()
$$;
CREATE TABLE public.projects(id uuid PRIMARY KEY,workspace_id uuid,name text,allowed boolean DEFAULT true);
CREATE TABLE public.people(id uuid PRIMARY KEY,workspace_id uuid,full_name text,email text,profile_id uuid);
CREATE TABLE public.project_time_entries(id uuid PRIMARY KEY,workspace_id uuid,status text,duration_minutes integer);
CREATE TABLE public.financial_entries(id uuid PRIMARY KEY,workspace_id uuid,amount numeric);
CREATE FUNCTION public.work_record_access(r text,i uuid,a text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM projects p JOIN profiles u ON u.id=auth.uid() WHERE p.id=i AND p.workspace_id=u.active_workspace_id AND p.allowed)
$$;
CREATE TABLE public.clockify_import_runs(id uuid PRIMARY KEY,workspace_id uuid,source_workspace_id text,requested_by uuid,delegation_authorized_by uuid,kind text DEFAULT 'dry_run',status text DEFAULT 'queued',created_at timestamptz DEFAULT now());
CREATE TABLE public.time_import_runs(id uuid PRIMARY KEY,workspace_id uuid,provider text,source_org_id text,requested_by uuid,delegation_authorized_by uuid,kind text DEFAULT 'dry_run',status text DEFAULT 'queued',created_at timestamptz DEFAULT now());
CREATE TABLE public.time_import_connections(workspace_id uuid,provider text,source_org_id text,credentials_ciphertext text,source_verified_at timestamptz,source_access text);
CREATE TABLE public.clockify_staging_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,source_workspace_id text,entity_type text,external_id text,payload jsonb,last_run_id uuid,status text,reason_code text,first_seen_at timestamptz DEFAULT now(),last_seen_at timestamptz DEFAULT now());
CREATE TABLE public.time_import_staging(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,provider text,source_org_id text,entity_type text,external_id text,payload jsonb,last_run_id uuid,status text,reason_code text,first_seen_at timestamptz DEFAULT now(),last_seen_at timestamptz DEFAULT now());
CREATE TABLE public.clockify_mappings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,source_workspace_id text,entity_type text,external_id text,
 label text,target_id uuid,method text DEFAULT 'none',decision text DEFAULT 'pending',candidates jsonb DEFAULT '[]',note text,
 decided_by uuid,decided_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 UNIQUE(workspace_id,source_workspace_id,entity_type,external_id)
);
CREATE TABLE public.time_import_mappings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,provider text,source_org_id text,entity_type text,external_id text,
 label text,target_id uuid,method text DEFAULT 'none',decision text DEFAULT 'pending',candidates jsonb DEFAULT '[]',note text,
 decided_by uuid,decided_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 UNIQUE(workspace_id,provider,source_org_id,entity_type,external_id)
);
CREATE TABLE public.clickup_import_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),status text NOT NULL DEFAULT 'collecting',
 counts jsonb DEFAULT '{}',error text,requested_by uuid NOT NULL,confirmed_by uuid,confirmed_at timestamptz,
 applied_at timestamptz,rolled_back_by uuid,rolled_back_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.clickup_import_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid,workspace_id uuid,team_id text,list_ext_id text);
CREATE TABLE public.clickup_import_tasks(run_id uuid,workspace_id uuid,external_id text,list_ext_id text,parent_external_id text,payload jsonb,PRIMARY KEY(run_id,external_id));
CREATE TABLE public.clickup_import_links(workspace_id uuid,entity_type text,external_id text,target_id uuid,created_run_id uuid);
CREATE TABLE public.clickup_import_people(workspace_id uuid,clickup_user_id bigint,email text,username text,task_count integer,user_id uuid,decided_by uuid,decided_at timestamptz,status text,match_reason text,updated_at timestamptz,PRIMARY KEY(workspace_id,clickup_user_id));
-- Only existing native authorization helpers are loaded from migration 0267 by the test runner.
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
GRANT SELECT ON storage.objects TO authenticated;
GRANT SELECT ON public.clickup_import_runs,public.clickup_import_groups,public.clickup_import_tasks TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public,storage TO service_role;
