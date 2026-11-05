# Auditoria Fase 2 — TechProjects

## Escopo e resultado
Auditoria estática somente leitura. Nenhum arquivo do projeto foi alterado; nenhuma base de dados, serviço externo, credencial ou dado de produção foi acessado. O catálogo local foi utilizado somente como lista de nomes de permissões.

Rotas atuais: **23** entradas, sendo **22 telas renderizadas e 1 redirecionamento**. O inventário anterior apresenta 22 entradas; o inventário atualizado abaixo inclui a rota de redirecionamento de configurações. Artigos propostos: **35**. Cada rota tem exatamente um artigo principal com route_pattern; artigos transversais não competem pelo botão de ajuda.

## Inventário proposto para docs/help/inventario.md
Substituição proposta, não aplicada: atualizar a linha resumida de projects para rota inicial `/projects/dashboard`, 22 telas + 1 redirecionamento; substituir a seção TechProjects pela tabela abaixo. Nenhuma outra seção deve ser alterada.

| Rota atual | Tela / operação | Menu e acesso declarado | Componentes principais | Funções diretamente usadas | Artigo |
|---|---|---|---|---|---|
| `/projects/$id` | Operar a ficha do projeto | ↳ subtela; sem item próprio | `src/components/projects/task-details-sheet.tsx`, `src/components/projects/project-origin-card.tsx` | `addChecklistItem`, `addDependency`, `addMember`, `completeMilestone`, `createMilestone`, `createTask`, `deleteMilestone`, `deleteTask`, `deleteTimeEntry`, `getProfitability`, `getProject`, `getProjectDeliveryOrigin`, `getProjectFinancials`, `getTimeActionCapabilities`, `listAllProjectTasks`, `listChecklist`, `listDependencies`, `listMembers`, `listMilestones`, `listTaskFieldReferences`, `listTasks`, `listTimeEntries`, `listWorkspaceTaskTags`, `logTime`, `removeChecklistItem`, `removeDependency`, `removeMember`, `setProjectOperationalOwner`, `toggleChecklistItem`, `updateProject`, `updateTask`, `updateTaskCustomFieldValues`, `updateTaskTags` | `operar-ficha-projeto` |
| `/projects/dashboard` | Consultar o Dashboard de projetos | ✔ Dashboard; need=sem need; techprojects.projects.view.own, techprojects.projects.view.team, techprojects.projects.view.workspace, techprojects.tasks.view.own, techprojects.tasks.view.team, techprojects.tasks.view.workspace | `src/components/projects/dashboard/overview-view.tsx`, `src/components/projects/dashboard/dash-filters.tsx`, `src/components/projects/dashboard/work-views.tsx`, `src/components/projects/dashboard/business-views.tsx`, `src/components/projects/dashboard/alerts-overview.tsx`, `src/components/projects/dashboard/drill-sheet.tsx`, `src/components/projects/dashboard/alert-act-dialog.tsx`, `src/components/projects/dashboard/risk-rules-dialog.tsx`, `src/components/projects/dashboard/assistant-sheet.tsx`, `src/components/projects/dashboard/dash-view-parts.tsx` | `askProjectsAssistant`, `getProjectDashboard` | `operar-dashboard` |
| `/projects/hours-review` | Revisar e decidir horas | ✔ Revisão de Horas; need=manager; techprojects.time_entries.approve.workspace, techprojects.timesheet.approve.workspace, techprojects.time_entries.view.own | `src/components/projects/hours-review-panel.tsx` | `decidePendingItems`, `getTimesheetOverview`, `listPendingApprovals` | `operar-hours-review` |
| `/projects` | Consultar e criar projetos | ✔ Projetos; need=manager; techprojects.projects.view.own, techprojects.projects.view.team, techprojects.projects.view.workspace | `src/components/projects/quick-create-project-dialog.tsx` | `createProject`, `listProjectIds`, `listProjects` | `consultar-projetos` |
| `/projects/lists/$id` | Trabalhar em uma lista | ↳ subtela; sem item próprio | `src/components/projects/task-details-sheet.tsx`, `src/components/projects/list-views.tsx`, `src/components/projects/custom-fields-manager.tsx`, `src/components/projects/list-templates-dialog.tsx` | `addChecklistItem`, `addDependency`, `createCustomField`, `createListFromTemplate`, `createListTask`, `createStatus`, `deleteCustomField`, `deleteListTask`, `deleteStatus`, `deleteTemplate`, `getList`, `listAllProjectTasks`, `listChecklist`, `listCustomFields`, `listDependencies`, `listTaskFieldReferences`, `listTemplates`, `listWorkspaceTaskTags`, `moveTaskStatus`, `removeChecklistItem`, `removeDependency`, `saveListAsTemplate`, `toggleChecklistItem`, `updateTaskCustomFieldValues`, `updateTaskTags` | `trabalhar-lista` |
| `/projects/my-hours` | Registrar e acompanhar minhas horas | ✔ Minhas Horas; need=sem need; techprojects.time_entries.view.own, techprojects.time_entries.view.workspace | `src/components/projects/my-hours-day.tsx`, `src/components/projects/my-hours-week.tsx`, `src/components/projects/my-hours-calendar.tsx`, `src/components/projects/quick-time-entry-dialog.tsx`, `src/components/projects/offline-time-queue-panel.tsx` | `duplicateTimeEntry`, `getMyMonthCalendar`, `getMyTimeSummary`, `listTimeEntries`, `listTrackableProjects`, `listTrackableTasks`, `removeTimeEntry`, `saveTimeEntry`, `toggleFavoriteProject` | `operar-my-hours` |
| `/projects/my-work` | Organizar o My Work | ✔ My Work; need=sem need; techprojects.my_work.view.own, techprojects.my_work.view.team, techprojects.my_work.view.workspace | `src/routes/_authenticated/projects.my-work.tsx` (componente local) | `getRunningTimer`, `listAllProjectTasks`, `listTimesheet` | `operar-my-work` |
| `/projects/settings/delivery` | Configurar a entrega de negócios ganhos | ✔ Entrega de negócios; need=admin; sem permissionAny | `src/components/projects/delivery-policy/delivery-policy-page.tsx` | `getDeliveryPolicy`, `saveDeliveryPolicy` | `operar-delivery` |
| `/projects/settings/imports/clickup` | Importar organização e tarefas do ClickUp | ✔ Importar do ClickUp; need=admin; sem permissionAny | `src/components/projects/clickup-import/clickup-import-page.tsx` | `createClickUpHistoricalPerson`, `getClickUpImportStatus`, `getClickUpImportTargets`, `runClickUpImportStep`, `setClickUpGroup`, `setClickUpPerson`, `startClickUpCollect`, `stepClickUpCollect` | `operar-imports-clickup` |
| `/projects/settings/imports/clockify` | Importar do Clockify | ✔ Importar do Clockify; need=admin; sem permissionAny | `src/components/projects/clockify-import/clockify-import-page.tsx` | `advanceClockifyImportRun`, `clockifyImportTargetOptions`, `confirmClockifyImportPreview`, `createClockifyImportIdentitiesBulk`, `createClockifyImportIdentity`, `getClockifyImportRun`, `getClockifyImportStatus`, `listClockifyImportMappings`, `listClockifyImportStaging`, `removeClockifyImportConnection`, `reopenClockifyImportEntries`, `saveClockifyImportConnection`, `selectClockifyImportSource`, `setClockifyImportMapping`, `setClockifyImportRunState`, `startClockifyImportRun`, `testClockifyImportConnection` | `operar-imports-clockify` |
| `/projects/settings/imports` | Escolher uma fonte de importação | ↳ subtela; sem item próprio | `src/components/projects/clockify-import/projects-imports-hub.tsx` | composição/encaminhamento; ver dependências abaixo | `operar-imports` |
| `/projects/settings/imports/jibble` | Importar do Jibble | ✔ Importar do Jibble; need=admin; sem permissionAny | `src/components/projects/jibble-import/jibble-import-page.tsx` | `advanceJibbleImportRun`, `confirmJibbleImportPreview`, `confirmJibbleImportSource`, `decideJibbleImportDuplicate`, `getJibbleImportStatus`, `jibbleImportTargetOptions`, `listJibbleImportDuplicates`, `listJibbleImportMappings`, `listJibbleImportStaging`, `removeJibbleImportConnection`, `saveJibbleImportConnection`, `setJibbleImportMapping`, `setJibbleImportRunState`, `startJibbleImportRun`, `testJibbleImportConnection` | `operar-imports-jibble` |
| `/projects/settings/imports/reconciliation` | Conciliar horas e vínculos importados | ✔ Conciliação de horas; need=admin; sem permissionAny | `src/components/projects/reconciliation/reconciliation-page.tsx` | composição/encaminhamento; ver dependências abaixo | `operar-imports-reconciliation` |
| `/projects/settings` | Abrir configurações do TechProjects | redirecionamento ao hub | `src/routes/_authenticated/projects.settings.index.tsx` (componente local) | composição/encaminhamento; ver dependências abaixo | `abrir-configuracoes` |
| `/projects/settings/operations` | Consultar operação e saúde do TechProjects | ✔ Operação e saúde; need=admin; sem permissionAny | `src/components/projects/ops/projects-ops-page.tsx` | `getProjectsOps` | `operar-operations` |
| `/projects/settings/rates` | Cadastrar e encerrar tarifas com vigência | ✔ Tarifas e custos; need=admin; techprojects.rates.view.workspace | `src/components/projects/billing/rates-panel.tsx` | `createRate`, `endRate`, `listLegacyRateCandidates`, `listRateTargets`, `listRates`, `previewRateImpact`, `splitRate` | `operar-rates` |
| `/projects/settings/time` | Configurar política de horas e modelos | ✔ Política de horas e modelos; need=admin; techprojects.time_policy.view.workspace, techprojects.delivery_templates.view.workspace | `src/components/projects/time-governance/time-policy-card.tsx`, `src/components/projects/time-governance/delivery-templates-card.tsx` | `getTimePolicy`, `listDeliveryTemplates`, `saveDeliveryTemplate`, `saveTimePolicy` | `operar-time` |
| `/projects/spaces` | Organizar espaços, pastas e listas | ✔ Espaços; need=manager; techprojects.spaces.view.team, techprojects.spaces.view.workspace | `src/components/projects/list-templates-dialog.tsx` | `createFolder`, `createList`, `createListFromTemplate`, `createSpace`, `deleteFolder`, `deleteList`, `deleteSpace`, `deleteTemplate`, `listSpaceTree`, `listTemplates`, `saveListAsTemplate` | `operar-spaces` |
| `/projects/tasks` | Consultar tarefas de projetos | ✔ Tarefas; need=sem need; techprojects.tasks.view.own, techprojects.tasks.view.team, techprojects.tasks.view.workspace | `src/components/projects/task-details-sheet.tsx`, `src/components/projects/task-core-fields.tsx` | `addChecklistItem`, `addDependency`, `listAllProjectTaskIds`, `listAllProjectTasks`, `listChecklist`, `listDependencies`, `listTaskFieldReferences`, `listWorkspaceTaskTags`, `removeChecklistItem`, `removeDependency`, `toggleChecklistItem`, `updateTask`, `updateTaskCustomFieldValues`, `updateTaskTags` | `operar-tasks` |
| `/projects/timesheet` | Consultar o timesheet da equipe | ✔ Timesheet; need=manager; techprojects.timesheet.view.team, techprojects.timesheet.view.workspace | `src/components/projects/quick-time-entry-dialog.tsx`, `src/components/projects/submit-period-dialog.tsx`, `src/components/projects/copy-week-dialog.tsx` | `getTimesheetOverview`, `listTimesheet`, `listTrackableProjects`, `listTrackableTasks`, `previewSubmission`, `saveTimeEntry`, `submitPeriod`, `toggleFavoriteProject` | `operar-timesheet` |
| `/projects/$id/entrega` | Publicar acompanhamento de entrega | ↳ subtela; sem item próprio | `src/components/projects/delivery-timeline.tsx`, `src/components/projects/project-update-dialog.tsx` | `createProjectUpdate`, `deleteProjectUpdate`, `getProjectDelivery`, `updateProjectUpdate` | `operar-projeto-entrega` |
| `/projects/$id/financeiro` | Consultar medições e rentabilidade do projeto | ↳ subtela; sem item próprio | `src/components/projects/billing/measurements-panel.tsx`, `src/components/projects/billing/profitability-panel.tsx` | `buildMeasurement`, `exportProfitability`, `getProfitability`, `listBillingConfigs`, `listMeasurements` | `operar-projeto-financeiro` |
| `/projects/$id/horas` | Administrar horas e aprovação do projeto | ↳ subtela; sem item próprio | `src/components/projects/time-governance/project-approvers-card.tsx`, `src/components/projects/time-governance/project-acceptance-card.tsx`, `src/components/projects/time-governance/project-closing-card.tsx`, `src/components/projects/time-governance/project-template-card.tsx` | `applyDeliveryTemplate`, `closePeriod`, `getProjectTemplateSuggestion`, `listClientAcceptances`, `listPeriodClosings`, `listProjectApprovers`, `previewPeriodClose`, `recordClientAcceptance`, `reopenPeriod`, `revokeProjectApprover`, `setClientAcceptanceRequired`, `setProjectApprover`, `voidClientAcceptance` | `operar-projeto-horas` |

## Evidências técnicas por rota
A relação abaixo registra caminhos e símbolos detectados nas rotas e componentes diretamente compostos. É um inventário de código, não certificação de execução nem autorização. Bibliotecas compartilhadas podem expor funções adicionais não usadas nesta tela.

### `/projects/$id`
- Arquivo: `src/routes/_authenticated/projects.$id.tsx`.
- Recursos literais na rota: `techprojects.costs.manage.workspace`, `techprojects.members`, `techprojects.members.manage.workspace`, `techprojects.milestone_billing.create.workspace`, `techprojects.milestones`, `techprojects.profitability.view.workspace`, `techprojects.projects`, `techprojects.rates.manage.workspace`, `techprojects.rates.view.workspace`, `techprojects.tasks`, `techprojects.tasks.create.own`, `techprojects.tasks.create.team`, `techprojects.tasks.create.workspace`.
- Fontes: `src/routes/_authenticated/projects.$id.tsx`, `src/components/work-action.tsx`, `src/lib/access-control/use-permissions.tsx`, `src/components/work-access.tsx`, `src/lib/access-control/use-work-capabilities.ts`, `src/components/page-header.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/progress.tsx`, `src/components/ui/select.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/table.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/skeleton.tsx`, `src/components/projects/task-details-sheet.tsx`, `src/lib/projects.functions.ts`, `src/lib/crm.ts`, `src/lib/projects/billing.functions.ts`, `src/lib/projects/billing.shared.ts`, `src/hooks/use-workspace-members.ts`, `src/components/ui/confirm-dialog.tsx`, `src/components/projects/project-origin-card.tsx`, `src/components/iso-date-picker.tsx`, `src/lib/iso-date.ts`, `src/lib/project-tasks-advanced.functions.ts`, `src/lib/project-list-extras.functions.ts`, `src/lib/projects/deal-delivery.functions.ts`, `src/lib/projects/deal-delivery-labels.ts`.

### `/projects/dashboard`
- Arquivo: `src/routes/_authenticated/projects.dashboard.tsx`.
- Recursos literais na rota: `techprojects.projects`, `techprojects.tasks`.
- Fontes: `src/routes/_authenticated/projects.dashboard.tsx`, `src/components/work-access.tsx`, `src/components/ui/button.tsx`, `src/components/ui/tabs.tsx`, `src/components/techhire/ui/index.ts`, `src/components/dashboard/dashboard-error.tsx`, `src/components/iso-date-range-picker.tsx`, `src/lib/projects/dashboard.functions.ts`, `src/components/projects/dashboard/overview-view.tsx`, `src/components/projects/dashboard/dash-filters.tsx`, `src/components/projects/dashboard/work-views.tsx`, `src/components/projects/dashboard/business-views.tsx`, `src/components/projects/dashboard/alerts-overview.tsx`, `src/components/projects/dashboard/drill-sheet.tsx`, `src/components/projects/dashboard/alert-act-dialog.tsx`, `src/components/projects/dashboard/risk-rules-dialog.tsx`, `src/components/projects/dashboard/assistant-sheet.tsx`, `src/components/projects/dashboard/dash-view-parts.tsx`, `src/hooks/use-project-dashboard-views.ts`, `src/lib/projects/dashboard-views.shared.ts`, `src/lib/projects/reconciliation-labels.ts`, `src/lib/projects/dashboard.types.ts`, `src/lib/projects/delivery-labels.ts`, `src/lib/utils.ts`, `src/lib/projects/dashboard-views.types.ts`, `src/lib/projects/assistant.functions.ts`, `src/lib/limits.ts`.

### `/projects/hours-review`
- Arquivo: `src/routes/_authenticated/projects.hours-review.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects.hours-review.tsx`, `src/components/page-header.tsx`, `src/components/iso-date-range-picker.tsx`, `src/components/projects/hours-review-panel.tsx`, `src/lib/projects/time-workflow.functions.ts`, `src/lib/projects/time-entry.shared.ts`, `src/lib/projects/time-workflow.types.ts`.

### `/projects`
- Arquivo: `src/routes/_authenticated/projects.index.tsx`.
- Recursos literais na rota: `techprojects.projects`, `techprojects.projects.create.own`, `techprojects.projects.create.workspace`, `techprojects.projects.delete.own`, `techprojects.projects.delete.workspace`, `techprojects.projects.update.own`, `techprojects.projects.update.team`, `techprojects.projects.update.workspace`.
- Fontes: `src/routes/_authenticated/projects.index.tsx`, `src/lib/access-control/use-work-capabilities.ts`, `src/components/work-access.tsx`, `src/hooks/use-grid-filters.ts`, `src/lib/grid-filters.ts`, `src/components/grid/grid-list-shell.tsx`, `src/components/grid/grid-list-toolbar.tsx`, `src/components/grid/sortable-table-head.tsx`, `src/lib/grid-client-sort.ts`, `src/components/page-header.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/select.tsx`, `src/components/ui/table.tsx`, `src/lib/projects.functions.ts`, `src/lib/crm.ts`, `src/lib/format/compact-date.ts`, `src/components/projects/quick-create-project-dialog.tsx`, `src/components/entity/assignee-filter.tsx`, `src/components/entity/assignee-cell.tsx`, `src/components/ui/checkbox.tsx`, `src/components/grid/use-grid-selection.ts`, `src/hooks/use-current-user-id.ts`, `src/components/grid/grid-bulk-bar.tsx`, `src/lib/access-control/use-permissions.tsx`, `src/components/kanban/kanban-board.tsx`, `src/components/kanban/view-mode-toggle.tsx`.

### `/projects/lists/$id`
- Arquivo: `src/routes/_authenticated/projects.lists.$id.tsx`.
- Recursos literais na rota: `techprojects.custom_fields`, `techprojects.list_templates`, `techprojects.lists`, `techprojects.statuses`, `techprojects.tasks`.
- Fontes: `src/routes/_authenticated/projects.lists.$id.tsx`, `src/components/work-action.tsx`, `src/components/hr-access.tsx`, `src/components/page-header.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/lib/crm.ts`, `src/lib/project-hierarchy.functions.ts`, `src/components/projects/task-details-sheet.tsx`, `src/components/projects/list-views.tsx`, `src/components/projects/custom-fields-manager.tsx`, `src/components/projects/list-templates-dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/lib/project-tasks-advanced.functions.ts`, `src/lib/projects.functions.ts`, `src/lib/project-list-extras.functions.ts`.

### `/projects/my-hours`
- Arquivo: `src/routes/_authenticated/projects.my-hours.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects.my-hours.tsx`, `src/components/page-header.tsx`, `src/components/ui/button.tsx`, `src/components/ui/tabs.tsx`, `src/components/techhire/ui/index.ts`, `src/lib/projects/time-metrics.functions.ts`, `src/components/projects/my-hours-day.tsx`, `src/components/projects/my-hours-week.tsx`, `src/components/projects/my-hours-calendar.tsx`, `src/components/projects/quick-time-entry-dialog.tsx`, `src/components/projects/offline-time-queue-panel.tsx`, `src/lib/projects/time-tracking.functions.ts`, `src/lib/projects/time-entry.shared.ts`, `src/lib/projects/time-workflow.functions.ts`, `src/lib/projects/offline-queue.ts`, `src/lib/limits.ts`.

### `/projects/my-work`
- Arquivo: `src/routes/_authenticated/projects.my-work.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects.my-work.tsx`, `src/components/page-header.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`, `src/components/ui/skeleton.tsx`, `src/lib/projects.functions.ts`, `src/lib/project-timer.functions.ts`, `src/lib/projects/time-entry.shared.ts`.

### `/projects/settings/delivery`
- Arquivo: `src/routes/_authenticated/projects.settings.delivery.tsx`.
- Recursos literais na rota: `techprojects.delivery`.
- Fontes: `src/routes/_authenticated/projects.settings.delivery.tsx`, `src/components/hr-access.tsx`, `src/components/projects/delivery-policy/delivery-policy-page.tsx`, `src/lib/projects/deal-delivery.functions.ts`, `src/lib/crm.ts`.

### `/projects/settings/imports/clickup`
- Arquivo: `src/routes/_authenticated/projects.settings.imports.clickup.tsx`.
- Recursos literais na rota: `techprojects.clickup_import`.
- Fontes: `src/routes/_authenticated/projects.settings.imports.clickup.tsx`, `src/components/hr-access.tsx`, `src/components/projects/clickup-import/clickup-import-page.tsx`, `src/lib/utils.ts`, `src/lib/integrations/clickup/clickup-import.functions.ts`.

### `/projects/settings/imports/clockify`
- Arquivo: `src/routes/_authenticated/projects.settings.imports.clockify.tsx`.
- Recursos literais na rota: `techprojects.clockify_import`.
- Fontes: `src/routes/_authenticated/projects.settings.imports.clockify.tsx`, `src/components/hr-access.tsx`, `src/components/projects/clockify-import/clockify-import-page.tsx`, `src/lib/integrations/clockify/clockify.functions.ts`, `src/lib/integrations/clockify/clockify-format.ts`, `src/lib/integrations/clockify/clockify-access.ts`.

### `/projects/settings/imports`
- Arquivo: `src/routes/_authenticated/projects.settings.imports.index.tsx`.
- Recursos literais na rota: `techprojects.clickup_import`, `techprojects.clockify_import`, `techprojects.jibble_import`, `techprojects.reconciliation`.
- Fontes: `src/routes/_authenticated/projects.settings.imports.index.tsx`, `src/components/hr-access.tsx`, `src/components/projects/clockify-import/projects-imports-hub.tsx`.

### `/projects/settings/imports/jibble`
- Arquivo: `src/routes/_authenticated/projects.settings.imports.jibble.tsx`.
- Recursos literais na rota: `techprojects.jibble_import`.
- Fontes: `src/routes/_authenticated/projects.settings.imports.jibble.tsx`, `src/components/hr-access.tsx`, `src/components/projects/jibble-import/jibble-import-page.tsx`, `src/lib/integrations/jibble/jibble.functions.ts`, `src/lib/integrations/jibble/jibble-format.ts`, `src/lib/integrations/jibble/jibble-map.ts`.

### `/projects/settings/imports/reconciliation`
- Arquivo: `src/routes/_authenticated/projects.settings.imports.reconciliation.tsx`.
- Recursos literais na rota: `techprojects.reconciliation`.
- Fontes: `src/routes/_authenticated/projects.settings.imports.reconciliation.tsx`, `src/components/hr-access.tsx`, `src/components/projects/reconciliation/reconciliation-page.tsx`.

### `/projects/settings`
- Arquivo: `src/routes/_authenticated/projects.settings.index.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects.settings.index.tsx`.

### `/projects/settings/operations`
- Arquivo: `src/routes/_authenticated/projects.settings.operations.tsx`.
- Recursos literais na rota: `techprojects.operations`.
- Fontes: `src/routes/_authenticated/projects.settings.operations.tsx`, `src/components/hr-access.tsx`, `src/components/projects/ops/projects-ops-page.tsx`, `src/lib/projects/ops.functions.ts`, `src/lib/projects/ops.types.ts`.

### `/projects/settings/rates`
- Arquivo: `src/routes/_authenticated/projects.settings.rates.tsx`.
- Recursos literais na rota: `techprojects.rates`.
- Fontes: `src/routes/_authenticated/projects.settings.rates.tsx`, `src/components/hr-access.tsx`, `src/components/page-header.tsx`, `src/components/projects/billing/rates-panel.tsx`, `src/lib/projects/billing-rates.functions.ts`, `src/lib/projects/billing.shared.ts`, `src/lib/projects/time-entry.shared.ts`, `src/lib/projects/billing.types.ts`.

### `/projects/settings/time`
- Arquivo: `src/routes/_authenticated/projects.settings.time.tsx`.
- Recursos literais na rota: `techprojects.delivery_templates`, `techprojects.time_policy`.
- Fontes: `src/routes/_authenticated/projects.settings.time.tsx`, `src/components/hr-access.tsx`, `src/components/techhire/ui/index.ts`, `src/components/projects/time-governance/time-policy-card.tsx`, `src/components/projects/time-governance/delivery-templates-card.tsx`, `src/lib/projects/time-governance.functions.ts`, `src/lib/projects/time-workflow.types.ts`, `src/lib/projects/delivery-template.shared.ts`.

### `/projects/spaces`
- Arquivo: `src/routes/_authenticated/projects.spaces.tsx`.
- Recursos literais na rota: `techprojects.folders`, `techprojects.lists`, `techprojects.spaces`.
- Fontes: `src/routes/_authenticated/projects.spaces.tsx`, `src/components/work-action.tsx`, `src/components/hr-access.tsx`, `src/components/page-header.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/lib/project-hierarchy.functions.ts`, `src/components/projects/list-templates-dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/lib/project-list-extras.functions.ts`.

### `/projects/tasks`
- Arquivo: `src/routes/_authenticated/projects.tasks.tsx`.
- Recursos literais na rota: `techprojects.tasks`, `techprojects.tasks.delete.own`, `techprojects.tasks.delete.workspace`, `techprojects.tasks.update.own`, `techprojects.tasks.update.team`, `techprojects.tasks.update.workspace`.
- Fontes: `src/routes/_authenticated/projects.tasks.tsx`, `src/lib/access-control/use-work-capabilities.ts`, `src/components/work-access.tsx`, `src/components/grid/grid-list-toolbar.tsx`, `src/components/grid/grid-list-shell.tsx`, `src/hooks/use-grid-filters.ts`, `src/lib/grid-filters.ts`, `src/components/grid/sortable-table-head.tsx`, `src/lib/grid-client-sort.ts`, `src/components/page-header.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/select.tsx`, `src/components/ui/table.tsx`, `src/lib/crm.ts`, `src/lib/format/compact-date.ts`, `src/lib/projects.functions.ts`, `src/components/grid/use-grid-selection.ts`, `src/components/grid/grid-bulk-bar.tsx`, `src/lib/access-control/use-permissions.tsx`, `src/components/kanban/kanban-board.tsx`, `src/components/projects/task-details-sheet.tsx`, `src/components/projects/task-core-fields.tsx`, `src/components/kanban/view-mode-toggle.tsx`, `src/lib/project-tasks-advanced.functions.ts`, `src/lib/project-list-extras.functions.ts`.

### `/projects/timesheet`
- Arquivo: `src/routes/_authenticated/projects.timesheet.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects.timesheet.tsx`, `src/components/page-header.tsx`, `src/components/grid/grid-list-toolbar.tsx`, `src/components/grid/sortable-table-head.tsx`, `src/lib/grid-client-sort.ts`, `src/components/ui/button.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/table.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/select.tsx`, `src/components/techhire/ui/index.ts`, `src/lib/project-timer.functions.ts`, `src/hooks/use-current-user-id.ts`, `src/lib/projects/time-workflow.functions.ts`, `src/lib/projects/time-entry.shared.ts`, `src/components/projects/quick-time-entry-dialog.tsx`, `src/components/projects/submit-period-dialog.tsx`, `src/components/projects/copy-week-dialog.tsx`, `src/lib/projects/time-tracking.functions.ts`, `src/lib/projects/offline-queue.ts`.

### `/projects/$id/entrega`
- Arquivo: `src/routes/_authenticated/projects_.$id.entrega.tsx`.
- Recursos literais na rota: `techprojects.project_updates`, `techprojects.projects`.
- Fontes: `src/routes/_authenticated/projects_.$id.entrega.tsx`, `src/components/work-access.tsx`, `src/components/hr-access.tsx`, `src/components/page-header.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/progress.tsx`, `src/components/ui/skeleton.tsx`, `src/components/projects/delivery-timeline.tsx`, `src/components/projects/project-update-dialog.tsx`, `src/lib/projects/delivery.functions.ts`, `src/lib/projects/delivery-labels.ts`, `src/lib/access-control/use-permissions.tsx`.

### `/projects/$id/financeiro`
- Arquivo: `src/routes/_authenticated/projects_.$id.financeiro.tsx`.
- Recursos literais na rota: `techprojects.measurements`, `techprojects.profitability`, `techprojects.projects`.
- Fontes: `src/routes/_authenticated/projects_.$id.financeiro.tsx`, `src/components/work-access.tsx`, `src/components/hr-access.tsx`, `src/components/page-header.tsx`, `src/components/ui/button.tsx`, `src/components/projects/billing/measurements-panel.tsx`, `src/components/projects/billing/profitability-panel.tsx`, `src/lib/projects/billing.functions.ts`, `src/lib/projects/billing-rates.functions.ts`, `src/lib/projects/billing.shared.ts`, `src/lib/projects/time-entry.shared.ts`.

### `/projects/$id/horas`
- Arquivo: `src/routes/_authenticated/projects_.$id.horas.tsx`.
- Recursos literais na rota: sem declaração literal; consultar composição e banco.
- Fontes: `src/routes/_authenticated/projects_.$id.horas.tsx`, `src/components/page-header.tsx`, `src/components/ui/button.tsx`, `src/components/projects/time-governance/project-approvers-card.tsx`, `src/components/projects/time-governance/project-acceptance-card.tsx`, `src/components/projects/time-governance/project-closing-card.tsx`, `src/components/projects/time-governance/project-template-card.tsx`, `src/lib/projects/time-governance.functions.ts`, `src/lib/projects/time-entry.shared.ts`, `src/lib/projects/delivery-template.shared.ts`.

## Catálogo de funções e componentes do módulo
Inventário estrutural dos arquivos existentes no módulo. Símbolos exportados são evidência da existência no código, não promessa de que toda função seja acessível pela UI.
- `src/components/projects/billing/billing-config-card.tsx`: `BillingConfigCard`.
- `src/components/projects/billing/measurement-detail-dialog.tsx`: `MeasurementDetailDialog`.
- `src/components/projects/billing/measurements-panel.tsx`: `MeasurementsPanel`.
- `src/components/projects/billing/profitability-panel.tsx`: `ProfitabilityPanel`.
- `src/components/projects/billing/provisions-panel.tsx`: `ProvisionsPanel`.
- `src/components/projects/billing/rates-panel.tsx`: `RatesPanel`.
- `src/components/projects/clickup-import/clickup-import-page.tsx`: `ClickUpImportPage`.
- `src/components/projects/clockify-import/clockify-import-page.tsx`: `ClockifyImportPage`.
- `src/components/projects/clockify-import/clockify-review.tsx`: `MappingRow`, `TargetOption`, `MappingsTable`, `StagingRow`, `StagingTable`.
- `src/components/projects/clockify-import/clockify-sections.tsx`: `ConnectionView`, `SourceWorkspaceView`, `ConnectionSection`, `SourceSection`, `RunView`, `RunProgress`, `PreviewReport`, `ImportReport`.
- `src/components/projects/clockify-import/projects-imports-hub.tsx`: `ProjectsImportsHub`.
- `src/components/projects/copy-week-dialog.tsx`: `CopyWeekDialog`.
- `src/components/projects/custom-fields-manager.tsx`: `CustomFieldsManagerButton`.
- `src/components/projects/dashboard/alert-act-dialog.tsx`: `AlertAction`, `AlertActDialog`.
- `src/components/projects/dashboard/alerts-overview.tsx`: `AlertsOverview`.
- `src/components/projects/dashboard/assistant-sheet.tsx`: `AssistantSheet`.
- `src/components/projects/dashboard/business-views.tsx`: `CommercialView`, `FinanceView`, `QualityView`.
- `src/components/projects/dashboard/coverage-strip.tsx`: `CoverageStrip`.
- `src/components/projects/dashboard/dash-filters.tsx`: `DashFilters`.
- `src/components/projects/dashboard/dash-metric.tsx`: `DashMetric`.
- `src/components/projects/dashboard/dash-view-parts.tsx`: `DrillFn`, `ViewCtx`, `num`, `secs`, `int`, `deltaOf`, `Metric`, `HoursMetric`, `Grid`, `Notice`.
- `src/components/projects/dashboard/drill-columns.tsx`: `DrillColumn`, `DRILL_COLUMNS`, `alertEvidenceText`.
- `src/components/projects/dashboard/drill-sheet.tsx`: `DrillSheet`.
- `src/components/projects/dashboard/overview-view.tsx`: `OverviewView`.
- `src/components/projects/dashboard/risk-rules-dialog.tsx`: `RiskRulesDialog`.
- `src/components/projects/dashboard/work-views.tsx`: `MeView`, `TeamView`.
- `src/components/projects/delivery-policy/delivery-policy-page.tsx`: `DeliveryPolicyPage`.
- `src/components/projects/delivery-timeline.tsx`: `DeliveryTimeline`.
- `src/components/projects/hours-review-panel.tsx`: `HoursReviewPanel`.
- `src/components/projects/jibble-import/jibble-import-page.tsx`: `JibbleImportPage`.
- `src/components/projects/jibble-import/jibble-sections.tsx`: `JbConnectionView`, `JbRunView`, `JbAccessBadge`, `JbConnectionSection`, `JbOrgSection`, `JbRunProgress`, `JbReport`, `JbRunsHistory`, `JbDuplicateRow`, `JbDuplicatesTable`.
- `src/components/projects/linked-projects-card.tsx`: `LinkedProjectsCard`.
- `src/components/projects/list-templates-dialog.tsx`: `SaveAsTemplateButton`, `CreateListFromTemplateButton`.
- `src/components/projects/list-views.tsx`: `CalendarView`, `TimelineView`, `WorkloadView`.
- `src/components/projects/my-hours-calendar.tsx`: `MyHoursCalendar`.
- `src/components/projects/my-hours-day.tsx`: `MyHoursDay`.
- `src/components/projects/my-hours-week.tsx`: `WeekDay`, `MyHoursWeek`.
- `src/components/projects/offline-time-queue-panel.tsx`: `OfflineTimeQueuePanel`.
- `src/components/projects/ops/projects-ops-page.tsx`: `ProjectsOpsPage`.
- `src/components/projects/project-origin-card.tsx`: `ProjectOriginCard`.
- `src/components/projects/project-update-dialog.tsx`: `ProjectUpdateDialog`.
- `src/components/projects/quick-create-project-dialog.tsx`: `QuickCreateProjectDialog`.
- `src/components/projects/quick-time-entry-dialog.tsx`: `TimeEntryDraft`, `QuickTimeEntryDialog`.
- `src/components/projects/reconciliation/note-dialog.tsx`: `NoteDialog`.
- `src/components/projects/reconciliation/pager.tsx`: `Pager`.
- `src/components/projects/reconciliation/recon-breakdown-tab.tsx`: `ReconBreakdownTab`.
- `src/components/projects/reconciliation/recon-deals-dialogs.tsx`: `PreviewDialog`, `PickProjectDialog`.
- `src/components/projects/reconciliation/recon-deals-row.tsx`: `Pair`, `DealHistoryRow`.
- `src/components/projects/reconciliation/recon-deals-tab.tsx`: `ReconDealsTab`.
- `src/components/projects/reconciliation/recon-issues-format.ts`: `PAGE`, `StatusFilter`, `STATUS_FILTER_LABEL`, `tone`, `ACTION_LABEL`, `detailText`, `downloadCsv`.
- `src/components/projects/reconciliation/recon-issues-tab.tsx`: `ReconIssuesTab`.
- `src/components/projects/reconciliation/recon-jibble-hours-tab.tsx`: `ReconJibbleHoursTab`.
- `src/components/projects/reconciliation/recon-links-labels.ts`: `CRITERION_LABEL`, `BATCH_LABEL`, `COUNT_LABEL`, `MEMBER_LABEL`.
- `src/components/projects/reconciliation/recon-links-tab.tsx`: `ReconLinksTab`.
- `src/components/projects/reconciliation/recon-overview-tab.tsx`: `ReconOverviewTab`.
- `src/components/projects/reconciliation/recon-review-tab.tsx`: `ReconReviewTab`.
- `src/components/projects/reconciliation/reconciliation-page.tsx`: `ReconSearch`, `ReconciliationPage`.
- `src/components/projects/submit-period-dialog.tsx`: `SubmitPeriodDialog`.
- `src/components/projects/task-core-fields.tsx`: `TASK_STATUS_LABEL`, `TASK_PRIORITY_LABEL`, `TaskCoreValues`, `TASK_QUERY_KEYS`, `TaskCoreFields`.
- `src/components/projects/task-details-sheet.tsx`: `TaskDetailsSheet`.
- `src/components/projects/time-governance/delivery-templates-card.tsx`: `DeliveryTemplatesCard`.
- `src/components/projects/time-governance/project-acceptance-card.tsx`: `ProjectAcceptanceCard`.
- `src/components/projects/time-governance/project-approvers-card.tsx`: `ProjectApproversCard`.
- `src/components/projects/time-governance/project-closing-card.tsx`: `ProjectClosingCard`.
- `src/components/projects/time-governance/project-template-card.tsx`: `ProjectTemplateCard`.
- `src/components/projects/time-governance/time-policy-card.tsx`: `TimePolicyCard`.
- `src/lib/projects/assistant.core.ts`: `Citation`, `ToolResult`, `ToolCall`, `ModelMessage`, `ModelReply`, `CallModel`, `RunTool`, `ASSISTANT_TOOL_NAMES`, `AssistantToolName`, `METRIC_KEYS`, `assistantTools`, `systemPrompt`, `ToolArgs`, `validateToolArgs`, `sanitizeForModel`, `AssistantAnswer`, `runAssistant`.
- `src/lib/projects/assistant.functions.ts`: `askProjectsAssistant`.
- `src/lib/projects/assistant.server.ts`: `makeToolRunner`, `aiModelCaller`, `assertAssistantQuota`, `askAssistant`.
- `src/lib/projects/billing-rates.functions.ts`: `listRates`, `listRateTargets`, `previewRateImpact`, `createRate`, `splitRate`, `endRate`, `listLegacyRateCandidates`, `getContractBillingContext`, `listBillingConfigs`, `saveBillingConfig`, `endBillingConfig`.
- `src/lib/projects/billing.functions.ts`: `listMeasurements`, `getMeasurement`, `buildMeasurement`, `refreshMeasurement`, `addMeasurementAdjustment`, `addMeasurementSuccessEvent`, `removeMeasurementLine`, `submitMeasurement`, `returnMeasurement`, `approveMeasurement`, `recheckMeasurement`, `generateMeasurementEntry`, `linkMeasurementLegacy`, `reverseMeasurement`, `cancelMeasurement`, `getProfitability`, `exportProfitability`.
- `src/lib/projects/billing.schemas.ts`: `uuid`, `isoDate`, `month`, `reason`, `shortReason`, `currency`, `hash`, `tz`, `money`, `rateTarget`, `rateCreate`, `billingParams`, `configSave`, `listScope`, `profitabilityInput`.
- `src/lib/projects/billing.server.ts`: `billingError`, `rpc`, `loadRates`, `loadConfigs`, `loadMeasurementDetail`, `RateTargetOptions`, `loadRateOptions`, `ContractServiceOption`, `loadContractBillingContext`.
- `src/lib/projects/billing.shared.ts`: `BILLING_MODELS`, `BillingModel`, `suggestMeasurementModel`, `BILLING_MODEL_LABEL`, `MeasurementStatus`, `MEASUREMENT_STATUS_LABEL`, `measurementStatusVariant`, `ISSUE_LABEL`, `issueLabel`, `RATE_SCOPE_LABEL`, `RATE_PRECEDENCE`, `monthBounds`, `monthRangeBounds`, `formatMoney`, `formatPct`, `parseMoneyInput`, `hoursToSeconds`, `toCsv`.
- `src/lib/projects/billing.types.ts`: `IssueItem`, `RateRow`, `RateImpact`, `LegacyRateCandidates`, `BillingConfigRow`, `MeasurementRow`, `MeasurementLine`, `MeasurementEvent`, `MeasurementDetail`, `Profitability`.
- `src/lib/projects/dashboard-metric-defs.shared.ts`: `MetricDef`, `METRIC_DEFS`, `metricDef`.
- `src/lib/projects/dashboard-views.functions.ts`: `getDashScope`, `getDashSummary`, `getDashDrill`, `exportDashList`, `searchDashFilterOptions`, `reevaluateDashAlerts`, `actOnAlert`, `getRiskRules`, `saveRiskRules`.
- `src/lib/projects/dashboard-views.server.ts`: `loadDashSummary`, `loadDashScope`, `loadDashDrill`, `loadDashFilterOptions`, `exportDashDrill`, `refreshDashAlerts`, `actOnDashAlert`, `loadDashRiskRules`, `saveDashRiskRules`.
- `src/lib/projects/dashboard-views.shared.ts`: `DASH_VIEWS`, `DashView`, `DASH_VIEW_LABEL`, `DASH_DATASETS`, `DashDataset`, `DASH_ORIGINS`, `DASH_ORIGIN_LABEL`, `DASH_ENTRY_STATUSES`, `DashFilters`, `DASH_FILTER_KEYS`, `DashFilterKey`, `DASH_VIEW_FILTERS`, `DashSearch`, `parseDashSearch`, `filtersForView`, `dashPreferenceKey`, `resolveDashView`, `ALERT_RULE_LABEL`, `ALERT_STATUS_LABEL`, `ALERT_SEVERITY_LABEL`, `csvCell`, `toSafeCsv`, `DASH_EXPORT_MAX_ROWS`, `DASH_PAGE_SIZE`.
- `src/lib/projects/dashboard-views.types.ts`: `Json`, `DashCount`, `DashCountMap`, `DashScope`, `DashPeopleAgg`, `DashMoney`, `DashMyAllocation`, `DashSummary`, `DashDrillPage`, `DashFilterOption`, `DashRuleConfig`, `DashRiskRules`.
- `src/lib/projects/dashboard.functions.ts`: `getProjectDashboard`.
- `src/lib/projects/dashboard.server.ts`: `loadProjectDashboard`.
- `src/lib/projects/dashboard.types.ts`: `ProjectDashboardItem`, `ProjectDashboardAttention`, `ProjectDashboardData`.
- `src/lib/projects/deal-delivery-history.server.ts`: `loadPolicy`, `PolicyState`, `savePolicy`, `HistoryRow`, `HistoryList`, `listHistory`, `PairPreview`, `previewHistory`, `applyHistory`, `applyExactHistory`, `createMissingHistory`, `revertHistory`.
- `src/lib/projects/deal-delivery-labels.ts`: `DeliveryPendingCode`, `PENDING_LABEL`, `BLOCKING_PENDING`, `pendingLabel`, `DeliveryJobStatus`, `JOB_STATUS_LABEL`, `SKIP_REASON_LABEL`, `ORIGIN_LABEL`, `PROJECT_ORIGIN_LABEL`, `REVIEW_LABEL`, `LINK_LABEL`, `NATURE_LABEL`, `CRITERION_LABEL`, `BLOCKED_LABEL`, `WARNING_LABEL`, `GROUP_NONE`, `GROUP_DEFAULT`, `groupKeyFromLabel`, `groupLabel`, `DeliveryOverview`, `ProjectOrigin`, `deliveryHeadline`, `formatHms`.
- `src/lib/projects/deal-delivery.functions.ts`: `getDealDeliveryOverview`, `createDeliveryProjectFromDeal`, `linkDeliveryProject`, `unlinkDeliveryProject`, `saveDeliveryGroups`, `retryDealDelivery`, `setProjectOperationalOwner`, `resolveDeliveryReview`, `searchProjectsForDeal`, `getProjectDeliveryOrigin`, `getCompanyDeliveryProjects`, `getContractDeliveryProjects`, `getDeliveryPolicy`, `saveDeliveryPolicy`, `getDeliveryHistory`, `previewDeliveryHistory`, `applyDeliveryHistory`, `applyExactDeliveryHistory`, `createMissingDeliveryProjects`, `revertDeliveryHistory`.
- `src/lib/projects/deal-delivery.schemas.ts`: `uuid`, `note`, `groupKey`, `pageInput`, `origins`, `pair`.
- `src/lib/projects/deal-delivery.server.ts`: `loadDealOverview`, `createFromDeal`, `linkToDeal`, `unlinkFromDeal`, `saveGroups`, `retryDelivery`, `setOperationalOwner`, `resolveReview`, `searchLinkableProjects`, `loadProjectOrigin`, `loadCompanyProjects`, `loadContractProjects`.
- `src/lib/projects/delivery-labels.ts`: `DeliveryHealth`, `DeliveryUpdateKind`, `DeliveryVisibility`, `HEALTH_LABELS`, `HEALTH_VARIANT`, `KIND_LABELS`, `VISIBILITY_LABELS`, `PROJECT_STATUS_LABELS`, `healthLabel`, `projectStatusLabel`, `formatDeliveryDate`.
- `src/lib/projects/delivery-template.shared.ts`: `TEMPLATE_KIND_LABEL`, `TemplateMilestone`, `TemplateTask`, `TemplateDefinition`, `templateKey`, `parseTemplateText`, `templateToText`, `describeTemplate`.
- `src/lib/projects/delivery.functions.ts`: `ProjectUpdateRow`, `DeliveryProject`, `getDealDelivery`, `getProjectDelivery`, `createProjectUpdate`, `updateProjectUpdate`, `deleteProjectUpdate`.
- `src/lib/projects/financials.ts`: `TimeEntryInput`, `MemberRatesInput`, `MilestoneInput`, `ProjectFinancials`, `computeProjectFinancials`.
- `src/lib/projects/offline-queue.ts`: `OfflineState`, `OfflinePayload`, `OfflineItem`, `OfflineStore`, `RETENTION_MS`, `hashPayload`, `scoped`, `enqueue`, `purgeExpired`, `SendResult`, `classifyError`, `syncQueue`, `memoryStore`, `indexedDbStore`, `purgeAllOfflineQueues`, `offlinePrefKey`.
- `src/lib/projects/ops.functions.ts`: `getProjectsOps`.
- `src/lib/projects/ops.types.ts`: `OpsRun`, `OpsJob`, `ProjectsOpsStatus`, `OPS_JOB_LABEL`.
- `src/lib/projects/public-api.openapi.ts`: `PROJECTS_OPENAPI`.
- `src/lib/projects/public-api.server.ts`: `ApiCtx`, `newCtx`, `respond`, `guard`, `handleListProjects`, `handleListTasks`, `handleListEntries`, `handleCreateEntry`, `projectEventPayload`.
- `src/lib/projects/public-api.shared.ts`: `PublicTimeEntryInput`, `PublicTimeEntryBody`, `toEntryPayload`, `canonicalJson`, `sha256Hex`, `resolveIdempotencyKey`, `ApiErrorShape`, `mapApiDbError`.
- `src/lib/projects/reconciliation-labels.ts`: `RECON_PROVIDERS`, `ReconProvider`, `PROVIDER_LABEL`, `ISSUE_TYPES`, `IssueType`, `ISSUE_TYPE_LABEL`, `ISSUE_STATUSES`, `IssueStatus`, `ISSUE_STATUS_LABEL`, `ISSUE_ACTIONS`, `IssueAction`, `actionNeedsNote`, `DIAGNOSIS_LABEL`, `DASHBOARD_HOURS_STATUS_LABEL`, `isApprovedHoursStatus`, `PROJECT_STATUS_LABEL`, `validateIsoRange`, `isIanaTimeZone`, `monthRangeInTimeZone`, `formatSeconds`, `formatHours`, `toCsv`.
- `src/lib/projects/reconciliation-links.server.ts`: `applyExactLinks`, `loadLinks`, `decideSuggestions`, `revertLinks`.
- `src/lib/projects/reconciliation-review.functions.ts`: `ReviewedLink`, `ReviewPage`, `previewReviewedLinks`, `applyReviewedLinks`, `revertReviewedLinks`, `historyReviewedLinks`.
- `src/lib/projects/reconciliation.functions.ts`: `getReconciliationOverview`, `getReconciliationBreakdown`, `listReconciliationIssues`, `exportReconciliationIssues`, `refreshReconciliationIssues`, `decideReconciliationIssues`, `getReconciliationLinks`, `applyReconciliationExactLinks`, `decideReconciliationSuggestions`, `revertReconciliationLinks`.
- `src/lib/projects/reconciliation.server.ts`: `Db`, `ReconCtx`, `requireReconAdmin`, `fail`, `loadOverview`, `BreakdownInput`, `loadBreakdown`, `IssueFilters`, `listIssues`, `EXPORT_LIMIT`, `exportIssuesCsv`, `refreshIssues`, `decideIssues`.
- `src/lib/projects/time-approval.functions.ts`: `submitTimeEntries`, `approveTimeEntriesV2`, `rejectTimeEntries`, `reopenTimeEntries`.
- `src/lib/projects/time-approval.server.ts`: `pendingItemsFor`, `emitTimeEntryEvent`.
- `src/lib/projects/time-entry.shared.ts`: `TIME_ENTRY_STATUS`, `TimeEntryStatus`, `TIME_ENTRY_STATUS_LABEL`, `TIME_ENTRY_SOURCE_LABEL`, `TIME_ENTRY_KIND_LABEL`, `REVIEW_FLAG_LABEL`, `isImportedLocked`, `isEditableEntry`, `parseClock`, `formatClock`, `durationMinutes`, `formatMinutes`, `formatSeconds`, `parseDurationInput`, `hoursToMinutes`, `WorkSchedule`, `AllocationSlice`, `expectedMinutesForDate`, `expectedMinutesForRange`, `eachIsoDate`, `findOverlap`, `cleanDbError`, `browserTimeZone`, `CopyCandidate`, `planWeekCopy`.
- `src/lib/projects/time-governance.functions.ts`: `getTimePolicy`, `saveTimePolicy`, `listProjectApprovers`, `setProjectApprover`, `revokeProjectApprover`, `listClientAcceptances`, `setClientAcceptanceRequired`, `recordClientAcceptance`, `voidClientAcceptance`, `listPeriodClosings`, `previewPeriodClose`, `closePeriod`, `reopenPeriod`, `listDeliveryTemplates`, `saveDeliveryTemplate`, `getProjectTemplateSuggestion`, `applyDeliveryTemplate`, `previewJibbleHours`, `materializeJibbleHours`.
- `src/lib/projects/time-metrics.functions.ts`: `getMyTimeSummary`, `getMyMonthCalendar`, `getTeamTimeOverview`.
- `src/lib/projects/time-metrics.server.ts`: `loadCapacity`, `sumEntrySeconds`, `weekBounds`, `monthBounds`.
- `src/lib/projects/time-offline.functions.ts`: `getOfflineContext`, `syncOfflineTimeEntry`.
- `src/lib/projects/time-tracking.functions.ts`: `listTrackableProjects`, `listTrackableTasks`, `listTimeEntries`, `saveTimeEntry`, `duplicateTimeEntry`, `removeTimeEntry`.
- `src/lib/projects/time-workflow.functions.ts`: `getTrackableProjects`, `toggleFavoriteProject`, `getTimer`, `startTimerSession`, `timerAct`, `previewSubmission`, `submitPeriod`, `withdrawSubmission`, `listPendingApprovals`, `decidePendingItems`, `reopenApproval`, `getTimesheetOverview`.
- `src/lib/projects/time-workflow.types.ts`: `TimePolicy`, `TrackableProject`, `TrackableProjects`, `TimerSegment`, `TimerState`, `PreviewIssue`, `SubmissionPreview`, `PendingItem`, `PendingApprovals`, `OverviewBucket`, `TimesheetOverview`, `ApproverRow`, `ClosePreview`, `JibbleHourRow`, `JibbleHourPreview`, `JIBBLE_HOUR_CLASS_LABEL`.

## Incertezas e divergências — separadas do conteúdo operacional
1. **[CONFIRMAR] menu e deny:** `src/lib/menu-config.ts:canSee` aceita permissionAny, mas na ausência de chave cai em need; sem need retorna true. Portanto permissionAny isolado não é barreira de negação no helper genérico. O AppSidebar chama esse helper para itens TechProjects; filtros de módulo e gates de tela continuam relevantes. Não foi demonstrado por execução que usuário sem chave deixa de ver cada item. Comportamento pretendido documentado: licença ∩ permissões efetivas, deny prevalece. Revisar fallback por papel e testes de menu/URL direta antes de publicar.
2. **[CONFIRMAR] min_permission escalar:** o esquema aceita uma chave, enquanto menus usam permissionAny e fallback por papel. Foi proposta a primeira chave literal do menu (subtelas herdam referência de Projetos ou Espaços), sem criar chave nova. Isso pode ocultar ajuda de usuário autorizado apenas por team/workspace ou por tasks no Dashboard. Não converter permissionAny em string com OR e não presumir que a primeira chave representa todas as alternativas. Resolver equivalência de acesso da Ajuda antes do seed.
3. **[CONFIRMAR] subtelas sem item:** `/projects/lists/$id`, ficha do projeto e telas de entrega/horas/financeiro não possuem menu próprio; referência min_permission herdada não representa recursos adicionais. O artigo explica capacidades adicionais, mas o modelo escalar não expressa composição de gates.
4. **Divergência comprovada no comentário de edição:** `src/lib/projects/time-entry.shared.ts` comenta que só rascunho/devolvido aceitam edição; o corpo de isEditableEntry também aceita submitted sem period_closing_id. `saveTimeEntry` declara que enviado/devolvido retorna a rascunho. Os artigos seguem o corpo executável, não o comentário.
5. **[CONFIRMAR] autorização em ambiente:** não foram executados cenários permitido/sem chave/deny/outro workspace/inativo, testes de RLS, banco isolado, testes E2E ou acesso direto. Evidência estática não certifica conformidade RBAC.
6. **[CONFIRMAR] produção/publicação:** não foi consultado help_articles; version=1 é proposta para arquivos projects inexistentes localmente. Antes de aplicar, verificar slugs/versões já publicados e incrementar quando necessário. is_published=true é metadado proposto, não publicação efetuada.
7. **[CONFIRMAR] integrações e agendas:** disponibilidade de credenciais, tenants externos, opt-ins e agendadores não foi validada. Nenhuma sincronização recorrente ou conclusão de execução externa foi presumida.
8. **Limite da auditoria funcional:** inventário técnico inclui todos os arquivos encontrados em components/projects e lib/projects, mas uso alcançável de cada símbolo e combinações de estado exigem validação de execução. Guias de API, ferramentas de serviço e tarefas internas não foram transformados automaticamente em telas oficiais.
9. **Sem alteração de inventário:** pela restrição somente /tmp, a tabela é a proposta exata de conteúdo da seção projects. Não houve edição de docs/help/inventario.md, docs/help/divergencias.md nem pendencias-midia.md.

## Mídia pendente
Capturar cada howto em workspace demonstrativo, sem dados reais. Marcadores de screenshot estão nos corpos; transferi-los para docs/help/pendencias-midia.md apenas na aplicação autorizada.

## Contrato de entrega e aplicação futura
- JSON é uma lista de artigos com metadata, body_markdown e source_paths; metadados seguem o front matter atual. No seed, mapear body_markdown para body_md.
- Gerar docs/help/projects/<slug>.md a partir de metadata + corpo e seed idempotente somente após resolver as divergências de acesso. Não foi gerada nem aplicada migration.
- route_pattern usa caminhos sem _authenticated e sem o sufixo de layout projects_; parâmetros usam $id. A rota settings tem artigo de encaminhamento. Não usar wildcard: o matcher exige o mesmo número de segmentos.
- Os howtos complementares mantêm route_pattern vazio para não disputar o mesmo padrão com o artigo principal de tela; seus corpos indicam a entrada real e os artigos de tela cobrem a navegação.
- Não foram rodados build, typecheck ou gates que escrevem no projeto. Validação local somente dos dois entregáveis: esquema, obrigatoriedade das seções, fontes existentes, slugs únicos, permissões no catálogo, cobertura exata de rotas e links internos.

## Arquivos produzidos
- `/tmp/help-projects-articles.json`
- `/tmp/help-projects-audit.md`

## Validação dos entregáveis
JSON válido; 35 slugs únicos; 30 howtos com todas as seções obrigatórias; 23 route_pattern distintos cobrindo as 23 entradas de rota; 183 caminhos de fonte existentes; min_permission conferido no catálogo local; links internos conferidos. Resultado: aprovado na validação estrutural, sem certificação de execução ou publicação.
