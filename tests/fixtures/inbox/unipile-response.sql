-- Disposable sender fixture only. No application grants or activation.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
VALUES('techsales.inbox.linkedin.create.own','techsales','inbox.linkedin','create','own','Fixture LinkedIn sender',true)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
VALUES('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000002','techsales.inbox.linkedin.create.own','grant','fb110000-0000-4000-8000-000000000001')
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
