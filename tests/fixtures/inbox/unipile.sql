-- Explicit, passwordless identity for the disposable Unipile test only; never official seed.
INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES('fb110000-0000-4000-8000-000000000001','authenticated','authenticated','inbox-disposable@example.invalid',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Inbox disposable test"}')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.job_roles(id,owner_id,workspace_id,name)
VALUES('fd110000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Disposable Inbox read') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_job_roles(user_id,owner_id,workspace_id,role_id)
VALUES('fb110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002') ON CONFLICT(user_id,owner_id,role_id) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('system.linkedin.view.own','system','linkedin','view','own','Ver LinkedIn pessoal','Catálogo explícito do teste descartável.',true),
('system.linkedin.manage.own','system','linkedin','manage','own','Gerenciar LinkedIn pessoal','Catálogo explícito do teste descartável.',true),
('techsales.inbox.linkedin.view.own','techsales','inbox.linkedin','view','own','Ver Inbox LinkedIn pessoal','Catálogo explícito do teste descartável.',true)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','system.linkedin.view.own','grant','fb110000-0000-4000-8000-000000000001'),
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','system.linkedin.manage.own','grant','fb110000-0000-4000-8000-000000000001'),
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','techsales.inbox.linkedin.view.own','grant','fb110000-0000-4000-8000-000000000001') ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO public.unipile_accounts(id,workspace_id,owner_id,unipile_account_id,status)
VALUES('fe110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','disposable_unipile_account','connected')
ON CONFLICT(id) DO NOTHING;
