-- Novas permissões granulares para itens de menu antes restritos ao papel "manager".
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description) VALUES
  ('techsales.marketing.landing_pages.view.workspace','techsales','marketing.landing_pages','view','workspace','Ver landing pages','Acessar a lista de landing pages do workspace'),
  ('techsales.marketing.landing_pages.manage.workspace','techsales','marketing.landing_pages','manage','workspace','Gerenciar landing pages','Criar, editar e publicar landing pages'),
  ('techsales.marketing.forms.view.workspace','techsales','marketing.forms','view','workspace','Ver formulários','Acessar formulários de captação'),
  ('techsales.marketing.forms.manage.workspace','techsales','marketing.forms','manage','workspace','Gerenciar formulários','Criar, editar e publicar formulários'),
  ('techsales.marketing.campaigns.view.workspace','techsales','marketing.campaigns','view','workspace','Ver campanhas','Acessar campanhas de email e WhatsApp'),
  ('techsales.marketing.campaigns.manage.workspace','techsales','marketing.campaigns','manage','workspace','Gerenciar campanhas','Criar, editar e disparar campanhas'),
  ('techsales.marketing.sdr_agent.view.workspace','techsales','marketing.sdr_agent','view','workspace','Ver agente SDR','Acessar o agente SDR'),
  ('techsales.marketing.sdr_agent.manage.workspace','techsales','marketing.sdr_agent','manage','workspace','Gerenciar agente SDR','Configurar o agente SDR'),
  ('techsales.catalog.products.view.workspace','techsales','catalog.products','view','workspace','Ver catálogo de produtos','Acessar produtos e serviços do catálogo'),
  ('techsales.catalog.products.manage.workspace','techsales','catalog.products','manage','workspace','Gerenciar catálogo de produtos','Criar, editar e excluir produtos do catálogo'),
  ('system.analytics.dashboards.view.workspace','system','analytics.dashboards','view','workspace','Ver dashboards','Acessar dashboards personalizados'),
  ('system.analytics.dashboards.manage.workspace','system','analytics.dashboards','manage','workspace','Gerenciar dashboards','Criar e editar dashboards e widgets'),
  ('system.analytics.reports.view.workspace','system','analytics.reports','view','workspace','Ver relatórios','Acessar relatórios do workspace'),
  ('system.analytics.reports.manage.workspace','system','analytics.reports','manage','workspace','Gerenciar relatórios','Criar e editar relatórios personalizados'),
  ('system.analytics.insights.view.workspace','system','analytics.insights','view','workspace','Ver analytics','Acessar a área de analytics'),
  ('system.automation.sequences.view.workspace','system','automation.sequences','view','workspace','Ver sequências','Acessar sequências de engajamento'),
  ('system.automation.sequences.manage.workspace','system','automation.sequences','manage','workspace','Gerenciar sequências','Criar, editar e ativar sequências'),
  ('system.automation.rotation.view.workspace','system','automation.rotation','view','workspace','Ver distribuição','Acessar regras de distribuição de registros'),
  ('system.automation.rotation.manage.workspace','system','automation.rotation','manage','workspace','Gerenciar distribuição','Configurar regras de distribuição de registros'),
  ('system.automation.sla.view.workspace','system','automation.sla','view','workspace','Ver SLA por etapa','Acessar políticas de SLA'),
  ('system.automation.sla.manage.workspace','system','automation.sla','manage','workspace','Gerenciar SLA por etapa','Configurar políticas de SLA'),
  ('system.automation.macros.view.workspace','system','automation.macros','view','workspace','Ver macros','Acessar macros de atendimento'),
  ('system.automation.macros.manage.workspace','system','automation.macros','manage','workspace','Gerenciar macros','Criar e editar macros'),
  ('system.automation.email_templates.view.workspace','system','automation.email_templates','view','workspace','Ver templates de email','Acessar templates de email'),
  ('system.automation.email_templates.manage.workspace','system','automation.email_templates','manage','workspace','Gerenciar templates de email','Criar e editar templates de email'),
  ('system.kb.articles.view.workspace','system','kb.articles','view','workspace','Ver base de conhecimento','Acessar artigos da base de conhecimento'),
  ('system.kb.articles.manage.workspace','system','kb.articles','manage','workspace','Gerenciar base de conhecimento','Criar, editar e publicar artigos'),
  ('system.calendars.view.workspace','system','calendars','view','workspace','Ver calendários','Acessar calendários conectados do workspace'),
  ('system.calendars.manage.workspace','system','calendars','manage','workspace','Gerenciar calendários','Conectar e configurar calendários'),
  ('system.booking.view.workspace','system','booking','view','workspace','Ver agendamentos','Acessar páginas de agendamento'),
  ('system.booking.manage.workspace','system','booking','manage','workspace','Gerenciar agendamentos','Criar e configurar páginas de agendamento'),
  ('system.onboarding_templates.view.workspace','system','onboarding_templates','view','workspace','Ver modelos de onboarding','Acessar modelos de onboarding'),
  ('system.onboarding_templates.manage.workspace','system','onboarding_templates','manage','workspace','Gerenciar modelos de onboarding','Criar e editar modelos de onboarding'),
  ('system.user_groups.view.workspace','system','user_groups','view','workspace','Ver times','Acessar times do workspace'),
  ('system.user_groups.manage.workspace','system','user_groups','manage','workspace','Gerenciar times','Criar e editar times do workspace')
ON CONFLICT (key) DO NOTHING;

-- Conjuntos administrativos recebem todas as novas chaves.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT s.id, p.key
FROM public.permission_sets s
CROSS JOIN public.permissions p
WHERE s.id IN (
  '00000000-0000-0000-0000-0000000000a1', -- Super Admin
  '00000000-0000-0000-0000-0000000000a2', -- Admin
  '33333333-0000-4000-8000-000000000001', -- Workspace Admin
  '33333333-0000-4000-8000-000000000002', -- Workspace Owner
  '11111111-0000-4000-8000-000000000004', -- TechSales Admin
  '11111111-0000-4000-8000-000000000003'  -- TechSales Manager
)
AND p.key IN (
  'techsales.marketing.landing_pages.view.workspace','techsales.marketing.landing_pages.manage.workspace',
  'techsales.marketing.forms.view.workspace','techsales.marketing.forms.manage.workspace',
  'techsales.marketing.campaigns.view.workspace','techsales.marketing.campaigns.manage.workspace',
  'techsales.marketing.sdr_agent.view.workspace','techsales.marketing.sdr_agent.manage.workspace',
  'techsales.catalog.products.view.workspace','techsales.catalog.products.manage.workspace',
  'system.analytics.dashboards.view.workspace','system.analytics.dashboards.manage.workspace',
  'system.analytics.reports.view.workspace','system.analytics.reports.manage.workspace',
  'system.analytics.insights.view.workspace',
  'system.automation.sequences.view.workspace','system.automation.sequences.manage.workspace',
  'system.automation.rotation.view.workspace','system.automation.rotation.manage.workspace',
  'system.automation.sla.view.workspace','system.automation.sla.manage.workspace',
  'system.automation.macros.view.workspace','system.automation.macros.manage.workspace',
  'system.automation.email_templates.view.workspace','system.automation.email_templates.manage.workspace',
  'system.kb.articles.view.workspace','system.kb.articles.manage.workspace',
  'system.calendars.view.workspace','system.calendars.manage.workspace',
  'system.booking.view.workspace','system.booking.manage.workspace',
  'system.onboarding_templates.view.workspace','system.onboarding_templates.manage.workspace',
  'system.user_groups.view.workspace','system.user_groups.manage.workspace'
)
ON CONFLICT DO NOTHING;

-- Conjunto Marketing: marketing completo + leitura de análises/automação.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '00000000-0000-0000-0000-0000000000a5'::uuid, p.key
FROM public.permissions p
WHERE p.key IN (
  'techsales.marketing.landing_pages.view.workspace','techsales.marketing.landing_pages.manage.workspace',
  'techsales.marketing.forms.view.workspace','techsales.marketing.forms.manage.workspace',
  'techsales.marketing.campaigns.view.workspace','techsales.marketing.campaigns.manage.workspace',
  'techsales.marketing.sdr_agent.view.workspace','techsales.marketing.sdr_agent.manage.workspace',
  'techsales.catalog.products.view.workspace',
  'system.analytics.dashboards.view.workspace','system.analytics.reports.view.workspace','system.analytics.insights.view.workspace',
  'system.automation.sequences.view.workspace','system.automation.email_templates.view.workspace',
  'system.kb.articles.view.workspace'
)
ON CONFLICT DO NOTHING;

-- Conjuntos de leitura: apenas as chaves de visualização.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT s.id, p.key
FROM public.permission_sets s
CROSS JOIN public.permissions p
WHERE s.id IN (
  '00000000-0000-0000-0000-0000000000a9', -- Read-Only
  '33333333-0000-4000-8000-000000000003', -- Auditor
  '11111111-0000-4000-8000-000000000001'  -- TechSales Viewer
)
AND p.key IN (
  'techsales.marketing.landing_pages.view.workspace','techsales.marketing.forms.view.workspace',
  'techsales.marketing.campaigns.view.workspace','techsales.catalog.products.view.workspace',
  'system.analytics.dashboards.view.workspace','system.analytics.reports.view.workspace',
  'system.analytics.insights.view.workspace','system.kb.articles.view.workspace'
)
ON CONFLICT DO NOTHING;