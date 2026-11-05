# Inventário da Área de Ajuda e Treinamento — Fase 0

> Gerado por varredura do código em 05/11/2026 (rascunho "Central de Ajuda e Treinamento"). Somente leitura: nenhum código, banco ou permissão foi alterado.

## Método e fontes

- **Menus:** `src/lib/menu-config.ts` (`SIDEBAR_GROUPS`, `SIDEBAR_PLATFORM_ITEMS`, `SETTINGS_GROUPS`) e `menu-config-{core,erp,ats,people,contracts,projects,finance}.ts`, avaliados em execução para resolver `need` e `permissionAny`.
- **Módulos:** `VERTICAL_MODULE_LIST` em `src/lib/modules/registry.ts` (crm, ats, people, contracts, projects, finance). `services` é id legado do TechContracts e não aparece.
- **Telas:** todos os arquivos `createFileRoute` em `src/routes` (exceto `api/**`). Tela = rota com conteúdo próprio; redirecionamentos e layouts listados à parte.
- **Funcionalidades:** detecção por padrões no arquivo da rota (botões "Novo/Editar/Excluir/Importar/Exportar", `FilterBar`, `GridBulkBar`, `KanbanBoard`, integrações). É um **ponto de partida**: componentes internos importados pela rota serão abertos um a um na Fase 2, e o que não for confirmado vira [CONFIRMAR].
- **Permissões:** catálogo `public.permissions` (270 recursos, lido do app publicado, somente leitura), chaves citadas em cada rota, `need` do menu, `user_can_act`/`current_user_permissions()` e RLS (doutrina `docs/architecture/security-rbac.md`).
- **Regra de visibilidade do menu:** item aparece se o usuário tem o papel exigido em `need` **ou** qualquer chave de `permissionAny`. Sem `need` nem chaves = todo membro ativo do workspace com o módulo licenciado. Membership inativo remove acesso; `deny` prevalece.

## 1. Módulos reais

| Módulo | Nome interno | Rota base | Quem enxerga | Telas |
|---|---|---|---|---|
| TechSales (crm) | `crm` | `/dashboard` [CONFIRMAR] | Licença do módulo crm + itens por papel/permissão `techsales.*` | 58 |
| TechHire (ats) | `ats` | `/ats/dashboard` [CONFIRMAR] | Licença ats + `techhire.*` (ex.: `system.hiring_access`) | 33 |
| TechPeople (people) | `people` | `/people` [CONFIRMAR] | Licença people + `techpeople.*` (`canSeeHrMenu`) | 15 |
| TechContracts (contracts) | `contracts` | `/contracts` [CONFIRMAR] | Licença contracts + `techcontracts.*` | 11 |
| TechProjects (projects) | `projects` | `/projects` [CONFIRMAR] | Licença projects + `techprojects.*` | 22 |
| TechFinance (finance) | `finance` | `/finance` [CONFIRMAR] | Licença finance + `techfinance.*` | 19 |
| Core ERP / Configurações (compartilhado) | `core` | `/settings` [CONFIRMAR] | Membros ativos; itens de Configurações por `need` admin/gestor ou `system.*` | 84 |
| Administração da plataforma | `platform` | `/admin` [CONFIRMAR] | Somente admin da plataforma (`need: platform`) | 9 |

> Rota base: o módulo ativo vem do host → localStorage → caminho (CLAUDE.md §8); a rota acima é a do item "Visão geral › Dashboard" ou primeira do menu.

## 2. Telas e funcionalidades por módulo

Legenda das colunas: **Menu** = ✔ item próprio, ↳ subtela de um item, — sem item. **Funcionalidades detectadas** = sinais no arquivo da rota (a confirmar na Fase 2). **Chaves** = permissões citadas no arquivo.

### TechSales (crm) — 58 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/agents/prototype` | Modelos de Agentes de IA — TechERP | PrototypeComparison · `agents/prototypes/comparison` | — | [CONFIRMAR] sem item de menu | IA/agente | — |
| `/agents/prototype` | Protótipo — Agentes de IA | Outlet | — | [CONFIRMAR] sem item de menu | IA/agente | — |
| `/agents/prototype/1` | Estúdio de Agentes — TechERP | StudioModel · `agents/prototypes/studio-model` | — | [CONFIRMAR] sem item de menu | IA/agente | — |
| `/agents/prototype/2` | Assistente de criação de Agentes — TechERP | AssistantModel · `agents/prototypes/assistant-model` | — | [CONFIRMAR] sem item de menu | IA/agente | — |
| `/agents/prototype/3` | Central de operação de Agentes — TechERP | OperationModel · `agents/prototypes/operation-model` | — | [CONFIRMAR] sem item de menu | IA/agente | — |
| `/agents/sdr` | Agente SDR / TechERP | SdrAgentPage · `ui/tabs` | ✔ | gestor+ ou `techsales.marketing.sdr_agent.view.workspace`, `techsales.marketing.sdr_agent.manage.workspace` | IA/agente, WhatsApp | — |
| `/analytics` | [CONFIRMAR] Analytics | AnalyticsPage · `date-range-picker` | ✔ | gestor+ ou `system.analytics.insights.view.workspace` | IA/agente, e-mail | — |
| `/campaigns/email` | [CONFIRMAR] Campanhas Email | EmailBroadcastsPage · `grid/grid-list-toolbar` | ✔ | gestor+ ou `techsales.marketing.campaigns.view.workspace`, `techsales.marketing.campaigns.manage.workspace` | criar, excluir/arquivar | — |
| `/campaigns/whatsapp` | [CONFIRMAR] Campanhas WhatsApp | CampaignsPage · `techhire/ui` | ✔ | gestor+ ou `techsales.marketing.campaigns.view.workspace`, `techsales.marketing.campaigns.manage.workspace` | criar, editar, excluir/arquivar, IA/agente, WhatsApp | — |
| `/communications` | [CONFIRMAR] Comunicações | CommunicationsPage · `entity-list` | ✔ | todo membro ativo com o módulo licenciado | HubSpot | — |
| `/companies` | Empresas / TechSales | CompaniesPage · `companies/company-avatar` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar, importar, exportar, ações em massa, HubSpot | `techsales.companies.create.own`, `techsales.companies.create.workspace`, `techsales.companies.delete.own` …+3 |
| `/companies/$id` | Empresa / TechSales | CompanyDetail · `ui/button` | ↳ Empresas | todo membro ativo com o módulo licenciado | excluir/arquivar, HubSpot | `techsales.companies`, `techsales.companies.manage.workspace`, `techsales.companies.update.own` |
| `/contacts` | Contatos / TechSales | ContactsPage · `people/person-avatar` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar, importar, exportar, ações em massa, WhatsApp, e-mail, HubSpot | `techsales.contacts.create.own`, `techsales.contacts.delete.own`, `techsales.contacts.delete.workspace` …+2 |
| `/contacts/$id` | Contato / TechSales | ContactDetail · `people/person-photo-editor` | ↳ Contatos | todo membro ativo com o módulo licenciado | excluir/arquivar, WhatsApp | `techsales.contacts` |
| `/dashboard` | Painel de vendas / TechSales | DashboardPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/dashboards` | [CONFIRMAR] Dashboards | DashboardsPage · `page-header` | ✔ | gestor+ ou `system.analytics.dashboards.view.workspace`, `system.analytics.dashboards.manage.workspace` | criar, editar, excluir/arquivar | — |
| `/deals` | Negócios / TechERP | DealsRoute · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, HubSpot | `techsales.deals.create.own`, `techsales.deals.delete.own`, `techsales.deals.delete.team` …+4 |
| `/deals/$id` | Detalhe do negócio / TechERP | DealDetail · `ui/button` | ↳ Negócios | todo membro ativo com o módulo licenciado | editar, excluir/arquivar | `techsales.deals` |
| `/forms` | [CONFIRMAR] Formulários | FormsPage · `forms/forms-page` | ✔ | gestor+ ou `techsales.marketing.forms.view.workspace`, `techsales.marketing.forms.manage.workspace` | [CONFIRMAR] somente leitura? | — |
| `/inbox` | Inbox unificada — TechERP | UnifiedInboxPage · `ui/input` | ✔ | todo membro ativo com o módulo licenciado | ações em massa, IA/agente, WhatsApp, e-mail | `techsales.inbox.whatsapp.create.own`, `techsales.inbox.whatsapp.create.team`, `techsales.inbox.whatsapp.create.workspace` |
| `/inbox/chat` | Chat ao vivo — Inbox TechERP | LiveChatInbox · `inbox/service-agent-panel` | ✔ | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/inbox/email` | Email — Inbox TechERP | EmailInbox · `inbox/service-agent-panel` | ✔ | todo membro ativo com o módulo licenciado | criar, IA/agente, e-mail | — |
| `/inbox/whatsapp` | WhatsApp — Inbox TechERP | WhatsAppInbox · `inbox/delivery-failure-label` | ✔ | todo membro ativo com o módulo licenciado | criar, WhatsApp | `techsales.inbox.whatsapp.create.own`, `techsales.inbox.whatsapp.create.team`, `techsales.inbox.whatsapp.create.workspace` |
| `/invoices` | [CONFIRMAR] Faturas | — · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, excluir/arquivar, ações em massa, kanban | `techfinance.invoices`, `techfinance.invoices.create.own`, `techfinance.invoices.create.workspace` …+15 |
| `/landing-pages` | Nova landing page | LandingPagesPage · `ui/button` | ✔ | gestor+ ou `techsales.marketing.landing_pages.view.workspace`, `techsales.marketing.landing_pages.manage.workspace` | criar, editar, excluir/arquivar | — |
| `/landing-pages/$id` | [CONFIRMAR] Landing Pages | EditorRoute · `landing-pages/editor` | ↳ Landing Pages | gestor+ ou `techsales.marketing.landing_pages.view.workspace`, `techsales.marketing.landing_pages.manage.workspace` | [CONFIRMAR] somente leitura? | — |
| `/leads` | Leads / TechSales | LeadsPage · `grid/bulk-edit-fields-dialog` | ✔ | todo membro ativo com o módulo licenciado | excluir/arquivar, visões salvas, exportar, ações em massa, HubSpot | `techsales.leads.delete.own`, `techsales.leads.delete.workspace`, `techsales.leads.update.own` …+1 |
| `/leads/$id` | Lead / TechSales | LeadDetail · `people/person-photo-editor` | ↳ Leads | todo membro ativo com o módulo licenciado | criar, excluir/arquivar, automação/workflow, WhatsApp | `techsales.leads` |
| `/meetings` | [CONFIRMAR] Reuniões | MeetingsLibrary · `ui/input` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/notes` | [CONFIRMAR] Notas | NotesPage · `entity-list` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/proposals` | Título | ProposalsPage · `grid/grid-list-shell` | ✔ | todo membro ativo com o módulo licenciado | criar, ações em massa, kanban | — |
| `/proposals/$id` | Proposta — TechSales | ProposalPage · `sales-access` | ↳ Propostas | todo membro ativo com o módulo licenciado | editar | `techsales.proposal_send`, `techsales.proposal_share` |
| `/prospecting` | Prospecção — TechSales / TechERP | ProspectingSuite · `techhire/ui` | ✔ | gestor+ ou `techsales.prospecting_search.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_queue.view.workspace` … | IA/agente, WhatsApp | `techsales.marketing.campaigns.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_cadences.view.workspace` …+8 |
| `/prospecting/campaigns` | [CONFIRMAR] Prospecção | CampaignsListPage · `ui/card` | ↳ Prospecção | gestor+ ou `techsales.prospecting_search.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_queue.view.workspace` … | criar | — |
| `/prospecting/campaigns/$id` | [CONFIRMAR] Prospecção | CampaignDetailPage · `ui/card` | ↳ Prospecção | gestor+ ou `techsales.prospecting_search.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_queue.view.workspace` … | criar, editar, WhatsApp, HubSpot | — |
| `/prospecting/prototype` | Protótipo — Prospecção TechSales | ProspectingPrototype · `prospecting/prototype/prospecting-prototype` | ↳ Prospecção | gestor+ ou `techsales.prospecting_search.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_queue.view.workspace` … | [CONFIRMAR] somente leitura? | — |
| `/prospecting/queues/$queueId/play` | [CONFIRMAR] Prospecção | PlayProspectingQueueGuarded · `ui/button` | ↳ Prospecção | gestor+ ou `techsales.prospecting_search.view.workspace`, `techsales.marketing.sdr_agent.view.workspace`, `techsales.prospecting_queue.view.workspace` … | criar, e-mail | `techsales.prospecting_queue.view.workspace` |
| `/prospecting/sequences` | [CONFIRMAR] Sequências de prospecção | — · `prospecting/sequences/sequences-page` | ✔ | ou `system.automation.sequences.view.own`, `system.automation.sequences.view.team`, `system.automation.sequences.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/reports` | [CONFIRMAR] Relatórios | ReportsPage · `date-range-picker` | ✔ | gestor+ ou `system.analytics.reports.view.workspace`, `system.analytics.reports.manage.workspace` | criar, editar, excluir/arquivar, importar, exportar | — |
| `/settings/booking` | Reunião 30 min | BookingSettings · `ui/button` | ✔ | gestor+ ou `system.booking.view.workspace`, `system.booking.manage.workspace` | criar, editar, excluir/arquivar, ações em massa | — |
| `/settings/calendars` | [CONFIRMAR] Calendários | CalendarsPage · `ui/button` | ✔ | gestor+ ou `system.calendars.view.workspace`, `system.calendars.manage.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/email` | [CONFIRMAR] Conexão de Email | EmailSettings · `service-channels/email-configuration` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/kb` | [CONFIRMAR] Base de conhecimento | KbAdminPage · `page-header` | ✔ | gestor+ ou `system.kb.articles.view.workspace`, `system.kb.articles.manage.workspace` | criar, editar | — |
| `/settings/macros` | [CONFIRMAR] Macros | MacrosPage · `ui/button` | ✔ | gestor+ ou `system.automation.macros.view.workspace`, `system.automation.macros.manage.workspace` | criar, editar, excluir/arquivar, IA/agente | — |
| `/settings/portal` | [CONFIRMAR] Portal do cliente | PortalSettingsPage · `ui/button` | ✔ | admin/dono ou `system.portal.view.workspace`, `system.portal.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/quotes` | [CONFIRMAR] Cotações | QuotesPage · `sales-access` | ✔ | todo membro ativo com o módulo licenciado | excluir/arquivar | `techsales.quote_share` |
| `/settings/rotation` | [CONFIRMAR] Distribuição | RotationPage · `ui/button` | ✔ | gestor+ ou `system.automation.rotation.view.workspace`, `system.automation.rotation.manage.workspace` | criar, editar, excluir/arquivar, automação/workflow | — |
| `/settings/sequences` | [CONFIRMAR] Sequências | SequencesPage · `ui/button` | ✔ | gestor+ ou `system.automation.sequences.view.workspace`, `system.automation.sequences.manage.workspace` | criar, excluir/arquivar | — |
| `/settings/sla` | [CONFIRMAR] SLA por etapa | SlaPage · `ui/button` | ✔ | gestor+ ou `system.automation.sla.view.workspace`, `system.automation.sla.manage.workspace` | editar | — |
| `/settings/workflows` | [CONFIRMAR] Workflows | WorkflowsPage · `ui/dropdown-menu` | ✔ | gestor+ ou `system.workflows.manage.workspace` | criar, excluir/arquivar, automação/workflow | — |
| `/survey-builder/$id` | Construtor de pesquisa — TechERP | BuilderRoute · `surveys/form/form-builder` | — | [CONFIRMAR] sem item de menu | [CONFIRMAR] somente leitura? | — |
| `/surveys` | [CONFIRMAR] Pesquisas | SurveysPage · `surveys/surveys-page` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/tasks` | [CONFIRMAR] Tarefas | TasksPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar, filtros, visões salvas, importar, exportar, ações em massa, HubSpot | `techsales.activities` |
| `/tasks/$id` | [CONFIRMAR] Tarefas | TaskDetail · `ui/button` | ↳ Tarefas | todo membro ativo com o módulo licenciado | excluir/arquivar | `techsales.activities` |
| `/tasks/queues` | [CONFIRMAR] Filas | QueuesPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar | — |
| `/tasks/queues/$queueId/play` | [CONFIRMAR] Filas | PlayQueue · `ui/button` | ↳ Filas | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/tickets` | [CONFIRMAR] Tickets | TicketsPage · `companies/company-avatar` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar, ações em massa, HubSpot | `techsales.tickets.delete.own`, `techsales.tickets.delete.workspace`, `techsales.tickets.manage.workspace` …+1 |
| `/tickets/$id` | [CONFIRMAR] Tickets | TicketDetail · `ui/button` | ↳ Tickets | todo membro ativo com o módulo licenciado | excluir/arquivar, HubSpot | `techsales.tickets` |

**Permissões do catálogo (`techsales.*`, 61 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `activities` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `ai_assist` | manage,view | own,team,workspace |
| `ai_summaries` | create,delete,view | own,team,workspace |
| `campaign_dispatch` | manage,view | own,team,workspace |
| `catalog.products` | create,delete,export,manage,update,view | own,team,workspace |
| `catalog.services` | create,delete,export,update,view | own,team,workspace |
| `communications` | create,delete,export,manage,update,view | own,team,workspace |
| `companies` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `companies_lookup` | view | workspace |
| `contacts` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `conversion` | manage,view | own,team,workspace |
| `dashboard` | create,delete,export,manage,update,view | own,team,workspace |
| `deal_delivery` | view | own,team,workspace |
| `deal_loss_reasons` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `deals` | approve,assign,create,delete,export,manage,update,view | own,team,workspace |
| `email_accounts` | create,delete,export,manage,update,view | own,team,workspace |
| `emails` | create,delete,view | own,workspace |
| `goals` | create,delete,export,manage,update,view | own,team,workspace |
| `inbox` | create,delete,export,update,view | own,team,workspace |
| `inbox.chat` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `inbox.email` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `inbox.whatsapp` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `invoices` | create,delete,export,update,view | own,team,workspace |
| `lead_sources` | create,delete,export,manage,update,view | own,team,workspace |
| `leads` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `marketing.campaigns` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `marketing.forms` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `marketing.landing_pages` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `marketing.sdr_agent` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `meeting_settings` | create,delete,export,manage,update,view | own,team,workspace |
| `meetings` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `notes` | create,delete,export,manage,update,view | own,team,workspace |
| `proposal_clauses` | create,delete,export,manage,update,view | own,team,workspace |
| `proposal_send` | create,delete,export,manage,update,view | own,team,workspace |
| `proposal_share` | manage,view | own,team,workspace |
| `proposal_templates` | create,delete,export,manage,update,view | own,team,workspace |
| `proposals` | approve,assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_cadences` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_enrichment` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_playbooks` | create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_qualifications` | create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_questionnaires` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_queue` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_scoring` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_scripts` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_search` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `prospecting_voice` | create,delete,export,manage,update,view | own,team,workspace |
| `quote_send` | create,delete,export,manage,update,view | own,team,workspace |
| `quote_share` | create,delete,export,manage,update,view | own,team,workspace |
| `quote_templates` | create,delete,export,manage,update,view | own,team,workspace |
| `quotes` | approve,assign,create,delete,export,manage,update,view | own,team,workspace |
| `role_profiles` | approve,create,manage,update,view | workspace |
| `role_profiles_commercial` | view | workspace |
| `role_profiles_early` | approve | workspace |
| `role_profiles_share` | manage | workspace |
| `segments` | create,delete,export,manage,update,view | own,team,workspace |
| `surveys` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `task_queues` | create,delete,export,manage,update,view | own,team,workspace |
| `tasks` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `tickets` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `whatsapp` | create,delete,view | own,workspace |

### TechHire (ats) — 33 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/ats-dashboard` | Dashboard / TechHire | AtsDashboardPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, IA/agente | — |
| `/briefing` | [CONFIRMAR] Briefing diário | BriefingPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/candidates` | [CONFIRMAR] Candidatos | CandidatesPage · `hr-access` | ✔ | ou `techhire.candidates.view.workspace`, `techhire.candidates.view.team`, `techhire.candidates.view.own` | criar, excluir/arquivar, filtros, importar, exportar, ações em massa, IA/agente | `techhire.candidates`, `techhire.candidates.create.own`, `techhire.candidates.create.workspace` …+1 |
| `/candidates/$id` | [CONFIRMAR] Candidatos | CandidateDetailPage · `hr-access` | ↳ Candidatos | ou `techhire.candidates.view.workspace`, `techhire.candidates.view.team`, `techhire.candidates.view.own` | criar, editar, excluir/arquivar | `techhire.candidates`, `techhire.candidates.assign.workspace`, `techpeople.people.create.own` …+1 |
| `/compliance` | Compliance LGPD · TechHire | — · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, e-mail | `techhire.compliance`, `techhire.compliance.create.own`, `techhire.compliance.create.workspace` |
| `/copilot` | [CONFIRMAR] Recruiter Copilot | CopilotPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/dei-analytics` | [CONFIRMAR] DEI Analytics | DeiAnalyticsPage | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/fraud-flags` | [CONFIRMAR] Flags de risco | FraudFlagsPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/hunting` | Buscar no LinkedIn | HuntingHub · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | WhatsApp | — |
| `/hunting/captures` | [CONFIRMAR] Capturados | HuntingCapturesPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | editar, ações em massa, IA/agente | — |
| `/hunting/install` | [CONFIRMAR] Hub | HuntingInstallPage · `ats/ui` | ↳ Hub | todo membro ativo com o módulo licenciado | editar, chaves de API | — |
| `/hunting/observability` | [CONFIRMAR] Observabilidade | HuntingObservabilityPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | WhatsApp | — |
| `/hunting/search` | [CONFIRMAR] Buscar perfis | HuntingSearchPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | filtros, importar, ações em massa, WhatsApp | — |
| `/hunting/templates` | [CONFIRMAR] Templates | HuntingTemplatesPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | criar, editar | — |
| `/insights` | [CONFIRMAR] Insights ATS | AtsInsightsPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/interview-kits` | Kits de Entrevista — ATS | InterviewKitsPage · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | `techhire.interview_kits`, `techhire.interview_kits.create.own`, `techhire.interview_kits.create.workspace` …+2 |
| `/jobs` | Título | AtsJobsPage · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, filtros, ações em massa | `techhire.jobs`, `techhire.jobs.create.own`, `techhire.jobs.create.workspace` …+6 |
| `/jobs/$id` | [CONFIRMAR] Vagas | JobDetailPage · `hiring/hiring-demand-panel` | ↳ Vagas | todo membro ativo com o módulo licenciado | exportar, ações em massa, automação/workflow | `techhire.candidates.create.own`, `techhire.candidates.create.workspace`, `techhire.candidates.export.workspace` …+3 |
| `/match-scores` | [CONFIRMAR] Match Scores | MatchScoresPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/notetaker` | Notetaker IA — ATS | NotetakerPage · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | IA/agente | `techhire.interviews` |
| `/offers` | [CONFIRMAR] Ofertas | OffersPage · `grid/grid-bulk-bar` | ✔ | todo membro ativo com o módulo licenciado | excluir/arquivar, ações em massa, kanban, assinatura eletrônica | `techhire.offers`, `techhire.offers.export.workspace` |
| `/pipelines` | [CONFIRMAR] Pipelines | PipelinesPage · `ui/input` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | `techhire.pipelines`, `techhire.pipelines.create.own`, `techhire.pipelines.create.workspace` …+1 |
| `/scheduling` | [CONFIRMAR] Scheduling | SchedulingPage · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, ações em massa | `techhire.interviewer_availability`, `techhire.interviewer_pools`, `techhire.interviewer_pools.create.own` …+5 |
| `/scorecards` | [CONFIRMAR] Scorecards | ScorecardsPage · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | `techhire.scorecards`, `techhire.scorecards.create.own`, `techhire.scorecards.create.workspace` |
| `/sourcing` | Inbox | SourcingHub · `ats/ui` | — | [CONFIRMAR] sem item de menu | WhatsApp | — |
| `/sourcing/analytics` | [CONFIRMAR] Analytics | SourcingAnalyticsPage · `charts/lazy-chart` | ✔ | todo membro ativo com o módulo licenciado | importar, exportar, WhatsApp | — |
| `/sourcing/inbox` | [CONFIRMAR] Inbox | InboxPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | WhatsApp | — |
| `/sourcing/multi-posting` | [CONFIRMAR] Multi-posting | MultiPostingPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/sourcing/pools` | [CONFIRMAR] Talent Pools | TalentPoolsPage · `ui/dialog` | ✔ | todo membro ativo com o módulo licenciado | criar | — |
| `/sourcing/referrals` | [CONFIRMAR] Indicações | ReferralsPage · `ats/ui` | ✔ | todo membro ativo com o módulo licenciado | criar | — |
| `/sourcing/sequences` | [CONFIRMAR] Sequências | SequencesPage · `ui/dialog` | ✔ | todo membro ativo com o módulo licenciado | criar, WhatsApp | — |
| `/sourcing/sequences/$id` | [CONFIRMAR] Sequências | SequenceDetailPage · `ats/ui` | ↳ Sequências | todo membro ativo com o módulo licenciado | criar, editar, WhatsApp | — |
| `/stage-emails` | [CONFIRMAR] E-mails por etapa | StageEmailsPage · `ui/input` | ✔ | todo membro ativo com o módulo licenciado | editar, e-mail | — |

**Permissões do catálogo (`techhire.*`, 41 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `briefing` | create,delete,export,update,view | own,team,workspace |
| `candidates` | assign,create,delete,export,update,view | own,team,workspace |
| `careers` | create,delete,export,update,view | own,team,workspace |
| `compliance` | create,delete,export,update,view | own,team,workspace |
| `copilot` | create,delete,export,update,view | own,team,workspace |
| `dashboard` | create,delete,export,update,view | own,team,workspace |
| `dei_analytics` | create,delete,export,update,view | own,team,workspace |
| `fraud_flags` | create,delete,export,update,view | own,team,workspace |
| `hiring` | approve | workspace |
| `hiring_demands` | approve,create,update,view | workspace |
| `hiring_policies` | manage | workspace |
| `hiring_reversal` | manage | workspace |
| `hiring_terms` | update,view | own,team,workspace |
| `hunting` | create,delete,export,update,view | own,team,workspace |
| `hunting.captures` | create,delete,export,update,view | own,team,workspace |
| `hunting.observability` | create,delete,export,update,view | own,team,workspace |
| `hunting.search` | create,delete,export,update,view | own,team,workspace |
| `hunting.templates` | create,delete,export,update,view | own,team,workspace |
| `insights` | create,delete,export,update,view | own,team,workspace |
| `interview_kits` | create,delete,export,update,view | own,team,workspace |
| `interviewer_availability` | create,delete,update,view | own,team,workspace |
| `interviewer_pools` | create,delete,update,view | own,team,workspace |
| `interviews` | manage,update,view | workspace |
| `jobs` | create,delete,export,manage,update,view | own,team,workspace |
| `match_scores` | create,delete,export,update,view | own,team,workspace |
| `notetaker` | create,delete,export,update,view | own,team,workspace |
| `offer_cancellation` | manage | workspace |
| `offer_delivery` | manage | workspace |
| `offer_terms` | update,view | own,team,workspace |
| `offers` | approve,assign,create,delete,export,update,view | own,team,workspace |
| `pipelines` | create,delete,export,update,view | own,team,workspace |
| `scheduling` | create,delete,export,update,view | own,team,workspace |
| `scorecards` | create,delete,export,update,view | own,team,workspace |
| `sourcing` | manage | workspace |
| `sourcing.analytics` | create,delete,export,update,view | own,team,workspace |
| `sourcing.inbox` | create,delete,export,update,view | own,team,workspace |
| `sourcing.multi_posting` | create,delete,export,update,view | own,team,workspace |
| `sourcing.pools` | create,delete,export,update,view | own,team,workspace |
| `sourcing.referrals` | create,delete,export,update,view | own,team,workspace |
| `sourcing.sequences` | create,delete,export,update,view | own,team,workspace |
| `stage_emails` | create,delete,export,update,view | own,team,workspace |

### TechPeople (people) — 15 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/people` | Pessoas · TechPeople | PeoplePage · `hr-access` | ✔ | ou `techpeople.people.view.workspace`, `techpeople.people.view.team`, `techpeople.people.view.own` | criar, ações em massa, kanban, e-mail | `techpeople.people`, `techpeople.people.create.own`, `techpeople.people.create.workspace` …+1 |
| `/people/$id` | Ficha da pessoa · TechPeople | PersonDetailPage · `hiring/employment-panel` | ↳ Pessoas | ou `techpeople.people.view.workspace`, `techpeople.people.view.team`, `techpeople.people.view.own` | criar, editar, e-mail | `techpeople.allocations`, `techpeople.benefits`, `techpeople.documents` …+10 |
| `/people/analytics` | Analytics · TechPeople | PeopleAnalyticsPage · `page-header` | ✔ | gestor+ ou `techpeople.allocations.view.workspace`, `techpeople.allocations.update.workspace` | criar | — |
| `/people/benefits` | Benefícios · TechPeople | BenefitsListPage · `grid/grid-list-toolbar` | ✔ | gestor+ ou `techpeople.benefits.view.workspace`, `techpeople.benefits.update.workspace` | ações em massa | `techpeople.benefits.delete.own`, `techpeople.benefits.delete.workspace`, `techpeople.benefits.update.own` …+2 |
| `/people/billing` | Faturamento de horas — TechPeople | PeopleBillingPage · `iso-date-range-picker` | ✔ | gestor+ ou `techpeople.timesheet.view.own`, `techpeople.timesheet.view.workspace`, `techpeople.timesheet.approve.workspace` | ações em massa | — |
| `/people/contract-margin` | Margem por contrato — TechPeople | ContractMarginPage · `iso-date-range-picker` | ✔ | gestor+ ou `techpeople.allocations.view.workspace`, `techpeople.allocations.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/people/dashboard` | Dashboard / TechPeople | PeopleDashboard · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/people/documents` | Documentos a vencer · TechPeople | DocumentsPage · `grid/grid-list-toolbar` | ✔ | gestor+ ou `techpeople.documents.view.workspace`, `techpeople.documents.update.workspace` | ações em massa | `techpeople.documents.delete.own`, `techpeople.documents.delete.workspace`, `techpeople.documents.update.own` …+2 |
| `/people/import-forms` | Importar do Google Forms · TechPeople | ImportFormsPage · `page-header` | ✔ | gestor+ ou `techpeople.people.create.own`, `techpeople.people.update.workspace` | importar | — |
| `/people/incidents` | Incidentes · TechPeople | IncidentsListPage · `grid/grid-list-toolbar` | ✔ | gestor+ ou `techpeople.wellbeing.incidents.view.own`, `techpeople.wellbeing.incidents.view.workspace`, `techpeople.incidents.view.workspace` | ações em massa, kanban | `techpeople.incidents.delete.own`, `techpeople.incidents.delete.workspace`, `techpeople.incidents.update.own` …+7 |
| `/people/my-team` | Meu time · TechPeople | MyTeamPage · `page-header` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/people/offboarding` | Offboarding · TechPeople | OffboardingListPage · `hr-access` | ✔ | gestor+ ou `techpeople.offboarding.view.workspace`, `techpeople.offboarding.view.team`, `techpeople.offboarding.view.own` | [CONFIRMAR] somente leitura? | `techpeople.offboarding` |
| `/people/onboarding` | Onboarding · TechPeople | OnboardingListPage · `hr-access` | ✔ | gestor+ ou `techpeople.onboarding.view.workspace`, `techpeople.onboarding.view.team`, `techpeople.onboarding.view.own` | [CONFIRMAR] somente leitura? | `techpeople.onboarding` |
| `/people/onboarding-templates` | Modelos de Onboarding · TechPeople | OnbTemplatesPage · `hr-access` | ✔ | gestor+ ou `techpeople.onboarding_templates.view.workspace`, `techpeople.onboarding_templates.view.team`, `techpeople.onboarding_templates.view.own` | criar, editar, excluir/arquivar, filtros | `techpeople.onboarding_templates`, `techpeople.onboarding_templates.create.own`, `techpeople.onboarding_templates.create.workspace` |
| `/people/psychosocial` | Riscos psicossociais · TechPeople | PsychosocialListPage · `page-header` | ✔ | gestor+ ou `techpeople.wellbeing.assessments.view.own`, `techpeople.wellbeing.assessments.view.workspace` | [CONFIRMAR] somente leitura? | — |

**Permissões do catálogo (`techpeople.*`, 25 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `allocations` | create,delete,export,update,view | own,team,workspace |
| `allocations_financial` | update,view | own,team,workspace |
| `analytics` | create,delete,export,update,view | own,team,workspace |
| `benefits` | create,delete,export,update,view | own,team,workspace |
| `documents` | create,delete,export,update,view | own,team,workspace |
| `employment` | manage,view | workspace |
| `events` | view | own,team,workspace |
| `goals` | create,delete,update,view | own,team,workspace |
| `import` | create,delete,export,update,view | own,team,workspace |
| `incidents` | create,delete,export,update,view | own,team,workspace |
| `my_team` | create,delete,export,update,view | own,team,workspace |
| `offboarding` | create,delete,export,update,view | own,team,workspace |
| `onboarding` | create,delete,export,manage,update,view | own,team,workspace |
| `onboarding_templates` | create,delete,export,update,view | own,team,workspace |
| `one_on_ones` | create,delete,update,view | own,team,workspace |
| `one_on_ones_private` | update,view | own,team,workspace |
| `people` | create,delete,export,update,view | own,team,workspace |
| `people_sensitive` | update,view | own,team,workspace |
| `performance.goals` | create,delete,update,view | own,workspace |
| `performance.one_on_ones` | create,delete,update,view | own,workspace |
| `performance.reviews` | approve,create,delete,update,view | own,workspace |
| `reviews` | approve,create,delete,update,view | own,team,workspace |
| `timesheet` | approve,create,delete,export,update,view | own,team,workspace |
| `wellbeing.assessments` | create,delete,export,update,view | own,team,workspace |
| `wellbeing.incidents` | create,delete,export,update,view | own,team,workspace |

### TechContracts (contracts) — 11 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/contracts` | Contratos | — · `work-access` | ✔ | todo membro ativo com o módulo licenciado | criar, filtros, importar, ações em massa, kanban, HubSpot, assinatura eletrônica | `techcontracts.contracts`, `techcontracts.contracts.create.own`, `techcontracts.contracts.create.workspace` |
| `/contracts/$id` | Contrato | WorkDetailAccess · `hiring/contract-signature-card` | ↳ Contratos | todo membro ativo com o módulo licenciado | editar, excluir/arquivar, assinatura eletrônica | `techcontracts.contract_activation.manage.workspace`, `techcontracts.contract_transition.manage.workspace`, `techcontracts.contracts` …+1 |
| `/contracts/$id/flow` | Fluxo do contrato — TechContracts | ContractFlowPage · `page-header` | ↳ Contratos | todo membro ativo com o módulo licenciado | criar, assinatura eletrônica | — |
| `/contracts/$id/medicoes` | Medições do contrato — TechContracts | Order3RouteAccess · `work-access` | ↳ Contratos | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | `techcontracts.contracts`, `techprojects.billing_config`, `techprojects.measurements` …+1 |
| `/contracts/dashboard` | Dashboard / TechContracts | — · `work-access` | ✔ | todo membro ativo com o módulo licenciado | assinatura eletrônica | `techcontracts.contracts` |
| `/contracts/links` | Vinculação de contratos | Order3RouteAccess · `hr-access` | ↳ Contratos | todo membro ativo com o módulo licenciado | IA/agente | `techcontracts.links` |
| `/contracts/templates` | Modelos de contrato | Order3RouteAccess · `work-action` | ✔ | todo membro ativo com o módulo licenciado | criar, excluir/arquivar, importar | `techcontracts.contract_templates` |
| `/contracts/templates/$id` | Editar modelo de contrato | Order3RouteAccess · `work-action` | ↳ Modelos de contrato | todo membro ativo com o módulo licenciado | editar | `techcontracts.contract_templates` |
| `/services` | Serviços em execução | Order3RouteAccess · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | ações em massa, kanban, HubSpot | `techservice.services`, `techservice.services.delete.own`, `techservice.services.delete.team` …+4 |
| `/services/$id` | Serviço | Order3RouteAccess · `work-action` | ↳ Serviços em execução | todo membro ativo com o módulo licenciado | editar, excluir/arquivar | `techfinance.entries.create.own`, `techfinance.entries.create.workspace`, `techfinance.entries.view.own` …+3 |
| `/settings/contract-defaults` | [CONFIRMAR] Padrões de contrato | Order3RouteAccess · `hr-access` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | `techcontracts.defaults` |

**Permissões do catálogo (`techcontracts.*`, 15 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `approvals` | approve,manage,view | own,team,workspace |
| `audit` | view | own,team,workspace |
| `clauses` | create,delete,update,view | own,workspace |
| `contract_activation` | manage | workspace |
| `contract_templates` | assign,create,delete,export,update,view | own,team,workspace |
| `contract_transition` | manage | workspace |
| `contracts` | approve,assign,create,delete,export,update,view | own,team,workspace |
| `defaults` | manage,view | workspace |
| `esign` | create,delete,manage,update,view | own,team,workspace |
| `esign_cancel` | manage | workspace |
| `esign_send` | manage | workspace |
| `esign_share` | manage | workspace |
| `imports` | manage,view | workspace |
| `links` | manage,view | workspace |
| `signature_evidence` | manage,view | workspace |

### TechProjects (projects) — 22 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/projects` | Projetos | — · `work-access` | ✔ | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | criar, ações em massa, kanban | `techprojects.projects`, `techprojects.projects.create.own`, `techprojects.projects.create.workspace` …+5 |
| `/projects/$id` | [CONFIRMAR] Projetos | WorkDetailAccess · `work-action` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | criar | `techfinance.entries.create.own`, `techfinance.entries.create.workspace`, `techfinance.entries.view.own` …+14 |
| `/projects/$id/entrega` | [CONFIRMAR] Projetos | Order3RouteAccess · `work-access` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | [CONFIRMAR] somente leitura? | `techprojects.project_updates`, `techprojects.projects` |
| `/projects/$id/financeiro` | Medições e rentabilidade do projeto — TechProjects | Order3RouteAccess · `work-access` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | [CONFIRMAR] somente leitura? | `techprojects.measurements`, `techprojects.profitability`, `techprojects.projects` |
| `/projects/$id/horas` | Horas e aprovação do projeto — TechProjects | ProjectHoursPage · `page-header` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/projects/dashboard` | Dashboard / TechProjects | — · `work-access` | ✔ | ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` … | [CONFIRMAR] somente leitura? | `techprojects.projects`, `techprojects.tasks` |
| `/projects/hours-review` | Revisão de Horas — TechProjects | HoursReviewPage · `page-header` | ✔ | gestor+ ou `techprojects.time_entries.approve.workspace`, `techprojects.timesheet.approve.workspace`, `techprojects.time_entries.view.own` | [CONFIRMAR] somente leitura? | — |
| `/projects/lists/$id` | Lista — TechProjects | Order3RouteAccess · `work-action` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | criar | `techprojects.custom_fields`, `techprojects.list_templates`, `techprojects.lists` …+2 |
| `/projects/my-hours` | Minhas Horas — TechProjects | MyHoursPage · `page-header` | ✔ | ou `techprojects.time_entries.view.own`, `techprojects.time_entries.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/projects/my-work` | My Work — TechProjects | MyWorkPage · `page-header` | ✔ | ou `techprojects.my_work.view.own`, `techprojects.my_work.view.team`, `techprojects.my_work.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/projects/settings/delivery` | Entrega de negócios — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | [CONFIRMAR] somente leitura? | `techprojects.delivery` |
| `/projects/settings/imports` | Importações — TechProjects | Order3RouteAccess · `hr-access` | ↳ Projetos | gestor+ ou `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` | [CONFIRMAR] somente leitura? | `techprojects.clickup_import`, `techprojects.clockify_import`, `techprojects.jibble_import` …+1 |
| `/projects/settings/imports/clickup` | Importar do ClickUp — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | importar | `techprojects.clickup_import` |
| `/projects/settings/imports/clockify` | Importar do Clockify — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | importar | `techprojects.clockify_import` |
| `/projects/settings/imports/jibble` | Importar do Jibble — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | importar | `techprojects.jibble_import` |
| `/projects/settings/imports/reconciliation` | Conciliação de horas importadas — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | [CONFIRMAR] somente leitura? | `techprojects.reconciliation` |
| `/projects/settings/operations` | Operação e saúde — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono | [CONFIRMAR] somente leitura? | `techprojects.operations` |
| `/projects/settings/rates` | Tarifas e custos — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono ou `techprojects.rates.view.workspace` | [CONFIRMAR] somente leitura? | `techprojects.rates` |
| `/projects/settings/time` | Política de horas e modelos — TechProjects | Order3RouteAccess · `hr-access` | ✔ | admin/dono ou `techprojects.time_policy.view.workspace`, `techprojects.delivery_templates.view.workspace` | [CONFIRMAR] somente leitura? | `techprojects.delivery_templates`, `techprojects.time_policy` |
| `/projects/spaces` | Espaços — TechProjects | Order3RouteAccess · `work-action` | ✔ | gestor+ ou `techprojects.spaces.view.team`, `techprojects.spaces.view.workspace` | criar | `techprojects.folders`, `techprojects.lists`, `techprojects.spaces` |
| `/projects/tasks` | Tarefas de projetos | — · `work-access` | ✔ | ou `techprojects.tasks.view.own`, `techprojects.tasks.view.team`, `techprojects.tasks.view.workspace` | ações em massa, kanban | `techprojects.tasks`, `techprojects.tasks.delete.own`, `techprojects.tasks.delete.workspace` …+3 |
| `/projects/timesheet` | Timesheet — TechProjects | TimesheetPage · `page-header` | ✔ | gestor+ ou `techprojects.timesheet.view.team`, `techprojects.timesheet.view.workspace` | filtros, automação/workflow | — |

**Permissões do catálogo (`techprojects.*`, 36 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `alerts` | manage,view | workspace |
| `approvers` | manage,view | workspace |
| `billing_config` | manage,view | workspace |
| `clickup_import` | manage,view | workspace |
| `clockify_import` | manage,view | workspace |
| `costs` | manage | workspace |
| `custom_fields` | manage,view | workspace |
| `delivery` | manage,view | workspace |
| `delivery_templates` | manage,view | workspace |
| `folders` | create,delete,export,update,view | own,team,workspace |
| `jibble_import` | manage,view | workspace |
| `list_templates` | manage,view | own,team,workspace |
| `lists` | assign,create,delete,export,update,view | own,team,workspace |
| `measurement_finance` | create | workspace |
| `measurement_reverse` | manage | workspace |
| `measurements` | approve,export,manage,view | workspace |
| `members` | manage,view | own,team,workspace |
| `milestone_billing` | create | workspace |
| `milestones` | assign,create,delete,export,update,view | own,team,workspace |
| `my_work` | create,delete,export,update,view | own,team,workspace |
| `operations` | manage,view | workspace |
| `profitability` | export,view | workspace |
| `project_updates` | assign,create,delete,export,update,view | own,team,workspace |
| `projects` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `rates` | manage,view | workspace |
| `reconciliation` | manage,view | workspace |
| `risk_rules` | manage,view | workspace |
| `spaces` | create,delete,export,update,view | own,team,workspace |
| `statuses` | manage,view | workspace |
| `tasks` | assign,create,delete,export,update,view | own,team,workspace |
| `time_entries` | approve,create,delete,export,update,view | own,team,workspace |
| `time_policy` | manage,view | workspace |
| `time_tags` | manage,view | workspace |
| `timesheet` | approve,create,delete,export,update,view | own,team,workspace |
| `timesheet_closing` | manage | workspace |
| `timesheet_reopen` | manage | workspace |

### TechFinance (finance) — 19 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/finance` | Financeiro | — · `hr-access` | ✔ | gestor+ ou `techfinance.entries.view.own`, `techfinance.entries.view.team`, `techfinance.entries.view.workspace` | criar | `techfinance.entries`, `techfinance.entries.create.own`, `techfinance.entries.create.workspace` |
| `/finance/audit` | Auditoria financeira | — · `hr-access` | ✔ | admin/dono ou `techfinance.audit.view.workspace`, `techfinance.audit.view.team`, `techfinance.audit.view.own` | [CONFIRMAR] somente leitura? | `techfinance.audit` |
| `/finance/bank-accounts` | Contas bancárias | — · `hr-access` | ✔ | gestor+ ou `techfinance.bank_accounts.view.workspace`, `techfinance.bank_accounts.view.team`, `techfinance.bank_accounts.view.own` | criar | `techfinance.bank_accounts`, `techfinance.bank_accounts.create.workspace`, `techfinance.bank_accounts.export.workspace` |
| `/finance/banking` | Banco Inter — Conexão / TechFinance | — · `hr-access` | ✔ | gestor+ ou `techfinance.banking.view.workspace` | criar, ações em massa, e-mail | `techfinance.banking` |
| `/finance/banking/reconciliation` | Conciliação bancária / TechFinance | — · `hr-access` | ✔ | gestor+ ou `techfinance.banking.view.workspace` | criar, ações em massa | `techfinance.banking`, `techfinance.banking.update.workspace` |
| `/finance/cash-flow` | Fluxo de caixa | — · `hr-access` | ✔ | gestor+ ou `techfinance.reports.view.workspace`, `techfinance.reports.view.team`, `techfinance.reports.view.own` | ações em massa | `techfinance.reports` |
| `/finance/categories` | Plano de contas | — · `hr-access` | ✔ | gestor+ ou `techfinance.categories.view.workspace`, `techfinance.categories.view.team`, `techfinance.categories.view.own` | criar, excluir/arquivar | `techfinance.categories`, `techfinance.categories.create.workspace`, `techfinance.categories.delete.workspace` |
| `/finance/cost-centers` | Centros de custo | — · `hr-access` | ✔ | gestor+ ou `techfinance.cost_centers.view.workspace`, `techfinance.cost_centers.view.team`, `techfinance.cost_centers.view.own` | [CONFIRMAR] somente leitura? | `techfinance.cost_centers` |
| `/finance/dre` | DRE gerencial | — · `hr-access` | ✔ | gestor+ ou `techfinance.reports.view.workspace`, `techfinance.reports.view.team`, `techfinance.reports.view.own` | importar, exportar, ações em massa | `techfinance.reports`, `techfinance.reports.export.workspace` |
| `/finance/entries/$id` | [CONFIRMAR] Dashboard | — · `hr-access` | ↳ Dashboard | gestor+ ou `techfinance.entries.view.own`, `techfinance.entries.view.team`, `techfinance.entries.view.workspace` | excluir/arquivar | `techfinance.entries` |
| `/finance/legal-entities` | Empresas (CNPJs) | — · `hr-access` | ✔ | admin/dono ou `techfinance.legal_entities.view.workspace`, `techfinance.legal_entities.view.team`, `techfinance.legal_entities.view.own` | [CONFIRMAR] somente leitura? | `techfinance.legal_entities` |
| `/finance/legal-entity-groups` | Grupos empresariais | — · `hr-access` | ✔ | admin/dono ou `techfinance.legal_entity_groups.view.workspace`, `techfinance.legal_entity_groups.view.team`, `techfinance.legal_entity_groups.view.own` | [CONFIRMAR] somente leitura? | `techfinance.legal_entity_groups` |
| `/finance/nfse` | NFS-e | — · `hr-access` | ✔ | gestor+ ou `techfinance.nfse.view.workspace`, `techfinance.nfse.view.team`, `techfinance.nfse.view.own` | filtros, kanban | `techfinance.nfse`, `techfinance.nfse.export.workspace` |
| `/finance/payable` | Contas a pagar | — · `finance/entries-list-page` | ✔ | gestor+ ou `techfinance.entries.view.own`, `techfinance.entries.view.team`, `techfinance.entries.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/finance/receivable` | Contas a receber | — · `finance/entries-list-page` | ✔ | gestor+ ou `techfinance.entries.view.own`, `techfinance.entries.view.team`, `techfinance.entries.view.workspace` | [CONFIRMAR] somente leitura? | — |
| `/finance/recurrences` | Recorrências financeiras | — · `hr-access` | ✔ | gestor+ ou `techfinance.recurrences.view.own`, `techfinance.recurrences.view.team`, `techfinance.recurrences.view.workspace` | criar, excluir/arquivar | `techfinance.recurrences`, `techfinance.recurrences.create.own`, `techfinance.recurrences.create.workspace` |
| `/finance/sales` | Vendas importadas / TechFinance | — · `hr-access` | ✔ | ou `techfinance.sales.view.workspace` | filtros | `techfinance.sales` |
| `/settings/charging-templates` | [CONFIRMAR] Templates de cobrança | — · `hr-access` | ✔ | gestor+ ou `techfinance.charging_templates.view.workspace`, `techfinance.charging_templates.view.team`, `techfinance.charging_templates.view.own` | criar, editar, excluir/arquivar, WhatsApp, e-mail | `techfinance.charging_templates`, `techfinance.charging_templates.create.own`, `techfinance.charging_templates.create.workspace` |
| `/settings/dunning` | [CONFIRMAR] Régua de cobrança | — · `hr-access` | ✔ | gestor+ ou `techfinance.dunning.view.workspace`, `techfinance.dunning.view.team`, `techfinance.dunning.view.own` | criar, editar, excluir/arquivar, WhatsApp, e-mail | `techfinance.charging_templates.view.own`, `techfinance.charging_templates.view.team`, `techfinance.charging_templates.view.workspace` …+4 |

**Permissões do catálogo (`techfinance.*`, 32 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `audit` | create,delete,export,update,view | own,team,workspace |
| `bank_accounts` | create,delete,export,update,view | own,team,workspace |
| `bank_charge_cancellation` | manage | workspace |
| `bank_charge_issuance` | manage | workspace |
| `bank_payment_approval` | manage | workspace |
| `bank_payment_cancellation` | manage | workspace |
| `bank_payment_drafts` | create | workspace |
| `bank_payment_execution` | manage | workspace |
| `banking` | create,delete,export,manage,update,view | own,team,workspace |
| `banking_simulation` | manage | workspace |
| `banking_sync` | manage | workspace |
| `categories` | create,delete,export,update,view | own,team,workspace |
| `charging_templates` | create,delete,export,update,view | own,team,workspace |
| `contaazul_people` | manage,view | workspace |
| `cost_centers` | create,delete,export,update,view | own,team,workspace |
| `dunning` | approve,create,delete,export,manage,update,view | own,team,workspace |
| `entries` | approve,assign,create,delete,export,manage,update,view | own,team,workspace |
| `entry_cancellation` | manage | workspace |
| `invoice_cancellation` | manage | workspace |
| `invoice_issuance` | manage | workspace |
| `invoice_settlement` | manage | workspace |
| `invoices` | approve,create,delete,export,update,view | own,team,workspace |
| `legal_entities` | create,delete,export,update,view | own,team,workspace |
| `legal_entity_groups` | create,delete,export,update,view | own,team,workspace |
| `nfse` | create,delete,export,manage,update,view | own,team,workspace |
| `nfse_issuance` | manage | workspace |
| `nfse_settings` | manage,view | workspace |
| `payments` | approve,create,delete,export,update,view | own,team,workspace |
| `payments_settings` | manage,view | workspace |
| `recurrences` | create,delete,export,update,view | own,team,workspace |
| `reports` | create,delete,export,update,view | own,team,workspace |
| `sales` | view | workspace |

### Core ERP / Configurações (compartilhado) — 84 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/` | [CONFIRMAR]  | AuthenticatedLayout · `sales-access` | — | [CONFIRMAR] sem item de menu | automação/workflow, WhatsApp, HubSpot, webhooks | — |
| `/auth/extension-link` | [CONFIRMAR] extension-link | ExtensionLinkPage · `ats/ui` | — | [CONFIRMAR] sem item de menu | chaves de API | — |
| `/catalog/contracting-presets` | Presets e cargos de contratação | PresetsAndProfilesPage · `techhire/ui` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/catalog/services` | [CONFIRMAR] Catálogo de Serviços | ServiceCatalogPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | `techsales.catalog.services.update.workspace` |
| `/files` | Arquivos · TechERP | FilesPage · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | — |
| `/home` | Dashboard / TechERP | ErpHomeDashboard · `date-range-picker` | ✔ | todo membro ativo com o módulo licenciado | importar, exportar, ações em massa | — |
| `/home/print` | [CONFIRMAR] Dashboard | HomePrintPage | ↳ Dashboard | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/modules` | Membros | ErpHome · `techhire/ui` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/onboarding/$entity` | Onboarding guiado · ${params.entity} | OnboardingEntityPage · `page-header` | — | [CONFIRMAR] sem item de menu | criar, ações em massa, automação/workflow | — |
| `/settings` | [CONFIRMAR] Perfil | SettingsIndex · `ui/card` | ✔ | todo membro ativo com o módulo licenciado | editar | — |
| `/settings` | [CONFIRMAR] Perfil | SettingsLayout · `ui/input` | ✔ | todo membro ativo com o módulo licenciado | importar, exportar, automação/workflow, IA/agente, WhatsApp, HubSpot, webhooks | `techcontracts.esign.view.workspace`, `techfinance.nfse_settings.view.workspace`, `techfinance.payments_settings.view.workspace` …+1 |
| `/settings/access-policy` | [CONFIRMAR] Perfil | AccessPolicyPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar | — |
| `/settings/ads-sync` | [CONFIRMAR] Perfil | AdsSyncPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/ai-panel` | Painel de IA — Configurações | AiPanelPage · `ai/ai-panel-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/settings/api-keys` | [CONFIRMAR] Perfil | ApiKeysPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, chaves de API | — |
| `/settings/audit-export` | [CONFIRMAR] Perfil | AuditExportPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, importar, webhooks | — |
| `/settings/audit-log` | [CONFIRMAR] Perfil | AuditLogPage · `ui/badge` | ↳ Perfil | todo membro ativo com o módulo licenciado | filtros | — |
| `/settings/billing` | [CONFIRMAR] Planos e cobrança | BillingPage · `page-header` | ✔ | admin/dono ou `system.billing.view.workspace`, `system.billing.update.workspace` | automação/workflow, IA/agente, WhatsApp, webhooks, chaves de API | — |
| `/settings/branding` | White Label / TechERP | BrandingPage · `ui/tabs` | ✔ | admin/dono ou `system.branding.view.workspace`, `system.branding.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/channels` | [CONFIRMAR] Canais de atendimento | ServiceChannelsPage · `service-channels/connection-configuration` | ✔ | admin/dono ou `system.channels.view.workspace`, `system.channels.update.workspace` | IA/agente, WhatsApp, e-mail | — |
| `/settings/clauses` | [CONFIRMAR] Perfil | ClausesPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | — |
| `/settings/custom-objects` | [CONFIRMAR] Objetos custom | CustomObjectsPage · `ui/card` | ✔ | admin/dono ou `system.custom_objects.view.workspace`, `system.custom_objects.update.workspace` | criar, editar | — |
| `/settings/custom-properties` | [CONFIRMAR] Propriedades | CustomPropsPage · `ui/card` | ✔ | admin/dono ou `system.custom_properties.view.workspace`, `system.custom_properties.update.workspace` | criar, editar, IA/agente | — |
| `/settings/data-residency` | [CONFIRMAR] Perfil | DataResidencyPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/email-templates` | [CONFIRMAR] Templates de email | EmailTemplatesPage · `ui/button` | ✔ | gestor+ ou `system.automation.email_templates.view.workspace`, `system.automation.email_templates.manage.workspace` | criar, editar, excluir/arquivar, assinatura eletrônica | — |
| `/settings/enrichment` | [CONFIRMAR] Perfil | EnrichmentHistoryPage · `prospecting/pages/enrichment-history-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/esign` | [CONFIRMAR] Perfil | — · `hr-access` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, excluir/arquivar, assinatura eletrônica | `techcontracts.esign`, `techcontracts.esign.create.own`, `techcontracts.esign.create.team` …+1 |
| `/settings/exports` | [CONFIRMAR] Perfil | ExportsPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, importar, e-mail | — |
| `/settings/forms` | [CONFIRMAR] Perfil | FormsPage · `forms/forms-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/goals` | [CONFIRMAR] Perfil | GoalsPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar | — |
| `/settings/hubspot-users` | [CONFIRMAR] Perfil | HubspotUsersPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, HubSpot | — |
| `/settings/import` | Importar dados | ImportHubPage · `integrations/pages/import-hub-page` | ✔ | admin/dono ou `system.import.view.workspace`, `system.import.update.workspace` | importar | — |
| `/settings/import-csv` | [CONFIRMAR] Perfil | ImportCsvPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, importar | — |
| `/settings/integrations` | Integrações | IntegrationsCatalog · `integrations/pages/integrations-catalog-page` | ✔ | admin/dono ou `system.integrations.view.workspace`, `system.integrations.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/integrations/$slug` | Integração | RouteComponent · `integrations/pages/integration-detail-page` | ↳ Integrações | admin/dono ou `system.integrations.view.workspace`, `system.integrations.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/integrations/ai` | Inteligência Artificial — Integrações | AiProviderPage · `integrations/pages/ai-provider-page` | ↳ Integrações | admin/dono ou `system.integrations.view.workspace`, `system.integrations.update.workspace` | IA/agente | — |
| `/settings/integrations/contaazul` | Conta Azul — Integração TechFinance | ContaAzulIntegrationPage · `integrations/pages/contaazul-integration-page` | ↳ Integrações | admin/dono ou `system.integrations.view.workspace`, `system.integrations.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/integrations/linkedin` | [CONFIRMAR] LinkedIn (Unipile) | LinkedinIntegrationPage · `ui/card` | ✔ | admin/dono ou `system.linkedin.view.workspace`, `system.linkedin.update.workspace` | editar, WhatsApp, webhooks | — |
| `/settings/language` | [CONFIRMAR] Idioma | LanguagePage · `ui/card` | ✔ | admin/dono ou `system.language.view.workspace`, `system.language.update.workspace` | [CONFIRMAR] somente leitura? | `settings.language` |
| `/settings/lead-sources` | [CONFIRMAR] Perfil | LeadSourcesPage · `page-header` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar | — |
| `/settings/legal-entities` | Empresas (CNPJs) | LegalEntitiesPage · `finance/legal-entities-page` | ✔ | admin/dono ou `system.legal_entities.view.workspace`, `system.legal_entities.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/legal-entity-groups` | Grupos empresariais | LegalEntityGroupsPage · `finance/legal-entity-groups-page` | ✔ | admin/dono ou `system.legal_entity_groups.view.workspace`, `system.legal_entity_groups.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/marketplace` | Marketplace | MarketplacePage · `marketplace/pages/marketplace-list-page` | ✔ | admin/dono ou `system.marketplace.view.workspace`, `system.marketplace.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/marketplace/$slug` | App do Marketplace | RouteComponent · `marketplace/pages/marketplace-detail-page` | ↳ Marketplace | admin/dono ou `system.marketplace.view.workspace`, `system.marketplace.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/media` | Biblioteca de mídia | MediaLibraryPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | excluir/arquivar | — |
| `/settings/meeting-reminders` | Lembretes de reunião — Configurações / TechERP | — · `whatsapp/meeting-reminders-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | WhatsApp | — |
| `/settings/mobile` | [CONFIRMAR] Perfil | MobilePage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, IA/agente | — |
| `/settings/my-permissions` | [CONFIRMAR] Perfil | MyPermissionsPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/my-tickets` | Meus chamados | MyBugReportsPage · `bug-reports/pages/my-bug-reports-page` | ✔ | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/nfse` | [CONFIRMAR] Perfil | — · `workspace-settings-access` | ↳ Perfil | todo membro ativo com o módulo licenciado | editar, chaves de API | `techfinance.nfse_settings` |
| `/settings/notifications` | [CONFIRMAR] Perfil | NotificationsSettingsPage · `page-header` | ↳ Perfil | todo membro ativo com o módulo licenciado | editar, WhatsApp, e-mail | — |
| `/settings/notifications/slack` | [CONFIRMAR] Perfil | SlackSettingsPage · `page-header` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, webhooks | — |
| `/settings/onboarding-templates` | Modelos de onboarding | OnbTemplatesPage · `page-header` | ✔ | gestor+ ou `system.onboarding_templates.view.workspace`, `system.onboarding_templates.manage.workspace` | criar, editar, automação/workflow | — |
| `/settings/payments` | [CONFIRMAR] Perfil | — · `workspace-settings-access` | ↳ Perfil | todo membro ativo com o módulo licenciado | editar, webhooks | `techfinance.payments_settings` |
| `/settings/permissions` | Permissões — TechERP | PermissionsPage · `hiring/access-models-panel` | ✔ | admin/dono ou `system.roles.view.workspace`, `system.roles.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/phones` | Telefones — Configurações | PhonesSettingsPage · `techhire/ui` | ✔ | admin/dono ou `system.language.view.workspace`, `system.language.update.workspace` | editar, filtros | — |
| `/settings/pipelines` | [CONFIRMAR] Pipelines | PipelinesSettings · `ui/button` | ✔ | admin/dono ou `system.pipelines.view.workspace`, `system.pipelines.update.workspace` | criar, editar, excluir/arquivar | — |
| `/settings/playbooks` | [CONFIRMAR] Perfil | PlaybooksPage · `prospecting/pages/playbooks-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/privacy` | [CONFIRMAR] Privacidade & Meus Dados | PrivacyPage · `page-header` | ✔ | todo membro ativo com o módulo licenciado | excluir/arquivar, exportar, assinatura eletrônica | — |
| `/settings/property-groups` | [CONFIRMAR] Perfil | PropertyGroupsPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar | — |
| `/settings/proposal-templates` | Modelos de proposta — Configurações | ProposalTemplatesPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | — |
| `/settings/quote-templates` | [CONFIRMAR] Perfil | QuoteTemplatesPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar | — |
| `/settings/rbac-diagnostics` | Diagnóstico de acesso — TechERP | RbacDiagnosticsPage · `techhire/ui` | ✔ | admin/dono ou `system.rbac_diagnostics.view.workspace`, `system.rbac_diagnostics.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/record-layouts` | Sobre | RecordLayoutsPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar | — |
| `/settings/recurring` | [CONFIRMAR] Perfil | RecurringPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, excluir/arquivar, assinatura eletrônica | — |
| `/settings/scim` | [CONFIRMAR] Perfil | ScimPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/scoring` | [CONFIRMAR] Perfil | ScoringPage · `prospecting/pages/scoring-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/security` | [CONFIRMAR] Segurança (2FA) | SecurityPage · `ui/card` | ✔ | todo membro ativo com o módulo licenciado | criar | — |
| `/settings/segments` | Segmentos / TechSales | SegmentsPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, filtros | — |
| `/settings/snippets` | [CONFIRMAR] Snippets | SnippetsSettings · `ui/button` | ✔ | todo membro ativo com o módulo licenciado | criar, editar, WhatsApp | — |
| `/settings/sso` | [CONFIRMAR] Perfil | SsoPage · `ui/card` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/subscriptions` | [CONFIRMAR] Perfil | — · `crud-settings` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/surveys` | [CONFIRMAR] Perfil | SurveysPage · `surveys/surveys-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/teams` | [CONFIRMAR] Membros | UsersPage · `ui/card` | ✔ | admin/dono ou `system.members.view.workspace`, `system.members.update.workspace` | criar, editar, e-mail, HubSpot, chaves de API | — |
| `/settings/user-groups` | [CONFIRMAR] Times | UserGroupsPage · `ui/card` | ✔ | gestor+ ou `system.user_groups.view.workspace`, `system.user_groups.manage.workspace` | criar, editar | — |
| `/settings/video` | [CONFIRMAR] Perfil | — · `workspace-settings-access` | ↳ Perfil | todo membro ativo com o módulo licenciado | editar | `techsales.meeting_settings` |
| `/settings/voice-agent` | Agente de voz — Configurações / TechERP | VoiceAgentPage · `prospecting/pages/voice-agent-page` | ↳ Perfil | todo membro ativo com o módulo licenciado | IA/agente | — |
| `/settings/webhooks` | [CONFIRMAR] Perfil | WebhooksPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, filtros, webhooks | — |
| `/settings/whatsapp` | Conexão do WhatsApp / TechERP | WhatsAppSettings · `service-channels/whatsapp-configuration` | ✔ | admin/dono ou `system.whatsapp.view.workspace`, `system.whatsapp.update.workspace` | WhatsApp | — |
| `/settings/widget` | [CONFIRMAR] Widget do site | WidgetSettings · `service-channels/widget-configuration` | ✔ | admin/dono ou `system.widget.view.workspace`, `system.widget.update.workspace` | [CONFIRMAR] somente leitura? | — |
| `/settings/workflow-subscriptions` | Assinaturas de workflow | WorkflowSubscriptionsPage · `ui/button` | ↳ Perfil | todo membro ativo com o módulo licenciado | criar, editar, automação/workflow, assinatura eletrônica | — |
| `/settings/workspace-team` | [CONFIRMAR] Perfil | — | ↳ Perfil | todo membro ativo com o módulo licenciado | [CONFIRMAR] somente leitura? | — |
| `/settings/zapier` | [CONFIRMAR] Perfil | ZapierSettingsPage · `page-header` | ↳ Perfil | todo membro ativo com o módulo licenciado | chaves de API | — |
| `/workspace/modules` | [CONFIRMAR] modules | WorkspaceModules · `ui/button` | — | [CONFIRMAR] sem item de menu | assinatura eletrônica | — |

**Permissões do catálogo (`system.*`, 53 recursos):**

| Recurso | Ações | Escopos |
|---|---|---|
| `ai_settings` | manage,view | workspace |
| `analytics.dashboards` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `analytics.insights` | create,delete,export,manage,update,view | own,team,workspace |
| `analytics.reports` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `api_keys` | create,delete,manage,view | own |
| `audit` | create,delete,export,update,view | own,team,workspace |
| `audit_exports` | create,delete,manage,update,view | workspace |
| `automation.email_templates` | create,delete,export,manage,update,view | own,team,workspace |
| `automation.macros` | create,delete,export,manage,update,view | own,team,workspace |
| `automation.rotation` | create,delete,export,manage,update,view | own,team,workspace |
| `automation.sequences` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `automation.sla` | create,delete,export,manage,update,view | own,team,workspace |
| `billing` | create,delete,export,manage,update,view | own,team,workspace |
| `booking` | assign,create,delete,export,manage,update,view | own,team,workspace |
| `branding` | create,delete,export,update,view | own,team,workspace |
| `calendars` | create,delete,export,manage,update,view | own,team,workspace |
| `channels` | approve,manage,view | workspace |
| `communication.subscription_types` | create,delete,update,view | workspace |
| `custom_objects` | create,delete,export,update,view | own,team,workspace |
| `custom_properties` | create,delete,export,update,view | own,team,workspace |
| `files` | create,delete,export,update,view | own,team,workspace |
| `files_share` | manage,view | own,team,workspace |
| `hiring_access` | manage,view | workspace |
| `home` | create,delete,export,update,view | own,team,workspace |
| `hubspot_sync` | create,delete,export,manage,update,view | own,team,workspace |
| `import` | create,delete,export,manage,update,view | own,team,workspace |
| `integration_sync` | create,delete,export,manage,update,view | own,team,workspace |
| `integrations` | create,delete,export,manage,update,view | own,team,workspace |
| `kb.articles` | create,delete,export,manage,update,view | own,team,workspace |
| `language` | create,delete,export,update,view | own,team,workspace |
| `legal_entities` | create,delete,export,update,view | own,team,workspace |
| `legal_entity_groups` | create,delete,export,update,view | own,team,workspace |
| `linkedin` | create,delete,export,manage,update,view | own,team,workspace |
| `marketplace` | create,delete,export,update,view | own,team,workspace |
| `media` | create,delete,manage,view | own,team,workspace |
| `members` | create,delete,export,manage,update,view | own,team,workspace |
| `messenger` | create,manage,view | own |
| `modules` | create,delete,export,update,view | own,team,workspace |
| `onboarding_templates` | create,delete,export,manage,update,view | own,team,workspace |
| `phone_normalization` | manage,view | workspace |
| `pipelines` | create,delete,export,manage,update,view | own,team,workspace |
| `portal` | create,delete,export,manage,update,view | own,team,workspace |
| `rbac_diagnostics` | create,delete,export,update,view | own,team,workspace |
| `roles` | create,delete,export,manage,update,view | own,team,workspace |
| `settings` | create,delete,export,manage,update,view | own,team,workspace |
| `snippets` | create,delete,export,manage,update,view | own,team,workspace |
| `user_groups` | create,delete,export,manage,update,view | own,team,workspace |
| `webhooks` | create,delete,export,manage,update,view | own,team,workspace |
| `whatsapp` | create,delete,export,manage,update,view | own,team,workspace |
| `whatsapp_suppressions` | manage | workspace |
| `widget` | create,delete,export,update,view | own,team,workspace |
| `workflow_approvals` | manage,view | own,team,workspace |
| `workflows` | create,delete,export,manage,update,view | own,team,workspace |

### Administração da plataforma — 9 telas

| Rota | Título / propósito | Componente principal | Menu | Quem vê (menu) | Funcionalidades detectadas | Chaves na rota |
|---|---|---|---|---|---|---|
| `/admin/bug-reports` | [CONFIRMAR] Chamados | BugReportsAdminPage · `kanban/kanban-board` | ✔ | admin da plataforma | excluir/arquivar, ações em massa, kanban, IA/agente | — |
| `/admin/workspaces` | [CONFIRMAR] Super-admin | WorkspacesAdminPage · `ui/card` | ✔ | admin da plataforma | criar, editar, excluir/arquivar | — |
| `/admin/workspaces/$id` | [CONFIRMAR] Super-admin | WorkspaceDetailPage · `ui/card` | ↳ Super-admin | admin da plataforma | editar, excluir/arquivar | — |
| `/qa/test-cases` | [CONFIRMAR] test-cases | QaTestCasesPage · `ui/card` | — | [CONFIRMAR] sem item de menu | importar, exportar | — |
| `/settings/platform/alerts` | Alertas da plataforma | AdminAlertsPage · `platform/pages/platform-alerts-page` | ✔ | admin da plataforma | [CONFIRMAR] somente leitura? | — |
| `/settings/platform/quotas` | Quotas da plataforma | AdminQuotasPage · `platform/pages/platform-quotas-page` | ✔ | admin da plataforma | [CONFIRMAR] somente leitura? | — |
| `/settings/platform/sandbox` | Sandbox da plataforma | AdminSandboxPage · `platform/pages/platform-sandbox-page` | ✔ | admin da plataforma | [CONFIRMAR] somente leitura? | — |
| `/settings/platform/security` | Segurança da plataforma | SecurityScansPage · `platform/pages/platform-security-scans-page` | ✔ | admin da plataforma | [CONFIRMAR] somente leitura? | — |
| `/settings/platform/status` | Status da plataforma | AdminStatusPage · `platform/pages/platform-status-page` | ✔ | admin da plataforma | [CONFIRMAR] somente leitura? | — |

### Recursos `techservice.*` no catálogo (7) — atendimento do Core (tickets, SLA, KB, macros)

| Recurso | Ações | Escopos |
|---|---|---|
| `billing` | manage | workspace |
| `kb` | create,delete,manage,update,view | own,workspace |
| `macros` | create,delete,manage,update,view | own,workspace |
| `products` | create,delete,export,update,view | own,team,workspace |
| `services` | assign,create,delete,export,update,view | own,team,workspace |
| `sla` | manage,view | workspace |
| `tickets` | assign,create,delete,export,update,view | own,workspace |

## 3. Permissões por funcionalidade — regras gerais verificadas

- **Ver/criar/editar/excluir:** chaves `<módulo>.<recurso>.<ação>.<escopo>` (ações: view, create, update, delete, export, assign, approve, manage; escopos: own, team, workspace). Avaliadas por `user_can_act(recurso, ação, escopo)` no banco e `current_user_permissions()` na interface.
- **Exclusão:** RLS negada não gera erro; as telas usam `deleteRowGuarded` (`src/lib/delete-guard.ts`). Artigos de exclusão precisam explicar a mensagem de "sem permissão".
- **Campos sensíveis:** `field_permission_rules` mascaram/ocultam campos por cargo. [CONFIRMAR] lista de campos por módulo na Fase 2.
- **Visibilidade restrita por cargo:** políticas restritivas `rep_scope_*` + `job_roles.restricted_visibility` (TechSales).
- **"Ver como":** sessão real do alvo após checagem de admin; papel de teste grava só em leads/companies/contacts/deals/activities.
- **Cargos:** só owner/admin alteram (`/settings/permissions`).

## 4. Telas expostas ao cliente ou a terceiros (públicas, sem login)

Acesso por **token/slug** com mecanismo próprio, sem sessão do TechERP. Candidatas a extensão ao cliente: `/portal/$token` e telas de projeto do TechProjects (hoje internas).

| Rota | Título / propósito | Componente | Funcionalidades detectadas |
|---|---|---|---|
| `/accept-employment/$token` | Aceitar acesso de contratação — TechERP | AcceptEmployment | — |
| `/accept-invite` | Aceitar convite — WK Technology CRM | AcceptInvitePage | criar |
| `/accept-invite/$token` | Aceitar convite — WK Technology CRM | AcceptInviteTokenPage | — |
| `/book/$slug` | Agendar reunião — WK Technology CRM | PublicBookingPage | e-mail |
| `/careers` | Vagas abertas — Careers | CareersIndex | — |
| `/careers/$slug` | [CONFIRMAR] | CareerJobPage | e-mail |
| `/dpa` | DPA — Acordo de Processamento de Dados — WK Technology CRM | DpaPage | IA/agente, WhatsApp, assinatura eletrônica |
| `/interview/$token` | Entrevista | InterviewPage | — |
| `/kb` | Central de Ajuda — WK Technology CRM | KbHome | — |
| `/kb/$slug` | [CONFIRMAR] | KbArticle | — |
| `/login` | Entrar — WK Technology CRM | LoginPage | — |
| `/lovable/email/auth/preview` | [CONFIRMAR] | — | — |
| `/lovable/email/auth/webhook` | [CONFIRMAR] | — | webhooks |
| `/lovable/email/events` | [CONFIRMAR] | — | webhooks |
| `/lovable/email/transactional/preview` | [CONFIRMAR] | — | — |
| `/lp/$slug` | [CONFIRMAR] | PublicLandingPage | — |
| `/mcp` | [CONFIRMAR] | — | — |
| `/meet/$token` | Sala de vídeo | PublicMeetPage | e-mail |
| `/offer/$token` | [CONFIRMAR] | OfferPage | assinatura eletrônica |
| `/portal/$token` | [CONFIRMAR] | PortalPage | criar |
| `/privacy` | Política de Privacidade — WK Technology CRM | PrivacyPage | e-mail |
| `/proposal/$token` | Proposta comercial — WK Technology | PublicProposalPage | — |
| `/quote/$token` | [CONFIRMAR] | PublicQuotePage | IA/agente, assinatura eletrônica |
| `/refer/$slug` | Indicar talento — TechHire | ReferPublicPage | e-mail |
| `/refund` | Política de Reembolso e Cancelamento — WK Technology CRM | RefundPage | assinatura eletrônica |
| `/reset-password` | Recuperar senha — WK Technology CRM | ResetPasswordPage | criar |
| `/role-profile/$token` | Perfil de vaga — validação do cliente | ClientRoleProfilePage | — |
| `/sales` | WK Technology CRM — Vendas, atendimento e cobrança em um só lugar | SalesPage | criar, automação/workflow, WhatsApp, assinatura eletrônica |
| `/schedule/$token` | Agendar entrevista | SchedulePage | — |
| `/sign/$token` | [CONFIRMAR] | SignPage | assinatura eletrônica |
| `/signup` | Acesso por convite — WK Technology CRM | SignupClosedPage | — |
| `/sitemap.xml` | [CONFIRMAR] | — | — |
| `/survey/$token` | [CONFIRMAR] | SurveyPage | — |
| `/terms` | Termos de Serviço — WK Technology CRM | TermsPage | WhatsApp, e-mail, assinatura eletrônica |
| `/unipile-connected` | [CONFIRMAR] | UnipileConnectedPage | WhatsApp |
| `/unsubscribe` | [CONFIRMAR] | UnsubscribePage | — |
| `/verify/$hash` | Verificação de documento | VerifyPage | — |
| `/widget/$workspaceId` | [CONFIRMAR] | WidgetPage | — |

## 5. Lacunas

### 5.1 Telas autenticadas sem item próprio no menu (acesso só por link/URL)

91 telas não são item de menu; 79 são subtelas (detalhe/edição) de um item, aceitáveis. As 12 abaixo **não têm nenhum item de menu ancestral** (rotas órfãs ou acessadas por botões internos):

- `/` — `src/routes/_authenticated.tsx`
- `/agents/prototype` — `src/routes/_authenticated/agents.prototype.index.tsx`
- `/agents/prototype` — `src/routes/_authenticated/agents.prototype.tsx`
- `/agents/prototype/1` — `src/routes/_authenticated/agents.prototype.1.tsx`
- `/agents/prototype/2` — `src/routes/_authenticated/agents.prototype.2.tsx`
- `/agents/prototype/3` — `src/routes/_authenticated/agents.prototype.3.tsx`
- `/auth/extension-link` — `src/routes/_authenticated/auth/extension-link.tsx`
- `/onboarding/$entity` — `src/routes/_authenticated/onboarding.$entity.tsx`
- `/qa/test-cases` — `src/routes/_authenticated/qa.test-cases.tsx`
- `/sourcing` — `src/routes/_authenticated/(ats)/sourcing/index.tsx`
- `/survey-builder/$id` — `src/routes/_authenticated/survey-builder.$id.tsx`
- `/workspace/modules` — `src/routes/_authenticated/workspace.modules.tsx`

### 5.2 Redirecionamentos e layouts (não são telas; não terão artigo próprio)

- `/` — redireciona (`src/routes/index.tsx`)
- `/admin/alerts` — redireciona (`src/routes/_authenticated/admin.alerts.tsx`)
- `/admin/quotas` — redireciona (`src/routes/_authenticated/admin.quotas.tsx`)
- `/admin/sandbox` — redireciona (`src/routes/_authenticated/admin.sandbox.tsx`)
- `/admin/security-scans` — redireciona (`src/routes/_authenticated/admin.security-scans.tsx`)
- `/admin/status` — redireciona (`src/routes/_authenticated/admin.status.tsx`)
- `/ats` — redireciona (`src/routes/_authenticated/ats.index.tsx`)
- `/ats/candidates` — redireciona (`src/routes/_authenticated/ats.candidates.tsx`)
- `/ats/jobs` — redireciona (`src/routes/_authenticated/ats.jobs.tsx`)
- `/ats/jobs/$id` — redireciona (`src/routes/_authenticated/ats.jobs.$id.tsx`)
- `/catalog/job-profiles` — redireciona (`src/routes/_authenticated/catalog.job-profiles.tsx`)
- `/home/access` — redireciona (`src/routes/_authenticated/home.access.tsx`)
- `/integrations` — redireciona (`src/routes/_authenticated/integrations.index.tsx`)
- `/integrations` — layout (`src/routes/_authenticated/integrations.tsx`)
- `/integrations/$slug` — redireciona (`src/routes/_authenticated/integrations.$slug.tsx`)
- `/integrations/contaazul` — redireciona (`src/routes/_authenticated/integrations.contaazul.tsx`)
- `/leads/import-hubspot` — redireciona (`src/routes/_authenticated/leads.import-hubspot.tsx`)
- `/marketplace` — redireciona (`src/routes/_authenticated/marketplace.index.tsx`)
- `/marketplace` — layout (`src/routes/_authenticated/marketplace.tsx`)
- `/marketplace/$slug` — redireciona (`src/routes/_authenticated/marketplace.$slug.tsx`)
- `/my-bug-reports` — redireciona (`src/routes/_authenticated/my-bug-reports.tsx`)
- `/projects/settings` — redireciona (`src/routes/_authenticated/projects.settings.index.tsx`)
- `/proposals` — layout (`src/routes/_authenticated/proposals.tsx`)
- `/prospecting` — layout (`src/routes/_authenticated/prospecting.tsx`)
- `/settings/hubspot-sync` — redireciona (`src/routes/_authenticated/settings.hubspot-sync.tsx`)
- `/settings/prospecting` — redireciona (`src/routes/_authenticated/settings.prospecting.tsx`)
- `/settings/prospecting-scripts` — redireciona (`src/routes/_authenticated/settings.prospecting-scripts.tsx`)
- `/settings/roles` — redireciona (`src/routes/_authenticated/settings.roles.index.tsx`)
- `/settings/roles` — layout (`src/routes/_authenticated/settings.roles.tsx`)
- `/settings/roles/$roleId` — redireciona (`src/routes/_authenticated/settings.roles.$roleId.tsx`)
- `/settings/roles/matrix` — redireciona (`src/routes/_authenticated/settings.roles.matrix.tsx`)
- `/wa/$slug` — redireciona (`src/routes/wa.$slug.tsx`)
- `/workspace` — redireciona (`src/routes/_authenticated/workspace.index.tsx`)

### 5.3 Recursos atrás de flag

- Nenhuma chave de liberação (`useFeatureFlag`/`FEATURE_*`) encontrada nos arquivos de rota. Liberação é feita por **licença de módulo** (`workspace_modules`) e por permissões.
- Protótipos: `/prospecting/prototype` e protótipos de agentes usam dados demonstrativos (sem leitura/escrita real). Não devem ter artigo operacional; marcar como fora do escopo da Ajuda. [CONFIRMAR]

### 5.4 Lacunas que afetam as próximas fases

- **`tests/access-audit/` não existe.** A Fase 1 pede teste "no mesmo estilo" e o critério executa `tests/access-audit/access-audit.sql`. Decisão necessária: criar essa auditoria SQL na Fase 1 ou usar o `bun run permissions:check` existente.
- **`is_platform_admin`** existe nas migrations (27 arquivos citam). Não existe papel "editor de ajuda"; o mais próximo é o recurso `system.kb.articles` (base de conhecimento pública do atendimento). [CONFIRMAR] se pode ser reutilizado para editar a Ajuda.
- **Catálogo de permissões vazio neste rascunho:** os 270 recursos foram lidos do app publicado. A cobertura da Fase 1 precisará de dados de exemplo deste catálogo para testar "usuário sem acesso não vê".
- Títulos marcados [CONFIRMAR] vêm de rotas sem `head()` com título próprio.

## 6. Resumo

| Módulo | Nº de telas | Nº de funcionalidades detectadas |
|---|---|---|
| TechSales (crm) | 58 | 127 |
| TechHire (ats) | 33 | 66 |
| TechPeople (people) | 15 | 18 |
| TechContracts (contracts) | 11 | 23 |
| TechProjects (projects) | 22 | 13 |
| TechFinance (finance) | 19 | 29 |
| Core ERP / Configurações (compartilhado) | 84 | 138 |
| Administração da plataforma | 9 | 11 |
| Telas públicas (token/slug) | 38 | 26 |
| **Total** | **289** | **451** |

Além disso: 33 redirecionamentos/layouts e as rotas técnicas `src/routes/api/**` (webhooks, cron, API pública, SCIM), sem artigo de tela.

> "Funcionalidades detectadas" conta sinais por tela (criar, editar, filtros, importar…). O número real de artigos *howto* sai da Fase 2, após abrir os componentes.

## Próximo passo

Aguardando aprovação para a **Fase 1** (tabelas `help_articles`/`help_feedback`, rota `/ajuda`, botão "?", guia `help-center.md` e teste de cobertura).