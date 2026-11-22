-- Authorized sender fixture, not a relaxed response assertion or app grant.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
VALUES('techsales.inbox.email.create.own','techsales','inbox.email','create','own','Fixture Gmail confirmed sender',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_roles(id,owner_id,workspace_id,name)
VALUES('fd110000-0000-4000-8000-000000000021','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Gmail response authorized sender') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_job_roles(user_id,owner_id,workspace_id,role_id)
VALUES('fb110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000021') ON CONFLICT(user_id,owner_id,role_id) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
VALUES('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000021','techsales.inbox.email.create.own','grant','fb110000-0000-4000-8000-000000000001') ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
