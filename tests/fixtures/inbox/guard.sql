-- Loaded explicitly by the disposable Inbox harness; not official seed.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT k,split_part(k,'.',1),CASE WHEN k LIKE 'system.%' THEN 'workflows' ELSE 'inbox.'||split_part(k,'.',3) END,
 (CASE WHEN k LIKE 'system.%' THEN split_part(k,'.',3) ELSE split_part(k,'.',4) END)::public.perm_action,
 (CASE WHEN k LIKE 'system.%' THEN 'workspace' ELSE split_part(k,'.',5) END)::public.perm_scope,'Fixture Inbox guard','Disposable QA catalogue only',true
FROM (VALUES('system.workflows.view.workspace'),('system.workflows.manage.workspace'),('system.workflows.create.workspace'),('system.workflows.update.workspace'),('techsales.inbox.email.view.workspace'),('techsales.inbox.chat.view.workspace'),('techsales.inbox.linkedin.view.own'),('techsales.inbox.chat.create.workspace')) keys(k)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000011','member','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000012','member','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000013','member','active'),
('fa110000-0000-4000-8000-000000000002','fb110000-0000-4000-8000-000000000014','member','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000015','member','inactive')
ON CONFLICT(workspace_id,user_id) DO NOTHING;
INSERT INTO public.job_roles(id,owner_id,workspace_id,name) VALUES
('fd110000-0000-4000-8000-000000000011','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Guard allowed'),
('fd110000-0000-4000-8000-000000000012','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Guard channel missing'),
('fd110000-0000-4000-8000-000000000013','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Guard channel deny'),
('fd110000-0000-4000-8000-000000000014','fa110000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000002','Guard foreign') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_job_roles(user_id,owner_id,workspace_id,role_id)
SELECT ('fb110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,w,w,('fd110000-0000-4000-8000-'||lpad(r::text,12,'0'))::uuid
FROM (VALUES(11,11,'fa110000-0000-4000-8000-000000000001'::uuid),(12,12,'fa110000-0000-4000-8000-000000000001'::uuid),(13,11,'fa110000-0000-4000-8000-000000000001'::uuid),(13,13,'fa110000-0000-4000-8000-000000000001'::uuid),(14,14,'fa110000-0000-4000-8000-000000000002'::uuid),(15,11,'fa110000-0000-4000-8000-000000000001'::uuid)) x(n,r,w)
ON CONFLICT(user_id,owner_id,role_id) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT w,('fd110000-0000-4000-8000-'||lpad(r::text,12,'0'))::uuid,k,'grant','fb110000-0000-4000-8000-000000000001'::uuid
FROM (VALUES(11,'fa110000-0000-4000-8000-000000000001'::uuid),(12,'fa110000-0000-4000-8000-000000000001'::uuid),(14,'fa110000-0000-4000-8000-000000000002'::uuid)) x(r,w)
CROSS JOIN (VALUES('system.workflows.view.workspace'),('system.workflows.manage.workspace'),('system.workflows.create.workspace'),('system.workflows.update.workspace')) keys(k)
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'fa110000-0000-4000-8000-000000000001'::uuid,('fd110000-0000-4000-8000-'||lpad(r::text,12,'0'))::uuid,k,e,'fb110000-0000-4000-8000-000000000001'::uuid
FROM (VALUES(11,'grant'),(13,'deny')) x(r,e)
CROSS JOIN (VALUES('techsales.inbox.email.view.workspace'),('techsales.inbox.chat.view.workspace'),('techsales.inbox.linkedin.view.own'),('techsales.inbox.chat.create.workspace')) keys(k)
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
