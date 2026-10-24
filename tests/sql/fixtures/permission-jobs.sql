\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SELECT set_config('request.jwt.claims','{}',false);
CREATE TABLE public.ats_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,owner_id uuid NOT NULL,assigned_to uuid,hiring_manager_id uuid,recruiter_id uuid,pipeline_id uuid,deal_id uuid,company_id uuid,title text NOT NULL,status text DEFAULT 'draft',metadata jsonb DEFAULT '{}');
CREATE TABLE public.ats_pipelines(id uuid PRIMARY KEY,workspace_id uuid NOT NULL);
ALTER TABLE public.ats_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ats_jobs TO authenticated;
CREATE POLICY jobs_workspace_bypass ON public.ats_jobs FOR ALL TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_upd ON public.ats_jobs AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON public.ats_jobs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON public.ats_jobs AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
CREATE FUNCTION public.can_access_ats_job(_job_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM ats_jobs j WHERE j.id=_job_id AND j.workspace_id IN(SELECT current_user_workspaces()) AND auth.uid() IN(j.owner_id,j.hiring_manager_id,j.recruiter_id))
$$;
-- Model the existing live catalog and WK Head RH grants before the tested lot.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt)
SELECT 'techhire.jobs.'||a||'.'||s,'techhire','jobs',CASE WHEN a='publish' THEN 'manage' ELSE a END::public.perm_action,s::public.perm_scope,'Synthetic job '||a||' '||s
FROM(VALUES('view','own'),('view','team'),('view','workspace'),('create','own'),('create','workspace'),('update','own'),('update','team'),('update','workspace'),('delete','own'),('delete','workspace'),('publish','workspace'),('export','workspace'))k(a,s) ON CONFLICT(key)DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.jobs.%' ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050';
DELETE FROM user_group_members;
INSERT INTO ats_jobs(id,workspace_id,owner_id,assigned_to,recruiter_id,title) VALUES
 ('96000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004',NULL,'Own'),
 ('96000000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003',NULL,'Other'),
 ('96000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003',NULL,'Foreign'),
 ('96000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000004','Recruiter');
INSERT INTO ats_pipelines VALUES('96010000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d'),('96010000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002');
CREATE FUNCTION test_elevated_job_reassign(job_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE ats_jobs SET assigned_to=auth.uid() WHERE id=job_id $$;

CREATE TABLE public.ats_job_postings(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,job_id uuid,status text);
ALTER TABLE public.ats_job_postings ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ats_job_postings TO authenticated,service_role;
CREATE POLICY synthetic_posting_workspace_all ON public.ats_job_postings TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
INSERT INTO ats_job_postings VALUES
 ('96040000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','96000000-0000-4000-8000-000000000001','published'),
 ('96040000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000002','published'),
 ('96040000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000003','published');
