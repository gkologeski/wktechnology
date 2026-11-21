-- Disposable schema additions only. The test loads production permission functions
-- and RLS predicates verbatim; no configured connection, person or business data.
ALTER TABLE public.profiles ADD COLUMN notification_preferences jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.user_groups ADD COLUMN name text;
ALTER TABLE public.user_group_members ADD COLUMN is_leader boolean NOT NULL DEFAULT false;
ALTER TABLE public.job_roles ADD COLUMN is_system boolean NOT NULL DEFAULT false;
ALTER TABLE techerp_api.subject_sessions ADD PRIMARY KEY(txid);

-- Referenced in the production worker's shared IF expressions even when the
-- selected source is a workflow. These unused families contain no fixture rows.
CREATE TABLE public.service_agent_sessions(enrollment_id uuid);
CREATE TABLE public.sdr_enrollments(id uuid,workspace_id uuid,owner_id uuid,playbook_id uuid,conversation_id uuid,opted_out_at timestamptz);
CREATE TABLE public.sdr_playbooks(id uuid,workspace_id uuid,enabled boolean);
CREATE TABLE public.sdr_agent_versions(id uuid,playbook_id uuid,workspace_id uuid,status text,published_by uuid);
CREATE TABLE public.whatsapp_conversations(id uuid,workspace_id uuid,ai_owner text);

CREATE TABLE public.workflows(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,execution_user_id uuid,
  entity text,enabled boolean DEFAULT true,status text DEFAULT 'published',published_version integer DEFAULT 1,
  actions jsonb NOT NULL DEFAULT '[]');
CREATE TABLE public.workflow_events(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,entity text,
  entity_id uuid,workflow_version integer,event_type text DEFAULT 'created');
CREATE TABLE public.workflow_runs(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,workflow_id uuid,
  event_id uuid,entity text,entity_id uuid,status text DEFAULT 'running',is_test boolean DEFAULT false);
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
  owner_id uuid NOT NULL,user_id uuid NOT NULL,type text,title text,body text,link text,entity text,entity_id uuid,
  dedupe_key text,read_at timestamptz,created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX notification_recipient_dedupe ON public.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.notifications TO authenticated;

CREATE TABLE public.hiring_area_policies(workspace_id uuid,area_id uuid PRIMARY KEY,manager_id uuid,
  ceo_id uuid,manager_delegate_id uuid,ceo_delegate_id uuid,revision integer DEFAULT 1);
CREATE TABLE public.hiring_demand_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
  job_id uuid,revision integer,policy_revision integer,requested_by uuid,status text);
CREATE TABLE public.hiring_demand_steps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
  request_id uuid,stage text,approver_id uuid,status text);
CREATE TABLE public.project_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,project_id uuid,user_id uuid);
CREATE TABLE public.contract_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
  contract_id uuid,approver_id uuid,owner_id uuid,assigned_to uuid,status text DEFAULT 'pending',
  generation uuid,sort_order integer DEFAULT 1,stage text DEFAULT 'legal',superseded_at timestamptz);
CREATE TABLE public.workflow_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,
  workflow_id uuid,run_id uuid,entity text,entity_id uuid,approver_user_id uuid,status text DEFAULT 'pending',
  workflow_version integer,generation uuid);
CREATE TABLE public.work_resource_catalog(resource text PRIMARY KEY,table_name name NOT NULL,
  responsible_columns text[] NOT NULL DEFAULT '{}',parent_column name,parent_resource text,shared boolean DEFAULT false);
INSERT INTO public.work_resource_catalog VALUES
  ('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id'],NULL,NULL,false),
  ('techcontracts.approvals','contract_approvals',ARRAY['approver_id','owner_id'],'contract_id','techcontracts.contracts',false),
  ('techprojects.projects','projects',ARRAY['assigned_to','owner_id'],NULL,NULL,false),
  ('techprojects.tasks','project_tasks',ARRAY['assignee_id'],NULL,NULL,false),
  ('techprojects.milestones','project_milestones',ARRAY['assigned_to'],'project_id','techprojects.projects',false),
  ('techservice.services','services',ARRAY['assigned_to','owner_id'],NULL,NULL,false);
INSERT INTO public.sales_resource_catalog VALUES
  ('workflows','system.workflows',ARRAY['execution_user_id','owner_id'],false,NULL,NULL,'id'),
  ('quotes','techsales.quotes',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id'),
  ('proposals','techsales.proposals',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id'),
  ('tickets','techsales.tickets',ARRAY['assignee_id','owner_id'],false,NULL,NULL,'id'),
  ('activities','techsales.activities',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id');

-- Extra restrictive policy seam. It deliberately coexists with canonical RLS so
-- the new bridge must respect an independent restriction and preserve its context
-- even when a policy raises. It is not presented as the production role resolver.
CREATE FUNCTION public.notification_fixture_restriction(p_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$ BEGIN
  IF current_setting('test.notification_throw',true)='on' THEN
    RAISE EXCEPTION 'notification fixture policy failure' USING ERRCODE='42501';
  END IF;
  RETURN p_id::text IS DISTINCT FROM current_setting('test.notification_hidden',true);
END $$;

GRANT USAGE ON SCHEMA techerp_api TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
