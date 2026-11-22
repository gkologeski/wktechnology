-- Explicit disposable-test fixtures. Never replay as official app/draft data.

-- Synthetic producer fixtures reuse only the reserved disposable workspaces below.
INSERT INTO public.workspaces(id,name,slug,created_by,status) VALUES
('fa110000-0000-4000-8000-000000000001','Gmail queue — isolated fixtures','gmail-queue-isolated-a','fb110000-0000-4000-8000-000000000001','active'),
('fa110000-0000-4000-8000-000000000002','Gmail queue — foreign fixtures','gmail-queue-isolated-b','fb110000-0000-4000-8000-000000000002','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','admin','active'),
('fa110000-0000-4000-8000-000000000002','fb110000-0000-4000-8000-000000000002','admin','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000003','member','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000004','admin','active'),
('fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000005','admin','inactive') ON CONFLICT(workspace_id,user_id) DO NOTHING;
INSERT INTO public.job_roles(id,owner_id,workspace_id,name) VALUES
('fd110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','Gmail fixture — explicit deny') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_job_roles(user_id,owner_id,workspace_id,role_id) VALUES
('fb110000-0000-4000-8000-000000000004','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001') ON CONFLICT(user_id,owner_id,role_id) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('techsales.email_accounts.view.own','techsales','email_accounts','view','own','Visualizar Contas de e-mail — próprios','Exige membro ativo, workspace selecionado, leitura base, escopo real do registro e regras do processo.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('techsales.email_accounts.view.team','techsales','email_accounts','view','team','Visualizar Contas de e-mail — equipe','Exige membro ativo, workspace selecionado, leitura base, escopo real do registro e regras do processo.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('techsales.email_accounts.view.workspace','techsales','email_accounts','view','workspace','Visualizar Contas de e-mail — workspace','Exige membro ativo, workspace selecionado, leitura base, escopo real do registro e regras do processo.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('techsales.email_accounts.update.workspace','techsales','email_accounts','update','workspace','Editar Contas de e-mail — workspace','Exige membro ativo, workspace selecionado, leitura base, escopo real do registro e regras do processo.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','techsales.email_accounts.view.own','deny','fb110000-0000-4000-8000-000000000001'),
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','techsales.email_accounts.view.team','deny','fb110000-0000-4000-8000-000000000001'),
('fa110000-0000-4000-8000-000000000001','fd110000-0000-4000-8000-000000000001','techsales.email_accounts.view.workspace','deny','fb110000-0000-4000-8000-000000000001') ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO public.email_accounts(id,workspace_id,owner_id,provider,email,status) VALUES
('fc110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','gmail','queue-a@example.invalid','error'),
('fc110000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000002','fb110000-0000-4000-8000-000000000002','gmail','queue-b@example.invalid','error'),
('fc110000-0000-4000-8000-000000000003','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000003','gmail','queue-missing@example.invalid','error'),
('fc110000-0000-4000-8000-000000000004','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000004','gmail','queue-denied@example.invalid','error'),
('fc110000-0000-4000-8000-000000000005','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000005','gmail','queue-inactive@example.invalid','error') ON CONFLICT(id) DO NOTHING;

INSERT INTO public.live_chat_sessions(id,workspace_id,owner_id,visitor_id,status) VALUES
('c0413000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','visitor_producer_test_1','open'),
('c0413000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000002','visitor_producer_test_2','open')
ON CONFLICT(id) DO NOTHING;

-- Preexisting mailbox copy, no content or external recipient; proves replay cannot create a new inbound occurrence.
INSERT INTO public.email_threads(id,workspace_id,owner_id,account_id,provider_thread_id) VALUES
('c0110000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000001','gmail_queue_fixture_thread') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction) VALUES
('c0110000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000001','c0110000-0000-4000-8000-000000000001','gmail_queue_fixture_preexisting','inbound') ON CONFLICT(account_id,provider_message_id) DO NOTHING;
