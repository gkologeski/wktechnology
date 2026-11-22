-- Explicit disposable producer fixture, never official seed or application grants.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
VALUES('techsales.email_accounts.view.own','techsales','email_accounts','view','own','Fixture account reader',true),
('techsales.email_accounts.update.own','techsales','email_accounts','update','own','Fixture account sync',true)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'fa110000-0000-4000-8000-000000000001'::uuid,'fd110000-0000-4000-8000-000000000011'::uuid,k,'grant','fb110000-0000-4000-8000-000000000011'::uuid
FROM (VALUES('techsales.email_accounts.view.own'),('techsales.email_accounts.update.own')) keys(k)
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
SELECT k,split_part(k,'.',1),CASE WHEN k LIKE 'system.%' THEN 'linkedin' ELSE 'inbox.'||split_part(k,'.',3) END,
 (CASE WHEN k LIKE 'system.%' THEN split_part(k,'.',3) ELSE split_part(k,'.',4) END)::public.perm_action,
 split_part(k,'.',CASE WHEN k LIKE 'system.%' THEN 4 ELSE 5 END)::public.perm_scope,'Fixture thirteen producers',true
FROM (VALUES('techsales.inbox.email.create.own'),('techsales.inbox.email.update.workspace'),('techsales.inbox.email.assign.workspace'),('techsales.inbox.chat.update.workspace'),('techsales.inbox.chat.assign.workspace'),('system.linkedin.view.own'),('system.linkedin.manage.own'),('techsales.inbox.linkedin.manage.own'),('techsales.inbox.linkedin.create.own')) keys(k)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'fa110000-0000-4000-8000-000000000001'::uuid,'fd110000-0000-4000-8000-000000000011'::uuid,k,'grant','fb110000-0000-4000-8000-000000000011'::uuid
FROM (VALUES('techsales.inbox.email.create.own'),('techsales.inbox.email.update.workspace'),('techsales.inbox.email.assign.workspace'),('techsales.inbox.chat.update.workspace'),('techsales.inbox.chat.assign.workspace'),('system.linkedin.view.own'),('system.linkedin.manage.own'),('techsales.inbox.linkedin.manage.own'),('techsales.inbox.linkedin.create.own')) keys(k)
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
