-- Order 3 completion: additive preparation. No grants to jobs or workspaces.
CREATE TABLE public.work_resource_catalog(resource text PRIMARY KEY,table_name name NOT NULL,responsible_columns text[] NOT NULL DEFAULT '{}',parent_column name,parent_resource text,shared boolean NOT NULL DEFAULT false);
ALTER TABLE public.work_resource_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_resource_catalog FROM PUBLIC,anon,authenticated;
INSERT INTO public.work_resource_catalog VALUES
('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id']::text[],NULL,NULL,false),
('techprojects.projects','projects',ARRAY['assigned_to','owner_id']::text[],NULL,NULL,false),
('techprojects.tasks','project_tasks',ARRAY['assignee_id']::text[],NULL,NULL,false),
('techservice.services','services',ARRAY['assigned_to','owner_id']::text[],NULL,NULL,false),
('techcontracts.contract_templates','contract_templates',ARRAY['assigned_to','owner_id']::text[],NULL,NULL,false),
('techcontracts.defaults','contract_defaults',ARRAY[]::text[],NULL,NULL,true),
('techcontracts.approvals','contract_approvals',ARRAY['approver_id','owner_id']::text[],'contract_id','techcontracts.contracts',false),
('techcontracts.audit','contract_events',ARRAY[]::text[],'contract_id','techcontracts.contracts',false),
('techcontracts.esign','esign_documents',ARRAY['owner_id']::text[],NULL,NULL,false),
('techprojects.spaces','project_spaces',ARRAY['created_by']::text[],NULL,NULL,false),
('techprojects.folders','project_folders',ARRAY['created_by']::text[],'space_id','techprojects.spaces',false),
('techprojects.lists','project_lists',ARRAY['assigned_to','created_by']::text[],'space_id','techprojects.spaces',false),
('techprojects.list_templates','project_list_templates',ARRAY['created_by']::text[],NULL,NULL,false),
('techprojects.milestones','project_milestones',ARRAY['assigned_to']::text[],'project_id','techprojects.projects',false),
('techprojects.project_updates','project_updates',ARRAY['assigned_to','owner_id']::text[],'project_id','techprojects.projects',false),
('techprojects.members','project_members',ARRAY['user_id']::text[],'project_id','techprojects.projects',false);
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES
('techcontracts.defaults.view.workspace','techcontracts','defaults','view','workspace','Visualizar padrões de contrato — workspace',true),
('techcontracts.defaults.manage.workspace','techcontracts','defaults','manage','workspace','Gerenciar padrões de contrato — workspace',true),
('techcontracts.audit.view.own','techcontracts','audit','view','own','Visualizar histórico de contratos — próprios',true),
('techcontracts.audit.view.team','techcontracts','audit','view','team','Visualizar histórico de contratos — equipe',true),
('techcontracts.audit.view.workspace','techcontracts','audit','view','workspace','Visualizar histórico de contratos — workspace',true),
('techcontracts.imports.view.workspace','techcontracts','imports','view','workspace','Visualizar importação de contratos — workspace',true),
('techcontracts.imports.manage.workspace','techcontracts','imports','manage','workspace','Gerenciar importação de contratos — workspace',true),
('techcontracts.links.view.workspace','techcontracts','links','view','workspace','Visualizar vínculos de contratos — workspace',true),
('techcontracts.links.manage.workspace','techcontracts','links','manage','workspace','Gerenciar vínculos de contratos — workspace',true),
('techcontracts.esign.view.own','techcontracts','esign','view','own','Visualizar assinaturas eletrônicas — próprios',true),
('techcontracts.esign.view.team','techcontracts','esign','view','team','Visualizar assinaturas eletrônicas — equipe',true),
('techcontracts.esign.view.workspace','techcontracts','esign','view','workspace','Visualizar assinaturas eletrônicas — workspace',true),
('techcontracts.esign.create.own','techcontracts','esign','create','own','Criar assinaturas eletrônicas — próprios',true),
('techcontracts.esign.create.team','techcontracts','esign','create','team','Criar assinaturas eletrônicas — equipe',true),
('techcontracts.esign.create.workspace','techcontracts','esign','create','workspace','Criar assinaturas eletrônicas — workspace',true),
('techcontracts.esign.update.own','techcontracts','esign','update','own','Editar assinaturas eletrônicas — próprios',true),
('techcontracts.esign.update.team','techcontracts','esign','update','team','Editar assinaturas eletrônicas — equipe',true),
('techcontracts.esign.update.workspace','techcontracts','esign','update','workspace','Editar assinaturas eletrônicas — workspace',true),
('techcontracts.esign.delete.own','techcontracts','esign','delete','own','Excluir assinaturas eletrônicas — próprios',true),
('techcontracts.esign.delete.team','techcontracts','esign','delete','team','Excluir assinaturas eletrônicas — equipe',true),
('techcontracts.esign.delete.workspace','techcontracts','esign','delete','workspace','Excluir assinaturas eletrônicas — workspace',true),
('techcontracts.esign.manage.workspace','techcontracts','esign','manage','workspace','Gerenciar assinaturas eletrônicas — workspace',true),
('techcontracts.esign_send.manage.workspace','techcontracts','esign_send','manage','workspace','Enviar assinaturas eletrônicas — workspace',true),
('techcontracts.esign_cancel.manage.workspace','techcontracts','esign_cancel','manage','workspace','Cancelar assinaturas eletrônicas — workspace',true),
('techcontracts.esign_share.manage.workspace','techcontracts','esign_share','manage','workspace','Compartilhar links de assinaturas eletrônicas — workspace',true),
('techcontracts.approvals.view.own','techcontracts','approvals','view','own','Visualizar aprovações de contrato — próprios',true),
('techcontracts.approvals.view.team','techcontracts','approvals','view','team','Visualizar aprovações de contrato — equipe',true),
('techcontracts.approvals.view.workspace','techcontracts','approvals','view','workspace','Visualizar aprovações de contrato — workspace',true),
('techcontracts.approvals.manage.workspace','techcontracts','approvals','manage','workspace','Gerenciar aprovações de contrato — workspace',true),
('techcontracts.approvals.approve.workspace','techcontracts','approvals','approve','workspace','Aprovar aprovações de contrato — workspace',true),
('techcontracts.contract_transition.manage.workspace','techcontracts','contract_transition','manage','workspace','Alterar situação de contratos — workspace',true),
('techcontracts.contract_activation.manage.workspace','techcontracts','contract_activation','manage','workspace','Ativar contratos — workspace',true),
('techprojects.members.view.own','techprojects','members','view','own','Visualizar membros do projeto — próprios',true),
('techprojects.members.view.team','techprojects','members','view','team','Visualizar membros do projeto — equipe',true),
('techprojects.members.view.workspace','techprojects','members','view','workspace','Visualizar membros do projeto — workspace',true),
('techprojects.members.manage.workspace','techprojects','members','manage','workspace','Gerenciar membros do projeto — workspace',true),
('techprojects.list_templates.view.own','techprojects','list_templates','view','own','Visualizar modelos de lista — próprios',true),
('techprojects.list_templates.view.team','techprojects','list_templates','view','team','Visualizar modelos de lista — equipe',true),
('techprojects.list_templates.view.workspace','techprojects','list_templates','view','workspace','Visualizar modelos de lista — workspace',true),
('techprojects.list_templates.manage.workspace','techprojects','list_templates','manage','workspace','Gerenciar modelos de lista — workspace',true),
('techprojects.custom_fields.view.workspace','techprojects','custom_fields','view','workspace','Visualizar campos personalizados — workspace',true),
('techprojects.custom_fields.manage.workspace','techprojects','custom_fields','manage','workspace','Gerenciar campos personalizados — workspace',true),
('techprojects.statuses.view.workspace','techprojects','statuses','view','workspace','Visualizar status de tarefas — workspace',true),
('techprojects.statuses.manage.workspace','techprojects','statuses','manage','workspace','Gerenciar status de tarefas — workspace',true),
('techprojects.clockify_import.view.workspace','techprojects','clockify_import','view','workspace','Visualizar importador Clockify — workspace',true),
('techprojects.clockify_import.manage.workspace','techprojects','clockify_import','manage','workspace','Gerenciar importador Clockify — workspace',true),
('techprojects.jibble_import.view.workspace','techprojects','jibble_import','view','workspace','Visualizar importador Jibble — workspace',true),
('techprojects.jibble_import.manage.workspace','techprojects','jibble_import','manage','workspace','Gerenciar importador Jibble — workspace',true),
('techprojects.reconciliation.view.workspace','techprojects','reconciliation','view','workspace','Visualizar conciliação de projetos — workspace',true),
('techprojects.reconciliation.manage.workspace','techprojects','reconciliation','manage','workspace','Gerenciar conciliação de projetos — workspace',true),
('techprojects.delivery.view.workspace','techprojects','delivery','view','workspace','Visualizar entrega de negócios — workspace',true),
('techprojects.delivery.manage.workspace','techprojects','delivery','manage','workspace','Gerenciar entrega de negócios — workspace',true),
('techprojects.time_policy.view.workspace','techprojects','time_policy','view','workspace','Visualizar política de horas — workspace',true),
('techprojects.time_policy.manage.workspace','techprojects','time_policy','manage','workspace','Gerenciar política de horas — workspace',true),
('techprojects.approvers.view.workspace','techprojects','approvers','view','workspace','Visualizar aprovadores de horas — workspace',true),
('techprojects.approvers.manage.workspace','techprojects','approvers','manage','workspace','Gerenciar aprovadores de horas — workspace',true),
('techprojects.delivery_templates.view.workspace','techprojects','delivery_templates','view','workspace','Visualizar modelos de entrega — workspace',true),
('techprojects.delivery_templates.manage.workspace','techprojects','delivery_templates','manage','workspace','Gerenciar modelos de entrega — workspace',true),
('techprojects.operations.view.workspace','techprojects','operations','view','workspace','Visualizar operação de projetos — workspace',true),
('techprojects.operations.manage.workspace','techprojects','operations','manage','workspace','Gerenciar operação de projetos — workspace',true),
('techprojects.time_tags.view.workspace','techprojects','time_tags','view','workspace','Visualizar etiquetas de horas — workspace',true),
('techprojects.time_tags.manage.workspace','techprojects','time_tags','manage','workspace','Gerenciar etiquetas de horas — workspace',true),
('techprojects.milestone_billing.create.workspace','techprojects','milestone_billing','create','workspace','Criar cobrança de marcos — workspace',true),
('techprojects.profitability.view.workspace','techprojects','profitability','view','workspace','Visualizar rentabilidade — workspace',true),
('techprojects.rates.view.workspace','techprojects','rates','view','workspace','Visualizar tarifas e custos — workspace',true),
('techprojects.rates.manage.workspace','techprojects','rates','manage','workspace','Gerenciar tarifas e custos — workspace',true),
('techprojects.billing_config.view.workspace','techprojects','billing_config','view','workspace','Visualizar configuração de cobrança — workspace',true),
('techprojects.billing_config.manage.workspace','techprojects','billing_config','manage','workspace','Gerenciar configuração de cobrança — workspace',true),
('techprojects.measurements.view.workspace','techprojects','measurements','view','workspace','Visualizar medições — workspace',true),
('techprojects.measurements.manage.workspace','techprojects','measurements','manage','workspace','Gerenciar medições — workspace',true),
('techprojects.measurements.approve.workspace','techprojects','measurements','approve','workspace','Aprovar medições — workspace',true),
('techprojects.measurements.export.workspace','techprojects','measurements','export','workspace','Exportar medições — workspace',true),
('techprojects.measurement_finance.create.workspace','techprojects','measurement_finance','create','workspace','Criar lançamentos de medições — workspace',true),
('techprojects.measurement_reverse.manage.workspace','techprojects','measurement_reverse','manage','workspace','Gerenciar estorno de medições — workspace',true),
('techprojects.alerts.view.workspace','techprojects','alerts','view','workspace','Visualizar alertas de projetos — workspace',true),
('techprojects.alerts.manage.workspace','techprojects','alerts','manage','workspace','Gerenciar alertas de projetos — workspace',true),
('techprojects.risk_rules.view.workspace','techprojects','risk_rules','view','workspace','Visualizar regras de risco — workspace',true),
('techprojects.risk_rules.manage.workspace','techprojects','risk_rules','manage','workspace','Gerenciar regras de risco — workspace',true),
('techprojects.projects.view.own','techprojects','projects','view','own','Visualizar projetos — próprios',true),
('techprojects.projects.view.team','techprojects','projects','view','team','Visualizar projetos — equipe',true),
('techprojects.projects.view.workspace','techprojects','projects','view','workspace','Visualizar projetos — workspace',true),
('techprojects.projects.create.own','techprojects','projects','create','own','Criar projetos — próprios',true),
('techprojects.projects.create.team','techprojects','projects','create','team','Criar projetos — equipe',true),
('techprojects.projects.create.workspace','techprojects','projects','create','workspace','Criar projetos — workspace',true),
('techprojects.projects.update.own','techprojects','projects','update','own','Editar projetos — próprios',true),
('techprojects.projects.update.team','techprojects','projects','update','team','Editar projetos — equipe',true),
('techprojects.projects.update.workspace','techprojects','projects','update','workspace','Editar projetos — workspace',true),
('techprojects.projects.delete.own','techprojects','projects','delete','own','Excluir projetos — próprios',true),
('techprojects.projects.delete.team','techprojects','projects','delete','team','Excluir projetos — equipe',true),
('techprojects.projects.delete.workspace','techprojects','projects','delete','workspace','Excluir projetos — workspace',true),
('techprojects.projects.export.workspace','techprojects','projects','export','workspace','Exportar projetos — workspace',true),
('techprojects.tasks.view.own','techprojects','tasks','view','own','Visualizar tarefas — próprios',true),
('techprojects.tasks.view.team','techprojects','tasks','view','team','Visualizar tarefas — equipe',true),
('techprojects.tasks.view.workspace','techprojects','tasks','view','workspace','Visualizar tarefas — workspace',true),
('techprojects.tasks.create.own','techprojects','tasks','create','own','Criar tarefas — próprios',true),
('techprojects.tasks.create.team','techprojects','tasks','create','team','Criar tarefas — equipe',true),
('techprojects.tasks.create.workspace','techprojects','tasks','create','workspace','Criar tarefas — workspace',true),
('techprojects.tasks.update.own','techprojects','tasks','update','own','Editar tarefas — próprios',true),
('techprojects.tasks.update.team','techprojects','tasks','update','team','Editar tarefas — equipe',true),
('techprojects.tasks.update.workspace','techprojects','tasks','update','workspace','Editar tarefas — workspace',true),
('techprojects.tasks.delete.own','techprojects','tasks','delete','own','Excluir tarefas — próprios',true),
('techprojects.tasks.delete.team','techprojects','tasks','delete','team','Excluir tarefas — equipe',true),
('techprojects.tasks.delete.workspace','techprojects','tasks','delete','workspace','Excluir tarefas — workspace',true),
('techprojects.tasks.export.workspace','techprojects','tasks','export','workspace','Exportar tarefas — workspace',true),
('techservice.services.view.own','techservice','services','view','own','Visualizar serviços contratados — próprios',true),
('techservice.services.view.team','techservice','services','view','team','Visualizar serviços contratados — equipe',true),
('techservice.services.view.workspace','techservice','services','view','workspace','Visualizar serviços contratados — workspace',true),
('techservice.services.create.own','techservice','services','create','own','Criar serviços contratados — próprios',true),
('techservice.services.create.team','techservice','services','create','team','Criar serviços contratados — equipe',true),
('techservice.services.create.workspace','techservice','services','create','workspace','Criar serviços contratados — workspace',true),
('techservice.services.update.own','techservice','services','update','own','Editar serviços contratados — próprios',true),
('techservice.services.update.team','techservice','services','update','team','Editar serviços contratados — equipe',true),
('techservice.services.update.workspace','techservice','services','update','workspace','Editar serviços contratados — workspace',true),
('techservice.services.delete.own','techservice','services','delete','own','Excluir serviços contratados — próprios',true),
('techservice.services.delete.team','techservice','services','delete','team','Excluir serviços contratados — equipe',true),
('techservice.services.delete.workspace','techservice','services','delete','workspace','Excluir serviços contratados — workspace',true),
('techservice.services.export.workspace','techservice','services','export','workspace','Exportar serviços contratados — workspace',true),
('techcontracts.contract_templates.view.own','techcontracts','contract_templates','view','own','Visualizar modelos de contrato — próprios',true),
('techcontracts.contract_templates.view.team','techcontracts','contract_templates','view','team','Visualizar modelos de contrato — equipe',true),
('techcontracts.contract_templates.view.workspace','techcontracts','contract_templates','view','workspace','Visualizar modelos de contrato — workspace',true),
('techcontracts.contract_templates.create.own','techcontracts','contract_templates','create','own','Criar modelos de contrato — próprios',true),
('techcontracts.contract_templates.create.team','techcontracts','contract_templates','create','team','Criar modelos de contrato — equipe',true),
('techcontracts.contract_templates.create.workspace','techcontracts','contract_templates','create','workspace','Criar modelos de contrato — workspace',true),
('techcontracts.contract_templates.update.own','techcontracts','contract_templates','update','own','Editar modelos de contrato — próprios',true),
('techcontracts.contract_templates.update.team','techcontracts','contract_templates','update','team','Editar modelos de contrato — equipe',true),
('techcontracts.contract_templates.update.workspace','techcontracts','contract_templates','update','workspace','Editar modelos de contrato — workspace',true),
('techcontracts.contract_templates.delete.own','techcontracts','contract_templates','delete','own','Excluir modelos de contrato — próprios',true),
('techcontracts.contract_templates.delete.team','techcontracts','contract_templates','delete','team','Excluir modelos de contrato — equipe',true),
('techcontracts.contract_templates.delete.workspace','techcontracts','contract_templates','delete','workspace','Excluir modelos de contrato — workspace',true),
('techcontracts.contract_templates.export.workspace','techcontracts','contract_templates','export','workspace','Exportar modelos de contrato — workspace',true),
('techprojects.spaces.view.own','techprojects','spaces','view','own','Visualizar espaços — próprios',true),
('techprojects.spaces.view.team','techprojects','spaces','view','team','Visualizar espaços — equipe',true),
('techprojects.spaces.view.workspace','techprojects','spaces','view','workspace','Visualizar espaços — workspace',true),
('techprojects.spaces.create.own','techprojects','spaces','create','own','Criar espaços — próprios',true),
('techprojects.spaces.create.team','techprojects','spaces','create','team','Criar espaços — equipe',true),
('techprojects.spaces.create.workspace','techprojects','spaces','create','workspace','Criar espaços — workspace',true),
('techprojects.spaces.update.own','techprojects','spaces','update','own','Editar espaços — próprios',true),
('techprojects.spaces.update.team','techprojects','spaces','update','team','Editar espaços — equipe',true),
('techprojects.spaces.update.workspace','techprojects','spaces','update','workspace','Editar espaços — workspace',true),
('techprojects.spaces.delete.own','techprojects','spaces','delete','own','Excluir espaços — próprios',true),
('techprojects.spaces.delete.team','techprojects','spaces','delete','team','Excluir espaços — equipe',true),
('techprojects.spaces.delete.workspace','techprojects','spaces','delete','workspace','Excluir espaços — workspace',true),
('techprojects.spaces.export.workspace','techprojects','spaces','export','workspace','Exportar espaços — workspace',true),
('techprojects.folders.view.own','techprojects','folders','view','own','Visualizar pastas — próprios',true),
('techprojects.folders.view.team','techprojects','folders','view','team','Visualizar pastas — equipe',true),
('techprojects.folders.view.workspace','techprojects','folders','view','workspace','Visualizar pastas — workspace',true),
('techprojects.folders.create.own','techprojects','folders','create','own','Criar pastas — próprios',true),
('techprojects.folders.create.team','techprojects','folders','create','team','Criar pastas — equipe',true),
('techprojects.folders.create.workspace','techprojects','folders','create','workspace','Criar pastas — workspace',true),
('techprojects.folders.update.own','techprojects','folders','update','own','Editar pastas — próprios',true),
('techprojects.folders.update.team','techprojects','folders','update','team','Editar pastas — equipe',true),
('techprojects.folders.update.workspace','techprojects','folders','update','workspace','Editar pastas — workspace',true),
('techprojects.folders.delete.own','techprojects','folders','delete','own','Excluir pastas — próprios',true),
('techprojects.folders.delete.team','techprojects','folders','delete','team','Excluir pastas — equipe',true),
('techprojects.folders.delete.workspace','techprojects','folders','delete','workspace','Excluir pastas — workspace',true),
('techprojects.folders.export.workspace','techprojects','folders','export','workspace','Exportar pastas — workspace',true),
('techprojects.lists.view.own','techprojects','lists','view','own','Visualizar listas — próprios',true),
('techprojects.lists.view.team','techprojects','lists','view','team','Visualizar listas — equipe',true),
('techprojects.lists.view.workspace','techprojects','lists','view','workspace','Visualizar listas — workspace',true),
('techprojects.lists.create.own','techprojects','lists','create','own','Criar listas — próprios',true),
('techprojects.lists.create.team','techprojects','lists','create','team','Criar listas — equipe',true),
('techprojects.lists.create.workspace','techprojects','lists','create','workspace','Criar listas — workspace',true),
('techprojects.lists.update.own','techprojects','lists','update','own','Editar listas — próprios',true),
('techprojects.lists.update.team','techprojects','lists','update','team','Editar listas — equipe',true),
('techprojects.lists.update.workspace','techprojects','lists','update','workspace','Editar listas — workspace',true),
('techprojects.lists.delete.own','techprojects','lists','delete','own','Excluir listas — próprios',true),
('techprojects.lists.delete.team','techprojects','lists','delete','team','Excluir listas — equipe',true),
('techprojects.lists.delete.workspace','techprojects','lists','delete','workspace','Excluir listas — workspace',true),
('techprojects.lists.export.workspace','techprojects','lists','export','workspace','Exportar listas — workspace',true),
('techprojects.milestones.view.own','techprojects','milestones','view','own','Visualizar marcos — próprios',true),
('techprojects.milestones.view.team','techprojects','milestones','view','team','Visualizar marcos — equipe',true),
('techprojects.milestones.view.workspace','techprojects','milestones','view','workspace','Visualizar marcos — workspace',true),
('techprojects.milestones.create.own','techprojects','milestones','create','own','Criar marcos — próprios',true),
('techprojects.milestones.create.team','techprojects','milestones','create','team','Criar marcos — equipe',true),
('techprojects.milestones.create.workspace','techprojects','milestones','create','workspace','Criar marcos — workspace',true),
('techprojects.milestones.update.own','techprojects','milestones','update','own','Editar marcos — próprios',true),
('techprojects.milestones.update.team','techprojects','milestones','update','team','Editar marcos — equipe',true),
('techprojects.milestones.update.workspace','techprojects','milestones','update','workspace','Editar marcos — workspace',true),
('techprojects.milestones.delete.own','techprojects','milestones','delete','own','Excluir marcos — próprios',true),
('techprojects.milestones.delete.team','techprojects','milestones','delete','team','Excluir marcos — equipe',true),
('techprojects.milestones.delete.workspace','techprojects','milestones','delete','workspace','Excluir marcos — workspace',true),
('techprojects.milestones.export.workspace','techprojects','milestones','export','workspace','Exportar marcos — workspace',true),
('techprojects.project_updates.view.own','techprojects','project_updates','view','own','Visualizar atualizações do projeto — próprios',true),
('techprojects.project_updates.view.team','techprojects','project_updates','view','team','Visualizar atualizações do projeto — equipe',true),
('techprojects.project_updates.view.workspace','techprojects','project_updates','view','workspace','Visualizar atualizações do projeto — workspace',true),
('techprojects.project_updates.create.own','techprojects','project_updates','create','own','Criar atualizações do projeto — próprios',true),
('techprojects.project_updates.create.team','techprojects','project_updates','create','team','Criar atualizações do projeto — equipe',true),
('techprojects.project_updates.create.workspace','techprojects','project_updates','create','workspace','Criar atualizações do projeto — workspace',true),
('techprojects.project_updates.update.own','techprojects','project_updates','update','own','Editar atualizações do projeto — próprios',true),
('techprojects.project_updates.update.team','techprojects','project_updates','update','team','Editar atualizações do projeto — equipe',true),
('techprojects.project_updates.update.workspace','techprojects','project_updates','update','workspace','Editar atualizações do projeto — workspace',true),
('techprojects.project_updates.delete.own','techprojects','project_updates','delete','own','Excluir atualizações do projeto — próprios',true),
('techprojects.project_updates.delete.team','techprojects','project_updates','delete','team','Excluir atualizações do projeto — equipe',true),
('techprojects.project_updates.delete.workspace','techprojects','project_updates','delete','workspace','Excluir atualizações do projeto — workspace',true),
('techprojects.project_updates.export.workspace','techprojects','project_updates','export','workspace','Exportar atualizações do projeto — workspace',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.work_action_prefix(r text,a text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN r='techcontracts.esign' AND a IN('send','cancel','share') THEN 'techcontracts.esign_'||a||'.manage' WHEN r='techcontracts.contracts' AND a='transition' THEN 'techcontracts.contract_transition.manage' WHEN r='techcontracts.contracts' AND a='activate' THEN 'techcontracts.contract_activation.manage' ELSE r||'.'||a END $$;
REVOKE ALL ON FUNCTION public.work_action_prefix(text,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_action_prefix(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_context_access(c jsonb,w uuid,r text,a text,responsibles uuid[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor' IS NOT NULL
 AND r IN ('techcontracts.defaults','techcontracts.audit','techcontracts.imports','techcontracts.links','techcontracts.esign','techcontracts.approvals','techcontracts.contracts','techcontracts.financials','techservice.financials','techprojects.members','techprojects.list_templates','techprojects.custom_fields','techprojects.statuses','techprojects.clockify_import','techprojects.jibble_import','techprojects.reconciliation','techprojects.delivery','techprojects.time_policy','techprojects.approvers','techprojects.delivery_templates','techprojects.operations','techprojects.time_tags','techprojects.milestone_billing','techprojects.profitability','techprojects.rates','techprojects.billing_config','techprojects.measurements','techprojects.measurement_finance','techprojects.measurement_reverse','techprojects.alerts','techprojects.risk_rules','techprojects.projects','techprojects.tasks','techservice.services','techcontracts.contract_templates','techprojects.spaces','techprojects.folders','techprojects.lists','techprojects.milestones','techprojects.project_updates')
 AND a IN('view','create','update','delete','export','assign','manage','approve','transition','activate','send','cancel','share')
 AND (a='view' OR NOT (c->>'read_only')::boolean)
 AND (c->'keys' ? (work_action_prefix(r,a)||'.workspace')
 OR (c->'keys' ? (work_action_prefix(r,a)||'.own') AND (c->>'actor')::uuid=ANY(responsibles))
 OR (c->'keys' ? (work_action_prefix(r,a)||'.team') AND EXISTS(SELECT 1 FROM unnest(responsibles)x WHERE c->'team' ? x::text))),false)
$$;
CREATE OR REPLACE FUNCTION public.work_record_context_access(c jsonb,r text,i uuid,a text,depth integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg work_resource_catalog;j jsonb;s uuid[];col text;parent uuid;BEGIN
 IF depth>8 OR c->>'actor' IS NULL THEN RETURN false;END IF;
 SELECT * INTO cfg FROM work_resource_catalog WHERE resource=r;
 IF cfg.resource IS NULL THEN RETURN false;END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',cfg.table_name) INTO j USING i;
 IF j IS NULL OR j->>'workspace_id' IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 IF r='techprojects.tasks' THEN SELECT array_append(coalesce(array_agg(x::uuid),'{}'),(j->>'assignee_id')::uuid) INTO s FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(j->'assignee_ids')='array' THEN j->'assignee_ids' ELSE '[]'::jsonb END)x;
 ELSE FOREACH col IN ARRAY cfg.responsible_columns LOOP IF j->>col IS NOT NULL THEN s:=ARRAY[(j->>col)::uuid];EXIT;END IF;END LOOP;END IF;
 IF r='techcontracts.audit' THEN SELECT ARRAY[coalesce(t.assigned_to,t.owner_id)] INTO s FROM contracts t WHERE t.id=(j->>'contract_id')::uuid AND t.workspace_id=(c->>'workspace')::uuid;END IF;
 IF s IS NULL THEN s:='{}';END IF;
 IF NOT work_context_access(c,(j->>'workspace_id')::uuid,r,a,s) OR (a<>'view' AND NOT work_context_access(c,(j->>'workspace_id')::uuid,r,'view',s)) THEN RETURN false;END IF;
 IF cfg.parent_column IS NOT NULL THEN parent:=(j->>cfg.parent_column)::uuid;IF parent IS NULL OR NOT work_record_context_access(c,cfg.parent_resource,parent,'view',depth+1) THEN RETURN false;END IF;END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.work_record_context_access(jsonb,text,uuid,text,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_record_access(r text,i uuid,a text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT work_record_context_access(work_access_context(),r,i,a) $$;
CREATE OR REPLACE FUNCTION public.work_area_authorize(r text,a text,i uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;BEGIN
 IF w IS NULL OR (a<>'view' AND (c->>'read_only')::boolean) THEN RAISE EXCEPTION 'Acesso não autorizado.' USING ERRCODE='42501';END IF;
 IF a<>'view' AND EXISTS(SELECT 1 FROM permissions WHERE key LIKE r||'.view.%') AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k=ANY(ARRAY[r||'.view.workspace',r||'.view.team',r||'.view.own'])) THEN RAISE EXCEPTION 'Leitura do recurso não autorizada.' USING ERRCODE='42501';END IF;
 IF i IS NOT NULL THEN IF work_record_context_access(c,r,i,a) THEN RETURN w;END IF;
 ELSIF EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k=ANY(ARRAY[work_action_prefix(r,a)||'.workspace',work_action_prefix(r,a)||'.team',work_action_prefix(r,a)||'.own'])) THEN RETURN w;END IF;
 RAISE EXCEPTION 'Sem permissão para esta ação.' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION public.work_area_authorize(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.work_area_authorize(text,text,uuid) TO authenticated;
ALTER TABLE public.contract_approvals ADD COLUMN generation uuid,ADD COLUMN superseded_at timestamptz;
CREATE INDEX contract_approvals_active_chain ON public.contract_approvals(contract_id,sort_order) WHERE superseded_at IS NULL;
CREATE OR REPLACE FUNCTION public.contract_approval_start(p_contract uuid,p_stages text[] DEFAULT NULL,p_reset boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;stages text[];g uuid:=gen_random_uuid();outrows jsonb;BEGIN
 PERFORM work_area_authorize('techcontracts.approvals','manage');
 IF NOT work_record_access('techcontracts.contracts',p_contract,'update') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 IF c.status IN('active','ended','terminated') THEN RAISE EXCEPTION 'Contrato encerrado ou vigente: use aditivo para novo processo.' USING ERRCODE='23514';END IF;
 stages:=CASE c.role WHEN 'client' THEN ARRAY['purchasing','finance','legal'] ELSE ARRAY['legal','finance'] END;
 IF p_stages IS NOT NULL AND p_stages IS DISTINCT FROM stages THEN RAISE EXCEPTION 'A cadeia de aprovação não pode ser omitida ou reduzida.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL) THEN
 IF NOT p_reset THEN SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort_order) INTO outrows FROM contract_approvals x WHERE contract_id=c.id AND superseded_at IS NULL;RETURN jsonb_build_object('started',false,'approvals',outrows);END IF;
 UPDATE contract_approvals SET superseded_at=now() WHERE contract_id=c.id AND superseded_at IS NULL;
 END IF;
 INSERT INTO contract_approvals(workspace_id,owner_id,contract_id,stage,sort_order,status,generation)
 SELECT c.workspace_id,auth.uid(),c.id,x::contract_approval_stage,n-1,'pending',g FROM unnest(stages) WITH ORDINALITY s(x,n);
 UPDATE contracts SET status='in_review' WHERE id=c.id;
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(c.workspace_id,c.id,auth.uid(),CASE WHEN p_reset THEN 'approvals_reset' ELSE 'approvals_started' END,jsonb_build_object('stages',stages,'generation',g));
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort_order) INTO outrows FROM contract_approvals x WHERE contract_id=c.id AND superseded_at IS NULL;
 RETURN jsonb_build_object('started',true,'approvals',outrows);
END $$;
CREATE OR REPLACE FUNCTION public.contract_approval_decide(p_approval uuid,p_decision text,p_comment text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a contract_approvals;c contracts;s text;BEGIN
 PERFORM work_area_authorize('techcontracts.approvals','approve');
 SELECT * INTO a FROM contract_approvals WHERE id=p_approval;
 IF a.id IS NULL OR NOT work_record_access('techcontracts.approvals',a.id,'approve') OR NOT work_record_access('techcontracts.contracts',a.contract_id,'view') THEN RAISE EXCEPTION 'Aprovação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=a.contract_id FOR UPDATE;
 SELECT * INTO a FROM contract_approvals WHERE id=p_approval FOR UPDATE;
 IF a.superseded_at IS NOT NULL OR a.status<>'pending' OR c.status<>'in_review' THEN RAISE EXCEPTION 'Etapa já decidida ou processo indisponível.' USING ERRCODE='23514';END IF;
 IF a.approver_id IS NOT NULL AND a.approver_id<>auth.uid() THEN RAISE EXCEPTION 'A etapa foi atribuída a outra pessoa.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND sort_order<a.sort_order AND status<>'approved') THEN RAISE EXCEPTION 'Conclua a etapa anterior.' USING ERRCODE='23514';END IF;
 IF p_decision NOT IN('approved','rejected') OR length(coalesce(p_comment,''))>2000 OR (p_decision='rejected' AND length(trim(coalesce(p_comment,'')))=0) THEN RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE='22023';END IF;
 UPDATE contract_approvals SET status=p_decision::contract_approval_status,comment=p_comment,decided_at=now(),decided_by=auth.uid(),approver_id=coalesce(approver_id,auth.uid()) WHERE id=a.id;
 IF p_decision='rejected' THEN s:='in_negotiation';ELSIF NOT EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND status<>'approved') THEN s:='awaiting_signature';END IF;
 IF s IS NOT NULL THEN UPDATE contracts SET status=s::contract_status WHERE id=c.id;END IF;
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(c.workspace_id,c.id,auth.uid(),'approval_'||p_decision,jsonb_build_object('stage',a.stage,'comment',p_comment,'generation',a.generation));
 RETURN jsonb_build_object('status',p_decision,'contractStatus',s);
END $$;
REVOKE ALL ON FUNCTION public.contract_approval_start(uuid,text[],boolean),public.contract_approval_decide(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_approval_start(uuid,text[],boolean),public.contract_approval_decide(uuid,text,text) TO authenticated;
-- JSON projection is the only privileged read boundary for protected prices/costs.
CREATE OR REPLACE FUNCTION public.work_record_json(r text,i uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg work_resource_catalog;j jsonb;c jsonb:=work_access_context();hidden text[];financial_resource text;allowed boolean;BEGIN
 IF NOT work_record_context_access(c,r,i,'view') THEN RAISE EXCEPTION 'Registro indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO cfg FROM work_resource_catalog WHERE resource=r;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',cfg.table_name) INTO j USING i;
 hidden:=CASE r WHEN 'techcontracts.contracts' THEN ARRAY['public_token'] WHEN 'techservice.services' THEN ARRAY[]::text[] WHEN 'techprojects.projects' THEN ARRAY['planned_cost'] WHEN 'techprojects.members' THEN ARRAY['cost_rate_hour','bill_rate_hour'] WHEN 'techprojects.milestones' THEN ARRAY[]::text[] WHEN 'techcontracts.esign' THEN ARRAY[]::text[] ELSE ARRAY[]::text[] END;
 financial_resource:=CASE WHEN r='techcontracts.contracts' THEN 'techcontracts.financials' WHEN r='techservice.services' THEN 'techservice.financials' ELSE 'techprojects.profitability' END;
 allowed:=r IN('techcontracts.contracts','techservice.services','techprojects.milestones') OR (r IN('techprojects.projects','techprojects.members') AND coalesce(c->'keys'?'techprojects.rates.view.workspace',false)) OR work_context_access(c,(j->>'workspace_id')::uuid,financial_resource,'view','{}');
 IF NOT allowed THEN SELECT coalesce(jsonb_object_agg(k,NULL),'{}') INTO c FROM unnest(hidden)k;j:=j||c;END IF;
 -- A sharing capability is never inherited from financial read.
 IF r='techcontracts.contracts' THEN j:=j-'public_token';END IF;
 RETURN j||jsonb_build_object('financials_visible',allowed);
END $$;
REVOKE ALL ON FUNCTION public.work_record_json(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.work_record_json(text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_transition(p_contract uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;BEGIN
 PERFORM work_area_authorize('techcontracts.contracts','transition',p_contract);
 IF NOT work_record_access('techcontracts.contracts',p_contract,'update') THEN RAISE EXCEPTION 'Edição não autorizada.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 IF c.status::text=p_status THEN RETURN;END IF;
 IF p_status NOT IN('draft','in_negotiation','active','renewing','ended','terminated') THEN RAISE EXCEPTION 'Use o fluxo de aprovações para esta situação.' USING ERRCODE='23514';END IF;
 IF p_status='active' THEN PERFORM work_area_authorize('techcontracts.contracts','activate',p_contract);END IF;
 IF EXISTS(SELECT 1 FROM contract_approvals WHERE contract_id=c.id AND superseded_at IS NULL AND status='pending') THEN RAISE EXCEPTION 'Conclua ou reinicie o fluxo de aprovação antes de alterar a situação.' USING ERRCODE='23514';END IF;
 UPDATE contracts SET status=p_status::contract_status WHERE id=c.id;
END $$;
REVOKE ALL ON FUNCTION public.contract_transition(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_transition(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_mutate(p_contract uuid,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE current_status text;next_status text;k text;assignments text;affected bigint;BEGIN
 PERFORM work_area_authorize('techcontracts.contracts','update',p_contract);
 IF jsonb_typeof(p_patch)<>'object' OR octet_length(p_patch::text)>500000 THEN RAISE EXCEPTION 'Alteração inválida.';END IF;
 SELECT status::text INTO current_status FROM contracts WHERE id=p_contract FOR UPDATE;
 IF current_status IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 next_status:=p_patch->>'status';p_patch:=p_patch-'status';
 FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
 IF k IN('id','workspace_id','owner_id','created_at','updated_at','public_token','signature_document_id','signature_operation_id','signature_provider') OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.contracts'::regclass AND attname=k AND attnum>0 AND NOT attisdropped) THEN RAISE EXCEPTION 'Campo protegido ou inválido.' USING ERRCODE='42501';END IF;
 END LOOP;
 SELECT string_agg(format('%I=p.%I',x,x),',') INTO assignments FROM jsonb_object_keys(p_patch)x;
 IF assignments IS NOT NULL THEN EXECUTE format('UPDATE public.contracts c SET %s FROM jsonb_populate_record(NULL::public.contracts,$1)p WHERE c.id=$2',assignments) USING p_patch,p_contract;GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Nenhum contrato foi alterado.';END IF;END IF;
 IF next_status IS NOT NULL AND next_status<>current_status THEN PERFORM contract_transition(p_contract,next_status);END IF;
 RETURN work_record_json('techcontracts.contracts',p_contract);
END $$;
REVOKE ALL ON FUNCTION public.contract_mutate(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_mutate(uuid,jsonb) TO authenticated;

-- Remaining editable structure: all parent references are checked in the same tenant.
INSERT INTO work_resource_catalog VALUES('techprojects.statuses','project_task_statuses',ARRAY[]::text[],'list_id','techprojects.lists',true) ON CONFLICT(resource) DO NOTHING;
INSERT INTO work_resource_catalog VALUES('techprojects.custom_fields','project_list_custom_fields',ARRAY[]::text[],'list_id','techprojects.lists',true) ON CONFLICT(resource) DO NOTHING;
CREATE OR REPLACE FUNCTION public.work_row_access(r text,j jsonb,a text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg work_resource_catalog;c jsonb:=work_access_context();s uuid[]:='{}';col text;parent uuid;BEGIN
 SELECT * INTO cfg FROM work_resource_catalog WHERE resource=r;
 IF cfg.resource IS NULL OR j->>'workspace_id' IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 FOREACH col IN ARRAY cfg.responsible_columns LOOP IF j->>col IS NOT NULL THEN s:=ARRAY[(j->>col)::uuid];EXIT;END IF;END LOOP;
 IF NOT work_context_access(c,(j->>'workspace_id')::uuid,r,a,s) OR (a<>'view' AND NOT work_context_access(c,(j->>'workspace_id')::uuid,r,'view',s)) THEN RETURN false;END IF;
 IF cfg.parent_column IS NOT NULL THEN parent:=(j->>cfg.parent_column)::uuid;IF parent IS NULL OR NOT work_record_context_access(c,cfg.parent_resource,parent,'view') THEN RETURN false;END IF;END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.work_row_access(text,jsonb,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_row_access(text,jsonb,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_structure_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE j jsonb:=to_jsonb(NEW);oldj jsonb;col text;v uuid;target text;target_ws uuid;cfg work_resource_catalog;BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='project_members' THEN IF TG_OP='INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN IF NOT is_workspace_member(NEW.workspace_id,NEW.user_id) THEN RAISE EXCEPTION 'Membro inativo ou de outro workspace.' USING ERRCODE='42501';END IF;END IF;END IF;
 IF TG_OP='INSERT' AND j->>'assigned_to' IS NOT NULL AND j->>'assigned_to'<>auth.uid()::text THEN PERFORM work_area_authorize(TG_ARGV[0],'assign');END IF;
 IF j->>'assigned_to' IS NOT NULL AND (TG_OP='INSERT' OR j->'assigned_to' IS DISTINCT FROM to_jsonb(OLD)->'assigned_to') THEN IF NOT is_workspace_member(NEW.workspace_id,(j->>'assigned_to')::uuid) THEN RAISE EXCEPTION 'Responsável inativo ou de outro workspace.' USING ERRCODE='42501';END IF;END IF;
 IF TG_OP='UPDATE' THEN
 oldj:=to_jsonb(OLD);
 FOREACH col IN ARRAY ARRAY['id','workspace_id','owner_id','created_by','created_at','author_id'] LOOP
 IF j?col AND j->col IS DISTINCT FROM oldj->col THEN RAISE EXCEPTION 'Identidade do registro não pode ser alterada.' USING ERRCODE='42501';END IF;END LOOP;
 IF j?'assigned_to' AND j->'assigned_to' IS DISTINCT FROM oldj->'assigned_to' THEN PERFORM work_area_authorize(TG_ARGV[0],'assign',NEW.id);END IF;
 END IF;
 -- Registry names come only from migration-owned trigger arguments; never from user input.
 FOREACH col IN ARRAY ARRAY['space_id','folder_id','project_id','list_id','task_id','depends_on_task_id','contract_id','template_id','document_id'] LOOP
 IF NOT j?col OR j->>col IS NULL OR (TG_OP='UPDATE' AND j->col IS NOT DISTINCT FROM oldj->col) THEN CONTINUE;END IF;
 v:=(j->>col)::uuid;
 target:=CASE col WHEN 'space_id' THEN 'project_spaces' WHEN 'folder_id' THEN 'project_folders' WHEN 'project_id' THEN 'projects' WHEN 'list_id' THEN 'project_lists' WHEN 'task_id' THEN 'project_tasks' WHEN 'depends_on_task_id' THEN 'project_tasks' WHEN 'contract_id' THEN 'contracts' WHEN 'template_id' THEN 'contract_templates' WHEN 'document_id' THEN 'esign_documents' END;
 EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',target) INTO target_ws USING v;
 IF target_ws IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'Vínculo indisponível ou de outro workspace.' USING ERRCODE='42501';END IF;
 END LOOP;
 IF TG_TABLE_NAME='project_lists' THEN IF NEW.folder_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_folders f WHERE f.id=NEW.folder_id AND f.space_id=NEW.space_id) THEN RAISE EXCEPTION 'Pasta pertence a outro espaço.' USING ERRCODE='23514';END IF;END IF;
 IF TG_TABLE_NAME='project_milestones' AND TG_OP='INSERT' THEN NEW.assigned_to:=coalesce(NEW.assigned_to,auth.uid());END IF;
 IF TG_TABLE_NAME='project_task_dependencies' THEN
 PERFORM pg_advisory_xact_lock(hashtext('project_task_dependencies:'||NEW.workspace_id));
 IF NEW.task_id=NEW.depends_on_task_id OR EXISTS(WITH RECURSIVE walk(id) AS(SELECT NEW.depends_on_task_id UNION SELECT d.depends_on_task_id FROM project_task_dependencies d JOIN walk w ON d.task_id=w.id WHERE d.workspace_id=NEW.workspace_id AND d.id<>NEW.id) SELECT 1 FROM walk WHERE id=NEW.task_id) THEN RAISE EXCEPTION 'Dependência circular não permitida.' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_TABLE_NAME='project_task_checklists' THEN
 IF TG_OP='INSERT' AND (NEW.is_done OR NEW.done_by IS NOT NULL OR NEW.done_at IS NOT NULL) THEN RAISE EXCEPTION 'Novo item deve estar pendente.';END IF;
 IF TG_OP='UPDATE' THEN IF NEW.is_done IS DISTINCT FROM OLD.is_done THEN NEW.done_by:=CASE WHEN NEW.is_done THEN auth.uid() END;NEW.done_at:=CASE WHEN NEW.is_done THEN now() END;ELSIF NEW.done_by IS DISTINCT FROM OLD.done_by OR NEW.done_at IS DISTINCT FROM OLD.done_at THEN RAISE EXCEPTION 'Autoria da conclusão é protegida.' USING ERRCODE='42501';END IF;END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_structure_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.project_list_create_checked(p_data jsonb,p_template uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid;u uuid:=auth.uid();l project_lists;t project_list_templates;s jsonb;f jsonb;statuses jsonb;fields jsonb;position integer:=0;BEGIN
 w:=work_area_authorize('techprojects.lists','create');
 IF NOT work_context_access(c,w,'techprojects.lists','create',ARRAY[u]) OR NOT work_context_access(c,w,'techprojects.lists','view',ARRAY[u]) THEN RAISE EXCEPTION 'Criação não autorizada.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_data)<>'object' OR length(trim(coalesce(p_data->>'name','')))=0 OR length(p_data->>'name')>500 THEN RAISE EXCEPTION 'Nome da lista inválido.';END IF;
 IF NOT work_record_access('techprojects.spaces',(p_data->>'spaceId')::uuid,'view') THEN RAISE EXCEPTION 'Espaço indisponível.' USING ERRCODE='42501';END IF;
 IF p_data->>'folderId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_folders WHERE id=(p_data->>'folderId')::uuid AND workspace_id=w AND space_id=(p_data->>'spaceId')::uuid AND work_record_access('techprojects.folders',id,'view')) THEN RAISE EXCEPTION 'Pasta indisponível.' USING ERRCODE='42501';END IF;
 IF p_data->>'projectId' IS NOT NULL AND NOT work_record_access('techprojects.projects',(p_data->>'projectId')::uuid,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF;
 IF p_template IS NOT NULL THEN
 PERFORM work_area_authorize('techprojects.list_templates','view',p_template);
 SELECT * INTO t FROM project_list_templates WHERE id=p_template AND workspace_id=w;
 statuses:=t.statuses;fields:=t.custom_fields;
 ELSE
 statuses:='[{"name":"A fazer","color":"#64748b","category":"todo","is_default":true},{"name":"Em execução","color":"#0ea5e9","category":"doing"},{"name":"Em revisão","color":"#f59e0b","category":"doing"},{"name":"Concluída","color":"#10b981","category":"done"}]'::jsonb;fields:='[]';
 END IF;
 IF jsonb_array_length(statuses)>100 OR jsonb_array_length(fields)>100 THEN RAISE EXCEPTION 'Modelo excede o limite de configuração.';END IF;
 INSERT INTO project_lists(workspace_id,space_id,folder_id,project_id,name,color,icon,created_by)
 VALUES(w,(p_data->>'spaceId')::uuid,(p_data->>'folderId')::uuid,(p_data->>'projectId')::uuid,p_data->>'name',p_data->>'color',p_data->>'icon',u) RETURNING * INTO l;
 FOR s IN SELECT value FROM jsonb_array_elements(statuses) LOOP
 INSERT INTO project_task_statuses(workspace_id,list_id,name,color,category,sort_order,is_default) VALUES(w,l.id,s->>'name',s->>'color',coalesce(s->>'category','todo'),coalesce((s->>'sort_order')::int,position),coalesce((s->>'is_default')::boolean,false));position:=position+1;END LOOP;position:=0;
 FOR f IN SELECT value FROM jsonb_array_elements(fields) LOOP
 INSERT INTO project_list_custom_fields(workspace_id,list_id,key,label,type,options,sort_order) VALUES(w,l.id,f->>'key',f->>'label',f->>'type',f->'options',coalesce((f->>'sort_order')::int,position));position:=position+1;END LOOP;
 RETURN to_jsonb(l);
END $$;
REVOKE ALL ON FUNCTION public.project_list_create_checked(jsonb,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.project_list_create_checked(jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_esign_manage(p_action text,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;u uuid:=auth.uid();d esign_documents;s esign_signers;x jsonb;parent uuid;k text;BEGIN
 IF p_action NOT IN('create','update','send','cancel','delete','add_signer','remove_signer','share') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 IF octet_length(p_data::text)>600000 THEN RAISE EXCEPTION 'Conteúdo excede o limite.';END IF;
 IF p_action='create' THEN
 w:=work_area_authorize('techcontracts.esign','create');
 IF NOT work_context_access(work_access_context(),w,'techcontracts.esign','create',ARRAY[u]) THEN RAISE EXCEPTION 'Criação não autorizada.' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_data->>'title','')))=0 OR length(p_data->>'title')>255 OR length(coalesce(p_data->>'body',''))>50000 OR jsonb_typeof(p_data->'signers')<>'array' OR jsonb_array_length(p_data->'signers') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Documento ou signatários inválidos.';END IF;
 -- Optional commercial links must be visible through the caller's CRM scope.
 FOREACH k IN ARRAY ARRAY['dealId','contactId'] LOOP
 parent:=(p_data->>k)::uuid;IF parent IS NULL THEN CONTINUE;END IF;
 IF NOT work_commercial_reference_allowed(CASE k WHEN 'dealId' THEN 'deals' ELSE 'contacts' END,parent) THEN RAISE EXCEPTION 'Vínculo comercial indisponível.' USING ERRCODE='42501';END IF;END LOOP;
 INSERT INTO esign_documents(workspace_id,owner_id,title,description,body,ordered,deal_id,contact_id,expires_at)
 VALUES(w,u,p_data->>'title',p_data->>'description',coalesce(p_data->>'body',''),coalesce((p_data->>'ordered')::boolean,false),(p_data->>'dealId')::uuid,(p_data->>'contactId')::uuid,(p_data->>'expiresAt')::timestamptz) RETURNING * INTO d;
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'signers') LOOP
 IF length(trim(coalesce(x->>'name','')))=0 OR length(coalesce(x->>'email',''))=0 OR coalesce((x->>'sign_order')::int,1)<1 THEN RAISE EXCEPTION 'Signatário inválido.';END IF;
 INSERT INTO esign_signers(workspace_id,document_id,owner_id,name,email,sign_order) VALUES(w,d.id,u,x->>'name',x->>'email',coalesce((x->>'sign_order')::int,1));END LOOP;
 ELSE
 IF p_action='remove_signer' THEN SELECT document_id INTO parent FROM esign_signers WHERE id=p_id;ELSE parent:=p_id;END IF;
 w:=work_area_authorize('techcontracts.esign',CASE WHEN p_action IN('add_signer','remove_signer') THEN 'manage' ELSE p_action END,parent);
 SELECT * INTO d FROM esign_documents WHERE id=parent AND workspace_id=w FOR UPDATE;
 IF d.id IS NULL OR EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=d.id) THEN RAISE EXCEPTION 'Use o fluxo específico da proposta de contratação.' USING ERRCODE='42501';END IF;
 IF p_action='share' THEN
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'public_token',public_token)) FROM esign_signers WHERE document_id=d.id AND workspace_id=w),'[]');
 END IF;
 IF p_action IN('update','add_signer','remove_signer','delete') AND d.status<>'draft' THEN RAISE EXCEPTION 'Documento enviado não permite alterar conteúdo, signatários ou excluir.' USING ERRCODE='23514';END IF;
 IF p_action='update' THEN
 FOR k IN SELECT jsonb_object_keys(p_data) LOOP IF k NOT IN('title','description','body','ordered','expires_at') THEN RAISE EXCEPTION 'Campo protegido.' USING ERRCODE='42501';END IF;END LOOP;
 IF length(coalesce(p_data->>'body',d.body))>50000 OR length(trim(coalesce(p_data->>'title',d.title)))=0 THEN RAISE EXCEPTION 'Conteúdo inválido.';END IF;
 UPDATE esign_documents SET title=coalesce(p_data->>'title',title),description=CASE WHEN p_data?'description' THEN p_data->>'description' ELSE description END,body=coalesce(p_data->>'body',body),ordered=coalesce((p_data->>'ordered')::boolean,ordered),expires_at=CASE WHEN p_data?'expires_at' THEN (p_data->>'expires_at')::timestamptz ELSE expires_at END WHERE id=d.id;
 ELSIF p_action='send' THEN
 IF d.status<>'draft' OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) OR NOT EXISTS(SELECT 1 FROM esign_signers WHERE document_id=d.id AND workspace_id=w) THEN RAISE EXCEPTION 'Documento indisponível para envio.' USING ERRCODE='23514';END IF;
 UPDATE esign_documents SET status='sent',sent_at=now(),content_hash=encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),sealed_at=now() WHERE id=d.id;
 ELSIF p_action='cancel' THEN
 IF d.status NOT IN('draft','sent','partially_signed') THEN RAISE EXCEPTION 'Documento finalizado não pode ser cancelado.' USING ERRCODE='23514';END IF;
 UPDATE esign_documents SET status='canceled',completed_at=now() WHERE id=d.id;
 ELSIF p_action='delete' THEN DELETE FROM esign_documents WHERE id=d.id;RETURN jsonb_build_object('ok',true);
 ELSIF p_action='add_signer' THEN
 IF (SELECT count(*) FROM esign_signers WHERE document_id=d.id)>=20 OR length(trim(coalesce(p_data->>'name','')))=0 OR length(coalesce(p_data->>'email',''))=0 OR coalesce((p_data->>'sign_order')::int,1)<1 THEN RAISE EXCEPTION 'Signatário inválido.';END IF;
 INSERT INTO esign_signers(workspace_id,document_id,owner_id,name,email,sign_order) VALUES(w,d.id,u,p_data->>'name',p_data->>'email',coalesce((p_data->>'sign_order')::int,1));
 ELSIF p_action='remove_signer' THEN DELETE FROM esign_signers WHERE id=p_id AND document_id=d.id;
 END IF;
 END IF;
 INSERT INTO esign_audit(workspace_id,document_id,owner_id,event,metadata) VALUES(w,d.id,u,p_action,jsonb_build_object('actor_id',u));
 IF p_action='create' THEN RETURN to_jsonb(d);END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_manage(text,uuid,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_esign_manage(text,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_commercial_reference_allowed(t text,i uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();j jsonb;r text;s uuid;BEGIN
 IF t NOT IN('deals','contacts') THEN RETURN false;END IF;
 IF t='deals' THEN RETURN work_deal_context_access(c,i,'view');END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=$1',t) INTO j USING i;
 IF j IS NULL OR j->>'workspace_id' IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 s:=coalesce((j->>'assigned_to')::uuid,(j->>'owner_id')::uuid);r:='techsales.'||t||'.view.';
 RETURN coalesce(c->'keys'?(r||'workspace') OR (c->'keys'?(r||'own') AND c->>'actor'=s::text) OR (c->'keys'?(r||'team') AND c->'team'?s::text),false);
END $$;
REVOKE ALL ON FUNCTION public.work_commercial_reference_allowed(text,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_commercial_reference_allowed(text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_esign_public(p_token text,p_action text,p_name text DEFAULT NULL,p_signature text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL,p_ua text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s esign_signers;d esign_documents;can_sign boolean;others jsonb;BEGIN
 IF p_action NOT IN('view','sign','decline') OR length(p_token) NOT BETWEEN 10 AND 100 THEN RAISE EXCEPTION 'Link inválido.';END IF;
 SELECT * INTO s FROM esign_signers WHERE public_token=p_token;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Link inválido.';END IF;
 SELECT * INTO d FROM esign_documents WHERE id=s.document_id AND workspace_id=s.workspace_id FOR UPDATE;
 SELECT * INTO s FROM esign_signers WHERE id=s.id FOR UPDATE;
 IF d.id IS NULL OR EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=d.id) THEN RAISE EXCEPTION 'Use o fluxo específico de contratação.';END IF;
 IF d.status IN('draft','canceled') OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) THEN RAISE EXCEPTION 'Link inválido ou expirado.' USING ERRCODE='23514';END IF;
 can_sign:=d.status IN('sent','partially_signed') AND s.status IN('pending','viewed') AND (NOT d.ordered OR NOT EXISTS(SELECT 1 FROM esign_signers WHERE document_id=d.id AND sign_order<s.sign_order AND status<>'signed'));
 IF p_action<>'view' AND NOT can_sign THEN RAISE EXCEPTION 'Assinatura indisponível.' USING ERRCODE='23514';END IF;
 IF p_action='sign' AND (length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 255 OR length(coalesce(p_signature,''))>500000) THEN RAISE EXCEPTION 'Assinatura inválida.';END IF;
 IF p_action='decline' AND length(coalesce(p_reason,''))>1000 THEN RAISE EXCEPTION 'Motivo excede o limite.';END IF;
 IF d.content_hash IS NULL AND d.status IN('sent','partially_signed') THEN
 UPDATE esign_documents SET content_hash=encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),sealed_at=now() WHERE id=d.id;
 INSERT INTO esign_audit(workspace_id,document_id,owner_id,event,metadata) VALUES(d.workspace_id,d.id,d.owner_id,'legacy_snapshot',jsonb_build_object('captured_at',now(),'historical_seal',false));
 END IF;
 IF p_action='sign' THEN UPDATE esign_signers SET status='signed',signed_name=p_name,signature_data=p_signature,signed_at=now(),ip_address=p_ip,user_agent=p_ua WHERE id=s.id;
 ELSIF p_action='decline' THEN UPDATE esign_signers SET status='declined',decline_reason=p_reason,declined_at=now(),ip_address=p_ip,user_agent=p_ua WHERE id=s.id;
 ELSIF s.viewed_at IS NULL THEN UPDATE esign_signers SET viewed_at=now(),status=CASE WHEN status='pending' THEN 'viewed'::esign_signer_status ELSE status END WHERE id=s.id;
 END IF;
 IF p_action<>'view' OR s.viewed_at IS NULL THEN INSERT INTO esign_audit(workspace_id,document_id,signer_id,owner_id,event,ip_address,user_agent) VALUES(d.workspace_id,d.id,s.id,s.owner_id,p_action,p_ip,p_ua);END IF;
 IF p_action<>'view' THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'sign_order',sign_order,'status',status,'signed_at',signed_at) ORDER BY sign_order) INTO others FROM esign_signers WHERE document_id=d.id;
 RETURN jsonb_build_object('doc',jsonb_build_object('id',d.id,'title',d.title,'description',d.description,'body',d.body,'status',d.status,'ordered',d.ordered,'expires_at',d.expires_at),'signer',jsonb_build_object('id',s.id,'name',s.name,'email',s.email,'status',s.status,'signed_name',s.signed_name,'signed_at',s.signed_at,'decline_reason',s.decline_reason),'signers',coalesce(others,'[]'),'canSign',can_sign);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.contract_esign_attachment(p_action text,p_document uuid DEFAULT NULL,p_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d esign_documents;w uuid;parent uuid:=p_document;BEGIN
 IF p_action NOT IN('add','remove') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 IF p_action='remove' THEN SELECT document_id INTO parent FROM esign_attachments WHERE id=p_id;END IF;
 w:=work_area_authorize('techcontracts.esign','manage',parent);
 SELECT * INTO d FROM esign_documents WHERE id=parent AND workspace_id=w FOR UPDATE;
 IF d.id IS NULL OR d.status<>'draft' OR EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=d.id) THEN RAISE EXCEPTION 'Anexos só podem ser alterados no rascunho.' USING ERRCODE='42501';END IF;
 IF p_action='add' THEN
 IF length(trim(coalesce(p_data->>'fileName','')))=0 OR length(p_data->>'fileName')>255 OR coalesce(p_data->>'fileUrl','') !~ '^https?://' OR length(p_data->>'fileUrl')>2000 OR coalesce((p_data->>'sizeBytes')::bigint,0)<0 OR (SELECT count(*) FROM esign_attachments WHERE document_id=d.id)>=10 OR (SELECT coalesce(sum(size_bytes),0) FROM esign_attachments WHERE document_id=d.id)+coalesce((p_data->>'sizeBytes')::bigint,0)>26214400 THEN RAISE EXCEPTION 'Anexo inválido ou limite excedido.';END IF;
 INSERT INTO esign_attachments(workspace_id,document_id,owner_id,file_name,file_url,mime_type,size_bytes,sha256) VALUES(w,d.id,auth.uid(),p_data->>'fileName',p_data->>'fileUrl',p_data->>'mimeType',(p_data->>'sizeBytes')::int,p_data->>'sha256');
 ELSE DELETE FROM esign_attachments WHERE id=p_id AND document_id=d.id;END IF;
 INSERT INTO esign_audit(workspace_id,document_id,owner_id,event) VALUES(w,d.id,auth.uid(),'attachment_'||p_action);
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_attachment(text,uuid,uuid,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_esign_attachment(text,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.proposal_publish_with_esign(p_id uuid,p_hash text,p_sent_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE p proposals;affected bigint;BEGIN
 SELECT * INTO p FROM proposals WHERE id=p_id FOR UPDATE;
 IF p.id IS NULL OR p.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR is_read_only_view() THEN RAISE EXCEPTION 'Proposta indisponível.' USING ERRCODE='42501';END IF;
 IF p.esign_document_id IS NOT NULL THEN PERFORM contract_esign_manage('send',p.esign_document_id,'{}');END IF;
 UPDATE proposals SET status='sent',sent_at=p_sent_at,locked=true WHERE id=p.id;GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Envio da proposta não autorizado.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('ok',true,'contentHash',p_hash);
END $$;
REVOKE ALL ON FUNCTION public.proposal_publish_with_esign(uuid,text,timestamptz) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.proposal_publish_with_esign(uuid,text,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_area_capabilities(r text,ids uuid[])
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,can_delete boolean,can_assign boolean,can_send boolean,can_cancel boolean,can_share boolean,can_manage boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();i uuid;BEGIN
 IF cardinality(ids)>500 OR NOT EXISTS(SELECT 1 FROM work_resource_catalog WHERE resource=r) THEN RAISE EXCEPTION 'Recurso ou quantidade inválida.';END IF;
 FOR i IN SELECT DISTINCT unnest(ids) LOOP
 IF NOT work_record_context_access(c,r,i,'view') THEN CONTINUE;END IF;
 id:=i;can_view:=true;
 can_update:=work_record_context_access(c,r,i,'update');can_delete:=work_record_context_access(c,r,i,'delete');
 can_assign:=can_update AND work_record_context_access(c,r,i,'assign');
 can_send:=work_record_context_access(c,r,i,'send');can_cancel:=work_record_context_access(c,r,i,'cancel');can_share:=work_record_context_access(c,r,i,'share');can_manage:=work_record_context_access(c,r,i,'manage');
 RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.work_area_capabilities(text,uuid[]) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_area_capabilities(text,uuid[]) TO authenticated;
-- Service-role entry point: delegated work is checked against its SOURCE tenant,
-- never the delegate's currently selected browser workspace.
CREATE OR REPLACE FUNCTION public.work_delegated_authorize(p_ws uuid,p_actor uuid,p_kind text,p_record uuid,p_copy boolean DEFAULT false,p_template uuid DEFAULT NULL,p_status text DEFAULT 'draft')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;k jsonb;t jsonb;j jsonb;s uuid;r text;requirements text[];x text;ok boolean;BEGIN
 IF p_ws IS NULL OR p_actor IS NULL OR NOT is_workspace_member(p_ws,p_actor) THEN RETURN false;END IF;
 SELECT coalesce(jsonb_object_agg(key,true),'{}') INTO k FROM user_effective_permissions(p_actor,p_ws)key;
 SELECT coalesce(jsonb_object_agg(b.user_id::text,true),'{}') INTO t FROM user_group_members a JOIN user_group_members b ON b.group_id=a.group_id JOIN user_groups g ON g.id=a.group_id WHERE a.user_id=p_actor AND g.workspace_id=p_ws;
 c:=jsonb_build_object('workspace',p_ws,'actor',p_actor,'keys',k,'team',t,'read_only',false);
 IF p_kind IN('contract_from_deal','contract_from_person') THEN
 IF p_kind='contract_from_deal' THEN
 SELECT to_jsonb(d) INTO j FROM deals d WHERE id=p_record AND workspace_id=p_ws;
 IF j IS NULL OR NOT work_deal_context_access(c,p_record,'view') THEN RETURN false;END IF;
 ELSE
 IF NOT work_person_context_access(c,p_record) THEN RETURN false;END IF;
 END IF;
 requirements:=ARRAY['techcontracts.contracts.view','techcontracts.contracts.create'];
 IF p_copy THEN requirements:=requirements||ARRAY['techservice.services.view','techservice.services.create'];END IF;
 IF p_template IS NOT NULL AND NOT work_record_context_access(c,'techcontracts.contract_templates',p_template,'view') THEN RETURN false;END IF;
 IF p_status<>'draft' THEN requirements:=requirements||ARRAY['techcontracts.contract_transition.manage'];IF p_status='active' THEN requirements:=requirements||ARRAY['techcontracts.contract_activation.manage'];END IF;IF p_status NOT IN('in_negotiation','active','renewing','ended','terminated') THEN RETURN false;END IF;END IF;
 ELSIF p_kind='person_contracts' THEN
 RETURN work_person_context_access(c,p_record) AND NOT EXISTS(SELECT 1 FROM contracts d WHERE d.workspace_id=p_ws AND d.metadata->>'person_id'=p_record::text AND NOT work_record_context_access(c,'techcontracts.contracts',d.id,'view'));
 ELSIF p_kind='service_billing' THEN
 SELECT to_jsonb(d) INTO j FROM services d WHERE id=p_record AND workspace_id=p_ws;
 IF j IS NULL OR NOT work_record_context_access(c,'techservice.services',p_record,'view') THEN RETURN false;END IF;
 requirements:=ARRAY['techservice.billing.manage','techfinance.entries.view','techfinance.entries.create'];
 ELSE RETURN false;END IF;
 FOREACH x IN ARRAY requirements LOOP
 -- Created records belong to the explicit delegating actor. A team key alone
 -- never authorizes an unrelated creator or a different source tenant.
 ok:=k?(x||'.workspace') OR k?(x||'.own') OR (k?(x||'.team') AND t?p_actor::text);
 IF NOT coalesce(ok,false) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.work_delegated_authorize(uuid,uuid,text,uuid,boolean,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_delegated_authorize(uuid,uuid,text,uuid,boolean,uuid,text) TO service_role;
INSERT INTO permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('techservice.billing.manage.workspace','techservice','billing','manage','workspace','Executar cobrança dos serviços',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.contract_create_batch(p_contract jsonb,p_services jsonb DEFAULT '[]',p_skip_existing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE j jsonb:=p_contract;x jsonb;cols text;vals text;cid uuid;existing record;created record;n int:=0;desired text:=coalesce(j->>'status','draft');proof jsonb;actor uuid;source_id uuid;BEGIN
 IF jsonb_typeof(j)<>'object' OR jsonb_typeof(p_services)<>'array' OR octet_length(j::text)>500000 OR jsonb_array_length(p_services)>500 THEN RAISE EXCEPTION 'Contrato inválido.';END IF;
 IF auth.uid() IS NOT NULL THEN
 IF j?'__delegation' THEN RAISE EXCEPTION 'Prova reservada ao servidor.' USING ERRCODE='42501';END IF;
 PERFORM work_area_authorize('techcontracts.contracts','create');
 IF j->>'owner_id' IS DISTINCT FROM auth.uid()::text OR j->>'workspace_id' IS DISTINCT FROM work_access_context()->>'workspace' THEN RAISE EXCEPTION 'Origem inválida.' USING ERRCODE='42501';END IF;
 ELSIF coalesce(auth.role(),'')='service_role' THEN
 proof:=j->'__delegation';actor:=(j->>'owner_id')::uuid;source_id:=(proof->>'record')::uuid;
 IF proof IS NULL OR proof->>'kind' NOT IN('contract_from_deal','contract_from_person') OR source_id IS NULL OR NOT work_delegated_authorize((j->>'workspace_id')::uuid,actor,proof->>'kind',source_id,jsonb_array_length(p_services)>0,(proof->>'template')::uuid,desired) THEN RAISE EXCEPTION 'Criação delegada não autorizada.' USING ERRCODE='42501';END IF;
 IF (proof->>'kind'='contract_from_deal' AND j->>'deal_id' IS DISTINCT FROM source_id::text) OR (proof->>'kind'='contract_from_person' AND j->'metadata'->>'person_id' IS DISTINCT FROM source_id::text) THEN RAISE EXCEPTION 'Fonte da delegação divergente.' USING ERRCODE='42501';END IF;
 j:=j-'__delegation';
 ELSE RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';
 END IF;
 IF p_skip_existing AND (j->>'deal_id' IS NOT NULL OR j->'metadata'->>'person_id' IS NOT NULL) THEN
 PERFORM pg_advisory_xact_lock(hashtext('contract_create:'||(j->>'workspace_id')||':'||coalesce(j->>'deal_id',j->'metadata'->>'person_id')||':'||(j->>'document_kind')));
 SELECT id,number,title INTO existing FROM contracts WHERE workspace_id=(j->>'workspace_id')::uuid AND ((j->>'deal_id' IS NOT NULL AND deal_id=(j->>'deal_id')::uuid) OR (j->>'deal_id' IS NULL AND metadata->>'person_id'=j->'metadata'->>'person_id' AND role::text=j->>'role' AND status NOT IN('ended','terminated'))) AND document_kind=j->>'document_kind' ORDER BY created_at LIMIT 1;
 IF existing.id IS NOT NULL THEN IF actor IS NOT NULL AND NOT work_record_context_access(work_subject_context((j->>'workspace_id')::uuid,actor),'techcontracts.contracts',existing.id,'view') THEN RAISE EXCEPTION 'Contrato existente indisponível.' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('contract',jsonb_build_object('id',existing.id,'number',existing.number,'title',existing.title),'servicesCreated',0,'skipped',true);END IF;
 END IF;
 IF auth.uid() IS NOT NULL THEN j:=j||jsonb_build_object('status','draft');END IF;
 IF j?'id' OR j?'created_at' OR j?'updated_at' THEN RAISE EXCEPTION 'Identidade protegida.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(j)k WHERE NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='contracts'::regclass AND attnum>0 AND NOT attisdropped AND attname=k)) THEN RAISE EXCEPTION 'Campo inválido.';END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),',') INTO cols,vals FROM jsonb_object_keys(j)k;
 EXECUTE format('INSERT INTO contracts(%s) SELECT %s FROM jsonb_populate_record(NULL::contracts,$1)p RETURNING id,number,title,workspace_id,owner_id',cols,vals) INTO created USING j;cid:=created.id;
 FOR x IN SELECT value FROM jsonb_array_elements(p_services) LOOP
 x:=x||jsonb_build_object('contract_id',cid,'workspace_id',created.workspace_id,'owner_id',created.owner_id);
 IF x?'id' OR x?'created_at' OR x?'updated_at' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x)k WHERE NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='services'::regclass AND attnum>0 AND NOT attisdropped AND attname=k)) THEN RAISE EXCEPTION 'Campo protegido ou inválido no serviço.';END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),',') INTO cols,vals FROM jsonb_object_keys(x)k;
 EXECUTE format('INSERT INTO services(%s) SELECT %s FROM jsonb_populate_record(NULL::services,$1)p',cols,vals) USING x;n:=n+1;
 END LOOP;
 IF auth.uid() IS NOT NULL AND desired<>'draft' THEN PERFORM contract_transition(cid,desired);END IF;
 RETURN jsonb_build_object('contract',jsonb_build_object('id',cid,'number',created.number,'title',created.title),'servicesCreated',n);
END $$;
REVOKE ALL ON FUNCTION public.contract_create_batch(jsonb,jsonb,boolean) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_create_batch(jsonb,jsonb,boolean) TO authenticated,service_role;
ALTER TABLE public.contract_events ADD COLUMN source_txid bigint;
ALTER TABLE public.contract_events ALTER COLUMN source_txid SET DEFAULT txid_current();
CREATE OR REPLACE FUNCTION public.contract_audit_annotate(p_contract uuid,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT work_record_access('techcontracts.contracts',p_contract,'update') OR jsonb_typeof(p_evidence)<>'object' OR octet_length(p_evidence::text)>32000 THEN RAISE EXCEPTION 'Anotação não autorizada.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM contract_events WHERE contract_id=p_contract AND actor_id=auth.uid() AND source_txid=txid_current() AND created_at=transaction_timestamp()) THEN RAISE EXCEPTION 'Anotação exige alteração real nesta transação.' USING ERRCODE='42501';END IF;
 UPDATE contract_events SET payload=payload||jsonb_build_object('operator_evidence',p_evidence) WHERE contract_id=p_contract AND actor_id=auth.uid() AND source_txid=txid_current() AND created_at=transaction_timestamp();
END $$;
REVOKE ALL ON FUNCTION public.contract_audit_annotate(uuid,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_audit_annotate(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_change_checked(p_contract uuid,p_patch jsonb,p_evidence jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;BEGIN
 result:=contract_mutate(p_contract,p_patch);
 IF p_evidence<>'{}'::jsonb AND EXISTS(SELECT 1 FROM contract_events WHERE contract_id=p_contract AND actor_id=auth.uid() AND source_txid=txid_current() AND created_at=transaction_timestamp()) THEN PERFORM contract_audit_annotate(p_contract,p_evidence);END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.contract_change_checked(uuid,jsonb,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_change_checked(uuid,jsonb,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.project_milestone_complete_checked(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE m project_milestones;p record;entry_id uuid;BEGIN
 PERFORM work_area_authorize('techprojects.milestones','update',p_id);
 SELECT * INTO m FROM project_milestones WHERE id=p_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Marco indisponível.' USING ERRCODE='42501';END IF;
 SELECT id,name,role,contract_id,service_id,workspace_id INTO p FROM projects WHERE id=m.project_id;
 IF p.id IS NULL OR p.workspace_id<>m.workspace_id THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF;
 entry_id:=m.financial_entry_id;
 IF m.billable AND entry_id IS NULL AND coalesce(m.bill_amount,0)>0 THEN
 PERFORM work_area_authorize('techprojects.milestone_billing','create');
 IF NOT (user_has_permission(auth.uid(),m.workspace_id,'techfinance.entries.create.own') OR user_has_permission(auth.uid(),m.workspace_id,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para criar lançamento financeiro.' USING ERRCODE='42501';END IF;
 IF p.service_id IS NOT NULL AND project_billing_service_owned(p.service_id,current_date) THEN RAISE EXCEPTION 'A cobrança deste serviço pertence às medições.' USING ERRCODE='23514';END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,service_id,description,amount,currency,competence_date,due_date,status)
 VALUES(m.workspace_id,auth.uid(),CASE WHEN p.role='client' THEN 'payable'::financial_direction ELSE 'receivable'::financial_direction END,'project_milestone',m.id,p.contract_id,p.service_id,p.name||' — '||m.name,m.bill_amount,'BRL',current_date,current_date,'open') RETURNING id INTO entry_id;
 END IF;
 UPDATE project_milestones SET status='done',completed_at=coalesce(completed_at,now()),financial_entry_id=entry_id WHERE id=m.id RETURNING * INTO m;
 RETURN to_jsonb(m);
END $$;
REVOKE ALL ON FUNCTION public.project_milestone_complete_checked(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.project_milestone_complete_checked(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_cost_projection(r text,ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();i uuid;outrows jsonb:='[]';j jsonb;allow_cost boolean;BEGIN
 IF r NOT IN('techprojects.projects','techprojects.members','techcontracts.contracts') OR cardinality(ids)>1000 THEN RAISE EXCEPTION 'Projeção inválida.';END IF;
 allow_cost:=coalesce(c->'keys'?'techprojects.profitability.view.workspace' OR c->'keys'?'techprojects.rates.view.workspace',false);
 FOR i IN SELECT DISTINCT unnest(ids) LOOP
 IF NOT work_record_context_access(c,r,i,'view') THEN CONTINUE;END IF;
 IF r='techcontracts.contracts' THEN j:=jsonb_build_object('id',i,'public_token',null,'financials_visible',true);
 ELSIF r='techprojects.projects' THEN SELECT jsonb_build_object('id',id,'planned_cost',CASE WHEN allow_cost THEN planned_cost END,'financials_visible',allow_cost) INTO j FROM projects WHERE id=i;
 ELSE SELECT jsonb_build_object('id',id,'cost_rate_hour',CASE WHEN allow_cost THEN cost_rate_hour END,'bill_rate_hour',CASE WHEN allow_cost THEN bill_rate_hour END,'financials_visible',allow_cost) INTO j FROM project_members WHERE id=i;END IF;
 outrows:=outrows||jsonb_build_array(j);
 END LOOP;
 RETURN outrows;
END $$;
REVOKE ALL ON FUNCTION public.work_cost_projection(text,uuid[]) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_cost_projection(text,uuid[]) TO authenticated;
INSERT INTO permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('techprojects.costs.manage.workspace','techprojects','costs','manage','workspace','Alterar orçamento de custo e tarifas do projeto',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.work_cost_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE j jsonb:=to_jsonb(NEW);prev jsonb:='{}';col text;changed boolean:=false;BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN prev:=to_jsonb(OLD);END IF;
 FOREACH col IN ARRAY CASE WHEN TG_TABLE_NAME='projects' THEN ARRAY['planned_cost'] ELSE ARRAY['cost_rate_hour','bill_rate_hour'] END LOOP
 IF (TG_OP='INSERT' AND j->>col IS NOT NULL) OR (TG_OP='UPDATE' AND j->col IS DISTINCT FROM prev->col) THEN changed:=true;END IF;
 END LOOP;
 IF changed AND NOT(user_has_permission(auth.uid(),NEW.workspace_id,'techprojects.costs.manage.workspace') OR user_has_permission(auth.uid(),NEW.workspace_id,'techprojects.rates.manage.workspace')) THEN RAISE EXCEPTION 'Sem permissão para alterar custos e tarifas.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_cost_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_import_delegate_allowed(p_ws uuid,p_actor uuid,p_provider text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r text;BEGIN
 IF p_provider NOT IN('clockify','jibble') OR NOT is_active_workspace_admin(p_ws,p_actor) THEN RETURN false;END IF;
 r:='techprojects.'||p_provider||'_import';
 RETURN user_has_permission(p_actor,p_ws,r||'.view.workspace') AND user_has_permission(p_actor,p_ws,r||'.manage.workspace');
END $$;
REVOKE ALL ON FUNCTION public.work_import_delegate_allowed(uuid,uuid,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.work_import_delegate_allowed(uuid,uuid,text) TO service_role;

-- Preserve original requester when a different authorized admin resumes a run.
ALTER TABLE clockify_import_runs ADD COLUMN delegation_authorized_by uuid,ADD COLUMN delegation_authorized_at timestamptz;
ALTER TABLE time_import_runs ADD COLUMN delegation_authorized_by uuid,ADD COLUMN delegation_authorized_at timestamptz;
CREATE OR REPLACE FUNCTION public.contract_defaults_resolve(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF auth.uid() IS NOT NULL THEN
 IF p_ws IS DISTINCT FROM (c->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM user_effective_permissions(auth.uid(),p_ws)k WHERE k IN('techcontracts.defaults.view.workspace','techcontracts.contracts.create.own','techcontracts.contracts.create.team','techcontracts.contracts.create.workspace')) THEN RAISE EXCEPTION 'Padrões indisponíveis.' USING ERRCODE='42501';END IF;
 ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('document_kind',document_kind,'defaults',defaults)) FROM contract_defaults WHERE workspace_id=p_ws),'[]');
END $$;
REVOKE ALL ON FUNCTION public.contract_defaults_resolve(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_defaults_resolve(uuid) TO authenticated,service_role;

-- Reassignment is independent from generic record editing.
INSERT INTO permissions(key,module,resource,action,scope,label_pt,is_system) VALUES
('techservice.services.assign.workspace','techservice','services','assign','workspace','Reatribuir responsável',true),
('techcontracts.contract_templates.assign.workspace','techcontracts','contract_templates','assign','workspace','Reatribuir responsável',true),
('techprojects.lists.assign.workspace','techprojects','lists','assign','workspace','Reatribuir responsável',true),
('techprojects.milestones.assign.workspace','techprojects','milestones','assign','workspace','Reatribuir responsável',true),
('techprojects.project_updates.assign.workspace','techprojects','project_updates','assign','workspace','Reatribuir responsável',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.work_milestone_billing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE e record;BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.financial_entry_id IS NOT NULL AND (NEW.financial_entry_id,NEW.bill_amount,NEW.billable) IS DISTINCT FROM (OLD.financial_entry_id,OLD.bill_amount,OLD.billable) THEN RAISE EXCEPTION 'Marco faturado: trate o lançamento pelo Financeiro antes de alterar a cobrança.' USING ERRCODE='23514';END IF;
 IF NEW.financial_entry_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.financial_entry_id IS DISTINCT FROM OLD.financial_entry_id) THEN
 PERFORM work_area_authorize('techprojects.milestone_billing','create');
 SELECT id,workspace_id,origin_type,origin_id,amount INTO e FROM financial_entries WHERE id=NEW.financial_entry_id;
 IF e.id IS NULL OR e.workspace_id<>NEW.workspace_id OR e.origin_type::text<>'project_milestone' OR e.origin_id<>NEW.id OR e.amount IS DISTINCT FROM NEW.bill_amount THEN RAISE EXCEPTION 'Lançamento incompatível com o marco.' USING ERRCODE='42501';END IF;
 END IF;
 IF NEW.status::text='done' AND NEW.billable AND coalesce(NEW.bill_amount,0)>0 AND NEW.financial_entry_id IS NULL THEN RAISE EXCEPTION 'Use Concluir marco para gerar a cobrança de forma atômica.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_milestone_billing_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.service_bill_checked(p_service uuid,p_mode text,p_starts date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s services;actor uuid:=auth.uid();w uuid;billing_date date;upcoming date;next_status service_status;inserted uuid;generated boolean:=false;BEGIN
 IF p_mode NOT IN('activate','tick') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 SELECT * INTO s FROM services WHERE id=p_service FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 IF actor IS NOT NULL THEN
 w:=work_area_authorize('techservice.services','update',s.id);PERFORM work_area_authorize('techservice.billing','manage');
 IF NOT finance_scope_access(w,'entries','view',actor) THEN RAISE EXCEPTION 'Sem acesso aos lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF NOT(user_has_permission(actor,w,'techfinance.entries.create.own') OR user_has_permission(actor,w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 ELSIF coalesce(auth.role(),'')='service_role' THEN
 actor:=s.owner_id;w:=s.workspace_id;
 IF NOT work_delegated_authorize(w,actor,'service_billing',s.id) THEN RETURN jsonb_build_object('authorized',false,'generated',false,'skippedOwned',false,'duplicate',false);END IF;
 ELSE RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 IF p_mode='activate' THEN
 IF s.status IN('active','completed') THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',true,'skippedOwned',false,'service',to_jsonb(s));END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'Serviço indisponível para ativação.' USING ERRCODE='23514';END IF;
 billing_date:=coalesce(p_starts,s.starts_at,current_date);
 ELSE
 IF s.status<>'active' OR s.type<>'recurring' OR s.next_billing_at IS NULL OR s.next_billing_at>current_date THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',false,'skippedOwned',false,'service',to_jsonb(s));END IF;
 billing_date:=s.next_billing_at;
 END IF;
 IF s.type='one_time' OR p_mode='tick' THEN
 IF project_billing_service_owned(s.id,billing_date) THEN
 IF p_mode='activate' THEN RAISE EXCEPTION 'Cobrança deste serviço pertence às medições.' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('authorized',true,'generated',false,'skippedOwned',true,'duplicate',false);
 END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,service_id,contract_id,description,amount,currency,competence_date,due_date,status)
 VALUES(w,actor,CASE WHEN s.role='provider' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'service',s.id,s.id,s.contract_id,s.name,s.quantity*s.unit_price,s.currency,billing_date,billing_date,'open')
 ON CONFLICT(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL DO NOTHING RETURNING id INTO inserted;
 generated:=inserted IS NOT NULL;
 END IF;
 IF p_mode='activate' THEN
 next_status:=CASE WHEN s.type='one_time' THEN 'completed'::service_status ELSE 'active'::service_status END;
 upcoming:=CASE WHEN s.type='recurring' THEN billing_date END;
 ELSE
 upcoming:=services_next_billing(billing_date,s.cadence);
 next_status:=CASE WHEN s.ends_at IS NOT NULL AND upcoming>s.ends_at THEN 'completed'::service_status ELSE 'active'::service_status END;
 IF next_status='completed' THEN upcoming:=NULL;END IF;
 END IF;
 UPDATE services SET status=next_status,starts_at=CASE WHEN p_mode='activate' THEN billing_date ELSE starts_at END,next_billing_at=upcoming WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('authorized',true,'generated',generated,'skippedOwned',false,'duplicate',NOT generated AND (p_mode='tick' OR s.type='one_time'),'service',to_jsonb(s));
END $$;
REVOKE ALL ON FUNCTION public.service_bill_checked(uuid,text,date) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.service_bill_checked(uuid,text,date) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.work_service_billing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF NEW.type='one_time' AND NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status<>'completed') THEN RAISE EXCEPTION 'Use Ativar serviço para concluir e faturar de forma atômica.' USING ERRCODE='42501';END IF;
 IF (TG_OP='INSERT' AND (NEW.status='active' OR NEW.next_billing_at IS NOT NULL)) OR (TG_OP='UPDATE' AND ((NEW.status='active' AND OLD.status<>'active') OR NEW.next_billing_at IS DISTINCT FROM OLD.next_billing_at OR (OLD.status='active' AND (NEW.unit_price,NEW.quantity,NEW.cadence,NEW.starts_at,NEW.ends_at) IS DISTINCT FROM (OLD.unit_price,OLD.quantity,OLD.cadence,OLD.starts_at,OLD.ends_at)))) THEN PERFORM work_area_authorize('techservice.billing','manage');END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_service_billing_guard() FROM PUBLIC,anon,authenticated;
-- Operational labels/schema needed to use an authorized task/list are not a
-- grant to manage status or custom-field configuration.
CREATE OR REPLACE FUNCTION public.project_list_runtime_references(p_list uuid DEFAULT NULL,p_task uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l uuid:=p_list;w uuid:=(work_access_context()->>'workspace')::uuid;s jsonb;f jsonb;BEGIN
 IF p_task IS NOT NULL THEN
 IF NOT work_record_access('techprojects.tasks',p_task,'view') THEN RAISE EXCEPTION 'Tarefa indisponível.' USING ERRCODE='42501';END IF;
 SELECT list_id INTO l FROM project_tasks WHERE id=p_task AND workspace_id=w;
 ELSE IF NOT work_record_access('techprojects.lists',l,'view') THEN RAISE EXCEPTION 'Lista indisponível.' USING ERRCODE='42501';END IF;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'list_id',list_id,'name',name,'color',color,'category',category,'sort_order',sort_order,'is_default',is_default) ORDER BY sort_order),'[]') INTO s FROM project_task_statuses WHERE list_id=l AND workspace_id=w;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'key',key,'label',label,'type',type,'options',options,'sort_order',sort_order) ORDER BY sort_order),'[]') INTO f FROM project_list_custom_fields WHERE list_id=l AND workspace_id=w;
 RETURN jsonb_build_object('statuses',s,'fields',f);
END $$;
REVOKE ALL ON FUNCTION public.project_list_runtime_references(uuid,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.project_list_runtime_references(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_task_relations_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role()='service_role' OR (auth.uid() IS NULL AND session_user IN('postgres','supabase_admin')) THEN RETURN NEW;END IF;
 IF NEW.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF;
 IF NEW.custom_status_id IS NOT NULL AND (TG_OP='INSERT' OR (NEW.custom_status_id,NEW.list_id) IS DISTINCT FROM (OLD.custom_status_id,OLD.list_id)) AND NOT EXISTS(SELECT 1 FROM project_task_statuses WHERE id=NEW.custom_status_id AND workspace_id=NEW.workspace_id AND list_id=NEW.list_id) THEN RAISE EXCEPTION 'Status não pertence à lista da tarefa.' USING ERRCODE='23514';END IF;
 IF NEW.list_id IS NOT NULL AND (TG_OP='INSERT' OR (NEW.list_id,NEW.project_id) IS DISTINCT FROM (OLD.list_id,OLD.project_id)) AND NOT EXISTS(SELECT 1 FROM project_lists WHERE id=NEW.list_id AND workspace_id=NEW.workspace_id AND (project_id IS NULL OR project_id=NEW.project_id)) THEN RAISE EXCEPTION 'Lista não pertence ao projeto.' USING ERRCODE='23514';END IF;
 IF NEW.milestone_id IS NOT NULL AND (TG_OP='INSERT' OR (NEW.milestone_id,NEW.project_id) IS DISTINCT FROM (OLD.milestone_id,OLD.project_id)) AND NOT EXISTS(SELECT 1 FROM project_milestones WHERE id=NEW.milestone_id AND workspace_id=NEW.workspace_id AND project_id=NEW.project_id) THEN RAISE EXCEPTION 'Marco não pertence ao projeto.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_task_relations_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_contract_source_owned(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (work_access_context()->>'workspace') IS NOT NULL AND length(p_path)<=2000 AND p_path !~ '(^|/)\.\.(/|$)' AND EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='contract-imports' AND name=p_path AND (owner=auth.uid() OR owner_id=auth.uid()::text))
$$;
REVOKE ALL ON FUNCTION public.work_contract_source_owned(text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_contract_source_owned(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_contract_source_in_use(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT work_contract_source_owned(p_path) AND (EXISTS(SELECT 1 FROM contracts WHERE source_file_path=p_path) OR EXISTS(SELECT 1 FROM contract_templates WHERE source_file_path=p_path))
$$;
REVOKE ALL ON FUNCTION public.work_contract_source_in_use(text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_contract_source_in_use(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_contract_storage_allowed(p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF c->>'actor' IS NULL OR (p_write AND (c->>'read_only')::boolean) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE
 (NOT p_write AND k ~ '^(techcontracts\.(contracts|contract_templates)\.view\.(own|team|workspace)|techcontracts\.imports\.(view|manage)\.workspace)$') OR
 (p_write AND k ~ '^(techcontracts\.imports\.manage\.workspace|techcontracts\.contract_templates\.(create|update)\.(own|team|workspace))$'));
END $$;
REVOKE ALL ON FUNCTION public.work_contract_storage_allowed(boolean) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_contract_storage_allowed(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_contract_file_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF NEW.source_file_path IS NOT NULL AND (TG_OP='INSERT' OR NEW.source_file_path IS DISTINCT FROM OLD.source_file_path) AND NOT work_contract_source_owned(NEW.source_file_path) THEN RAISE EXCEPTION 'Arquivo de origem indisponível: envie um arquivo da sua área privada.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_contract_file_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_catalog_service_access(p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();j jsonb;s uuid;r text:='techsales.catalog.services.view.';BEGIN
 SELECT to_jsonb(x) INTO j FROM service_catalog x WHERE id=p_id AND workspace_id=(c->>'workspace')::uuid;
 IF j IS NULL THEN RETURN false;END IF;s:=coalesce((j->>'assigned_to')::uuid,(j->>'owner_id')::uuid);
 RETURN coalesce(c->'keys'?(r||'workspace') OR (c->'keys'?(r||'own') AND c->>'actor'=s::text) OR (c->'keys'?(r||'team') AND c->'team'?s::text),false);
END $$;
REVOKE ALL ON FUNCTION public.work_catalog_service_access(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_catalog_service_access(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.contract_template_save_checked(p_id uuid DEFAULT NULL,p_patch jsonb DEFAULT '{}',p_services uuid[] DEFAULT NULL,p_copy uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid;u uuid:=auth.uid();r contract_templates;j jsonb:=p_patch;patch_key text;cols text;vals text;target_id uuid:=p_id;services uuid[]:=p_services;sid uuid;BEGIN
 IF p_id IS NULL THEN
 w:=work_area_authorize('techcontracts.contract_templates','create');
 IF NOT work_context_access(c,w,'techcontracts.contract_templates','create',ARRAY[u]) OR NOT work_context_access(c,w,'techcontracts.contract_templates','view',ARRAY[u]) THEN RAISE EXCEPTION 'Criação não autorizada.' USING ERRCODE='42501';END IF;
 IF p_copy IS NOT NULL THEN
 PERFORM work_area_authorize('techcontracts.contract_templates','view',p_copy);
 SELECT * INTO r FROM contract_templates WHERE contract_templates.id=p_copy FOR SHARE;
 j:=jsonb_build_object('name',left(r.name,192)||' (cópia)','description',r.description,'role',r.role,'service_type',r.service_type,'body_html',r.body_html,'variables',r.variables,'defaults',r.defaults,'status','draft','is_default',false);
 SELECT coalesce(array_agg(service_catalog_id),'{}') INTO services FROM contract_template_services WHERE template_id=p_copy AND workspace_id=w;
 END IF;
 ELSE w:=work_area_authorize('techcontracts.contract_templates','update',p_id);SELECT * INTO r FROM contract_templates WHERE contract_templates.id=p_id FOR UPDATE;END IF;
 IF jsonb_typeof(j)<>'object' OR octet_length(j::text)>500000 OR (j?'name' AND length(trim(coalesce(j->>'name','')))=0) OR length(coalesce(j->>'body_html',''))>400000 THEN RAISE EXCEPTION 'Modelo inválido.';END IF;
 FOR patch_key IN SELECT jsonb_object_keys(j) LOOP IF patch_key NOT IN('name','description','role','service_type','body_html','variables','defaults','status','is_default','source_file_path','imported_from') THEN RAISE EXCEPTION 'Campo protegido.' USING ERRCODE='42501';END IF;END LOOP;
 IF j->>'source_file_path' IS NOT NULL AND j->>'source_file_path' IS DISTINCT FROM r.source_file_path AND NOT work_contract_source_owned(j->>'source_file_path') THEN RAISE EXCEPTION 'Arquivo indisponível.' USING ERRCODE='42501';END IF;
 IF services IS NOT NULL THEN
 IF cardinality(services)>500 THEN RAISE EXCEPTION 'Limite de serviços excedido.';END IF;
 FOREACH sid IN ARRAY services LOOP IF NOT work_catalog_service_access(sid) THEN RAISE EXCEPTION 'Serviço do catálogo indisponível.' USING ERRCODE='42501';END IF;END LOOP;
 END IF;
 IF p_id IS NULL THEN
 j:=j||jsonb_build_object('workspace_id',w,'owner_id',u,'assigned_to',u);
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),',') INTO cols,vals FROM jsonb_object_keys(j)k;
 EXECUTE format('INSERT INTO contract_templates(%s) SELECT %s FROM jsonb_populate_record(NULL::contract_templates,$1)p RETURNING *',cols,vals) INTO r USING j;target_id:=r.id;
 ELSIF j<>'{}'::jsonb THEN
 SELECT string_agg(format('%I=p.%I',k,k),',') INTO cols FROM jsonb_object_keys(j)k;
 EXECUTE format('UPDATE contract_templates t SET %s FROM jsonb_populate_record(NULL::contract_templates,$1)p WHERE t.id=$2 RETURNING t.*',cols) INTO r USING j,target_id;
 END IF;
 IF services IS NOT NULL THEN
 DELETE FROM contract_template_services WHERE template_id=target_id AND workspace_id=w;
 INSERT INTO contract_template_services(workspace_id,template_id,service_catalog_id) SELECT w,target_id,unnest FROM (SELECT DISTINCT unnest(services))s;
 END IF;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.contract_template_save_checked(uuid,jsonb,uuid[],uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.contract_template_save_checked(uuid,jsonb,uuid[],uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.work_subject_context(p_ws uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k jsonb;t jsonb;BEGIN
 IF NOT is_workspace_member(p_ws,p_actor) THEN RETURN '{}';END IF;
 SELECT coalesce(jsonb_object_agg(key,true),'{}') INTO k FROM user_effective_permissions(p_actor,p_ws)key;
 SELECT coalesce(jsonb_object_agg(b.user_id::text,true),'{}') INTO t FROM user_group_members a JOIN user_group_members b ON b.group_id=a.group_id JOIN user_groups g ON g.id=a.group_id WHERE a.user_id=p_actor AND g.workspace_id=p_ws;
 RETURN jsonb_build_object('workspace',p_ws,'actor',p_actor,'keys',k,'team',t,'read_only',false);
END $$;
REVOKE ALL ON FUNCTION public.work_subject_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_deal_context_access(c jsonb,p_id uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d deals;u uuid:=(c->>'actor')::uuid;r text;allowed boolean;BEGIN
 IF u IS NULL OR p_action NOT IN('view','update') THEN RETURN false;END IF;
 SELECT * INTO d FROM deals WHERE id=p_id AND workspace_id=(c->>'workspace')::uuid AND deleted_at IS NULL;
 IF d.id IS NULL THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id WHERE uj.user_id=u AND jr.restricted_visibility AND coalesce(uj.workspace_id,jr.workspace_id)=d.workspace_id) AND NOT is_workspace_admin_of(d.workspace_id,u) AND u IS DISTINCT FROM d.owner_id AND u IS DISTINCT FROM d.assigned_to THEN RETURN false;END IF;
 r:='techsales.deals.view.';
 allowed:=coalesce(c->'keys'?(r||'workspace') OR(c->'keys'?(r||'own') AND u IN(d.owner_id,d.assigned_to)) OR(c->'keys'?(r||'team') AND (u IN(d.owner_id,d.assigned_to) OR c->'team'?d.assigned_to::text)),false);
 IF NOT allowed OR p_action='view' THEN RETURN allowed;END IF;
 IF (c->>'read_only')::boolean THEN RETURN false;END IF;
 r:='techsales.deals.update.';
 RETURN coalesce(c->'keys'?(r||'workspace') OR(c->'keys'?(r||'own') AND u IN(d.owner_id,d.assigned_to)) OR(c->'keys'?(r||'team') AND (u IN(d.owner_id,d.assigned_to) OR c->'team'?d.assigned_to::text)),false);
END $$;
REVOKE ALL ON FUNCTION public.work_deal_context_access(jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_project_delivery_delegate(p_ws uuid,p_creator uuid,p_owner uuid,p_deal uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_subject_context(p_ws,p_creator);s uuid:=coalesce(p_owner,p_creator);BEGIN
 IF NOT work_deal_context_access(c,p_deal,'view') OR NOT work_context_access(c,p_ws,'techprojects.projects','create',ARRAY[s]) OR NOT work_context_access(c,p_ws,'techprojects.projects','view',ARRAY[s]) THEN RETURN false;END IF;
 IF s<>p_creator AND NOT c->'keys'?'techprojects.projects.assign.workspace' THEN RETURN false;END IF;
 RETURN is_workspace_member(p_ws,s);
END $$;
REVOKE ALL ON FUNCTION public.work_project_delivery_delegate(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Canonical hours permissions retain the two existing aliases without allowing
-- a legacy admin/manager rule or another alias to bypass an explicit denial.
INSERT INTO permissions(key,module,resource,action,scope,label_pt,is_system)
SELECT 'techprojects.time_entries.'||a||'.'||s,'techprojects','time_entries',a::perm_action,s::perm_scope,CASE a WHEN 'view' THEN 'Visualizar' WHEN 'create' THEN 'Criar' WHEN 'update' THEN 'Editar' WHEN 'delete' THEN 'Excluir' ELSE 'Exportar' END||' apontamentos — '||CASE s WHEN 'own' THEN 'próprios' WHEN 'team' THEN 'equipe' ELSE 'workspace' END,true FROM unnest(ARRAY['view','create','update','delete','export'])a CROSS JOIN unnest(ARRAY['own','team','workspace'])s ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.work_time_context_from(c jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=(c->>'actor')::uuid;w uuid:=(c->>'workspace')::uuid;denies jsonb;grants jsonb;led jsonb;pattern text:='^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.(view|create|update|delete|approve|export)\.(own|team|workspace)$';BEGIN
 IF u IS NULL OR w IS NULL THEN RETURN '{}';END IF;
 SELECT coalesce(jsonb_object_agg(split_part(o.permission_key,'.',3)||'.'||split_part(o.permission_key,'.',4),true),'{}') INTO denies FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id JOIN job_role_permission_overrides o ON o.role_id=uj.role_id AND o.workspace_id=w AND o.effect='deny' WHERE uj.user_id=u AND (uj.workspace_id=w OR uj.owner_id=w) AND (jr.workspace_id IS NULL OR jr.workspace_id=w) AND o.permission_key~pattern;
 SELECT coalesce(jsonb_object_agg(split_part(k,'.',3)||'.'||split_part(k,'.',4),true),'{}') INTO grants FROM jsonb_object_keys(c->'keys')k WHERE k~pattern AND NOT denies?(split_part(k,'.',3)||'.'||split_part(k,'.',4));
 SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO led FROM(
 SELECT a.project_id,a.subject_user_id FROM project_time_approvers a JOIN projects p ON p.id=a.project_id WHERE a.user_id=u AND p.workspace_id=w AND project_time_approver_row_active(a,current_date)
 UNION SELECT m.project_id,NULL::uuid FROM project_members m WHERE m.user_id=u AND m.workspace_id=w AND m.role_in_project='manager')q;
 RETURN c||jsonb_build_object('time_grants',grants,'time_led',led);
END $$;
REVOKE ALL ON FUNCTION public.work_time_context_from(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.work_time_context()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT work_time_context_from(work_access_context())$$;
REVOKE ALL ON FUNCTION public.work_time_context() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_time_context() TO authenticated;
CREATE OR REPLACE FUNCTION public.work_time_context_access(c jsonb,w uuid,p uuid,u uuid,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor' IS NOT NULL AND (a='view' OR NOT(c->>'read_only')::boolean) AND
 (c->'time_grants'?(a||'.workspace') OR (c->'time_grants'?(a||'.own') AND c->>'actor'=u::text) OR (c->'time_grants'?(a||'.team') AND (c->>'actor'=u::text OR c->'team'?u::text OR EXISTS(SELECT 1 FROM jsonb_to_recordset(c->'time_led')l(project_id uuid,subject_user_id uuid) WHERE l.project_id=p AND (l.subject_user_id IS NULL OR l.subject_user_id=u))))),false)
$$;
REVOKE ALL ON FUNCTION public.work_time_context_access(jsonb,uuid,uuid,uuid,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.work_time_context_access(jsonb,uuid,uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.project_timer_authorize_continue(p_session uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_time_context();s project_timer_sessions;pol jsonb;BEGIN
 IF NOT coalesce(c->'time_grants' ?| ARRAY['create.own','create.team','create.workspace'],false) OR (c->>'read_only')::boolean THEN RAISE EXCEPTION 'Sem permissão para registrar novas horas.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM project_timer_sessions WHERE id=p_session AND user_id=auth.uid() AND workspace_id=(c->>'workspace')::uuid;
 IF s.id IS NULL OR NOT EXISTS(SELECT 1 FROM projects WHERE id=s.project_id AND workspace_id=s.workspace_id AND status IN('planning','active')) THEN RAISE EXCEPTION 'Cronômetro ou projeto indisponível.' USING ERRCODE='42501';END IF;
 pol:=project_time_policy_resolve(s.workspace_id);
 IF coalesce((pol->>'track_requires_link')::boolean,true) AND NOT project_time_can_track(auth.uid(),s.project_id,(now() AT TIME ZONE s.timezone)::date) THEN RAISE EXCEPTION 'Vínculo de apontamento revogado ou fora da vigência.' USING ERRCODE='42501';END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_timer_authorize_continue(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.work_contract_suggestion_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
 IF NEW.created_by IS DISTINCT FROM auth.uid() OR NEW.status<>'proposed' OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL THEN RAISE EXCEPTION 'Origem da sugestão inválida.' USING ERRCODE='42501';END IF;
 ELSE
 IF (to_jsonb(NEW)-ARRAY['status','decided_by','decided_at','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_by','decided_at','updated_at']) OR OLD.status<>'proposed' OR NEW.status NOT IN('applied','dismissed','superseded') THEN RAISE EXCEPTION 'Sugestão ou decisão imutável.' USING ERRCODE='42501';END IF;
 NEW.decided_by:=auth.uid();NEW.decided_at:=now();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_contract_suggestion_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.project_time_capabilities(p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_time_context();rows jsonb;can_create boolean;BEGIN
 IF cardinality(p_ids)>500 THEN RAISE EXCEPTION 'Lote excede 500 apontamentos.';END IF;
 can_create:=NOT coalesce((c->>'read_only')::boolean,true) AND coalesce(c->'time_grants' ?| ARRAY['create.own','create.team','create.workspace'],false);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'can_delete',work_time_context_access(c,e.workspace_id,e.project_id,e.user_id,'delete') AND e.status='draft' AND e.period_closing_id IS NULL)),'[]') INTO rows FROM project_time_entries e WHERE e.id=ANY(p_ids) AND work_time_context_access(c,e.workspace_id,e.project_id,e.user_id,'view');
 RETURN jsonb_build_object('can_create',can_create,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.project_time_capabilities(uuid[]) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.project_time_capabilities(uuid[]) TO authenticated;

-- HR source scope for delegated contract lifecycle. Does not expose person data.
CREATE OR REPLACE FUNCTION public.work_person_context_access(c jsonb,p_person uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p people;u uuid:=(c->>'actor')::uuid;responsible uuid;r text:='techpeople.people.view.';BEGIN
 IF u IS NULL THEN RETURN false;END IF;
 SELECT * INTO p FROM people WHERE id=p_person AND workspace_id=(c->>'workspace')::uuid;
 IF p.id IS NULL THEN RETURN false;END IF;responsible:=coalesce(p.assigned_to,p.created_by,p.owner_id);
 RETURN coalesce(c->'keys'?(r||'workspace') OR (c->'keys'?(r||'own') AND u IN(p.profile_id,responsible)) OR(c->'keys'?(r||'team') AND (u IN(p.profile_id,responsible,p.manager_id) OR c->'team'?responsible::text OR c->'team'?p.profile_id::text OR EXISTS(SELECT 1 FROM people m WHERE m.id=p.manager_id AND m.workspace_id=p.workspace_id AND m.profile_id=u))),false);
END $$;
REVOKE ALL ON FUNCTION public.work_person_context_access(jsonb,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.contract_workflow_terminate(p_person uuid,p_actor uuid,p_date date,p_workflow uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p people;c jsonb;row contracts;n int:=0;ids uuid[]:='{}';BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Execução reservada ao workflow.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM people WHERE id=p_person;
 c:=work_subject_context(p.workspace_id,p_actor);
 IF NOT work_person_context_access(c,p_person) OR NOT coalesce(c->'keys'?'techcontracts.contract_transition.manage.workspace',false) OR p_date IS NULL THEN RAISE EXCEPTION 'Responsável sem permissão atual para encerrar contratos.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('contract_workflow_terminate:'||p.workspace_id||':'||p_person));
 FOR row IN SELECT * FROM contracts WHERE workspace_id=p.workspace_id AND metadata->>'person_id'=p_person::text AND status IN('draft','in_review','in_negotiation','awaiting_signature','active','renewing') ORDER BY id FOR UPDATE LOOP
 IF NOT work_record_context_access(c,'techcontracts.contracts',row.id,'update') OR EXISTS(SELECT 1 FROM contract_approvals a WHERE a.contract_id=row.id AND a.superseded_at IS NULL AND a.status='pending') THEN RAISE EXCEPTION 'Contrato sem permissão de edição ou aprovação pendente.' USING ERRCODE='42501';END IF;
 ids:=array_append(ids,row.id);
 END LOOP;
 FOR row IN SELECT * FROM contracts WHERE id=ANY(ids) ORDER BY id LOOP
 UPDATE contracts SET status='terminated',ends_at=p_date,metadata=coalesce(metadata,'{}')||jsonb_build_object('termination',jsonb_build_object('date',p_date,'origin','workflow_offboarding','workflow_id',p_workflow,'distrato_document','pendente')) WHERE id=row.id;
 UPDATE contract_events SET actor_id=p_actor,payload=payload||jsonb_build_object('origin','workflow_offboarding','workflow_id',p_workflow) WHERE contract_id=row.id AND source_txid=txid_current() AND actor_id IS NULL AND event_type='status_changed';
 n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('contracts',n);
END $$;
REVOKE ALL ON FUNCTION public.contract_workflow_terminate(uuid,uuid,date,uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.contract_workflow_terminate(uuid,uuid,date,uuid) TO service_role;

INSERT INTO permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('techprojects.profitability.export.workspace','techprojects','profitability','export','workspace','Exportar relatório de rentabilidade',true) ON CONFLICT(key) DO NOTHING;
