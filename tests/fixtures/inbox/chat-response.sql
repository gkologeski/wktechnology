-- Explicit disposable QA only; never official seed.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
SELECT k,'techsales','inbox.chat',split_part(k,'.',4)::public.perm_action,split_part(k,'.',5)::public.perm_scope,'Fixture Chat response',true
FROM (VALUES('techsales.inbox.chat.create.own'),('techsales.inbox.chat.create.team'),('techsales.inbox.chat.view.workspace')) x(k) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
SELECT 'fa110000-0000-4000-8000-000000000001'::uuid,('fb110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'member','active'
FROM generate_series(16,19) n ON CONFLICT(workspace_id,user_id) DO NOTHING;
INSERT INTO public.job_roles(id,owner_id,workspace_id,name)
SELECT ('fd110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fa110000-0000-4000-8000-000000000001'::uuid,'fa110000-0000-4000-8000-000000000001'::uuid,'Chat scope fixture '||n
FROM generate_series(16,17) n ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_job_roles(user_id,owner_id,workspace_id,role_id)
SELECT ('fb110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fa110000-0000-4000-8000-000000000001'::uuid,'fa110000-0000-4000-8000-000000000001'::uuid,('fd110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
FROM generate_series(16,17) n ON CONFLICT(user_id,owner_id,role_id) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'fa110000-0000-4000-8000-000000000001'::uuid,('fd110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,k,'grant','fb110000-0000-4000-8000-000000000001'::uuid
FROM (VALUES(16,'techsales.inbox.chat.create.own'),(16,'techsales.inbox.chat.view.workspace'),(17,'techsales.inbox.chat.create.team'),(17,'techsales.inbox.chat.view.workspace')) x(n,k)
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO public.user_groups(id,workspace_id,name) VALUES('fe110000-0000-4000-8000-000000000017','fa110000-0000-4000-8000-000000000001','Chat disposable team') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_group_members(group_id,user_id)
SELECT 'fe110000-0000-4000-8000-000000000017'::uuid,('fb110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM (VALUES(17),(18)) x(n) ON CONFLICT(group_id,user_id) DO NOTHING;
