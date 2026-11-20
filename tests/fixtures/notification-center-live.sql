-- Minimal additions for the package 5 real PostgreSQL/HTTP fixture. Existing
-- canonical permission functions and representative source RLS load separately.
ALTER TABLE public.whatsapp_conversations ADD COLUMN owner_id uuid,ADD COLUMN assigned_to uuid;
CREATE TABLE public.email_threads(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid);
CREATE TABLE public.live_chat_sessions(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,assignee_id uuid);
CREATE TABLE public.linkedin_conversations(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid);
CREATE TABLE public.hiring_preparation_requests(id uuid PRIMARY KEY,workspace_id uuid,kind text,owner_id uuid);
CREATE TABLE public.contract_draft_approvers(workspace_id uuid,user_id uuid);
CREATE TABLE public.contract_drafts(id uuid PRIMARY KEY,workspace_id uuid,hiring_request_origin uuid);
ALTER TABLE public.service_agent_sessions ADD COLUMN id uuid PRIMARY KEY,ADD COLUMN workspace_id uuid,ADD COLUMN channel text,ADD COLUMN source_id uuid;
ALTER TABLE public.sdr_playbooks ADD COLUMN owner_id uuid,ADD COLUMN assigned_to uuid;
INSERT INTO public.sales_resource_catalog(table_name,resource,responsibles,shared,parent_table,parent_column,id_column) VALUES
 ('sdr_playbooks','techsales.marketing.sdr_agent',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id'),
 ('sdr_enrollments','techsales.marketing.sdr_agent',ARRAY[]::text[],false,'sdr_playbooks','playbook_id','id'),
 ('email_threads','techsales.inbox.email',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id'),
 ('live_chat_sessions','techsales.inbox.chat',ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id');
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations','hiring_preparation_requests','contract_drafts','contract_draft_approvers','service_agent_sessions','sdr_playbooks','sdr_enrollments'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY sdr_playbook_read ON public.sdr_playbooks FOR SELECT TO authenticated
 USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'techsales.marketing.sdr_agent','view',ARRAY[coalesce(assigned_to,owner_id)]));
CREATE POLICY sdr_enrollment_read ON public.sdr_enrollments FOR SELECT TO authenticated
 USING(public.sales_record_access('sdr_playbooks',playbook_id,'view'));
-- Predicates copied from 0312, 0377 and 0258. The called grant/access functions
-- are loaded verbatim, retaining named approvers, reference and parent reads.
CREATE POLICY contract_draft_approvers_select ON public.contract_draft_approvers FOR SELECT TO authenticated
 USING(public.is_workspace_member(workspace_id,auth.uid()) AND
 (public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_draft_approvers.manage.workspace') OR user_id=auth.uid()));
CREATE POLICY contract_drafts_select ON public.contract_drafts FOR SELECT TO authenticated
 USING(public.is_workspace_member(workspace_id,auth.uid()) AND
 (public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_drafts.view.workspace') OR
 (public.user_has_permission(auth.uid(),workspace_id,'techcontracts.contract_drafts.approve.workspace') AND
 EXISTS(SELECT 1 FROM public.contract_draft_approvers a WHERE a.workspace_id=contract_drafts.workspace_id AND a.user_id=auth.uid()))));
CREATE POLICY hiring_draft_sensitive_origin ON public.contract_drafts AS RESTRICTIVE FOR SELECT TO authenticated
 USING(hiring_request_origin IS NULL OR EXISTS(SELECT 1 FROM public.hiring_preparation_requests r
 WHERE r.id=hiring_request_origin AND r.workspace_id=contract_drafts.workspace_id AND public.hiring_preparation_access(r.workspace_id,r.kind,'reference_view')));
CREATE POLICY service_agent_session_read ON public.service_agent_sessions FOR SELECT TO authenticated USING(
 workspace_id=((SELECT public.work_access_context())->>'workspace')::uuid AND
 public.sales_record_access('sdr_enrollments',enrollment_id,'view') AND
 public.sales_record_access(CASE channel WHEN 'email' THEN 'email_threads' ELSE 'live_chat_sessions' END,source_id,'view'));
-- A pre-existing row with an old workspace value must not acquire provenance.
INSERT INTO public.notifications(id,workspace_id,owner_id,user_id,type,title,entity,entity_id)
 VALUES('f3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',
 'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002',
 'workflow','Historical private snapshot','deals','d1000000-0000-4000-8000-000000000001');
