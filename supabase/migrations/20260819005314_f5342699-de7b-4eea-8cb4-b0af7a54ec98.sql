UPDATE public.bug_reports SET workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d' WHERE workspace_id IS NULL;
UPDATE public.user_job_roles SET workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d' WHERE workspace_id IS NULL;
UPDATE public.workflow_subscriptions SET workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d' WHERE workspace_id IS NULL;

ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.bug_reports ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.user_job_roles
  ADD CONSTRAINT user_job_roles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.user_job_roles ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.workflow_subscriptions
  ADD CONSTRAINT workflow_subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_subscriptions ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.field_permission_rules
  ADD CONSTRAINT field_permission_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.field_permission_rules
  ADD CONSTRAINT field_permission_rules_workspace_required
  CHECK (is_system OR workspace_id IS NOT NULL);