# Cobertura 100% da matriz de ações no diagnóstico de RBAC

Hoje vários itens de menu só têm gate por papel (`need: "admin"`) ou nenhum gate, e por isso aparecem na matriz de `/settings/rbac-diagnostics` sem nenhuma linha de ação. O objetivo é cadastrar chaves granulares para todas essas funcionalidades e ligá-las aos itens de menu, sem mudar quem enxerga o quê hoje.

## Decisões confirmadas

- Itens exclusivos de plataforma (Super-admin, Status, Alertas, Segurança, Quotas, Sandbox) continuam apenas por papel; na matriz aparecem com o aviso "restrito à plataforma".
- Itens hoje visíveis para todos passam a ser mapeados no catálogo, mas continuam visíveis para todos — nenhuma restrição nova de menu.
- Novas chaves cadastradas com escopos `own`, `team` e `workspace` quando fizer sentido, para a combo da matriz oferecer as três opções.

## Parte 1 — Novas chaves no catálogo (`public.permissions`)

Migração aditiva com `INSERT ... ON CONFLICT DO NOTHING`, `label_pt` em PT-BR.

Completar ações faltantes em recursos que hoje só têm `view`/`manage`:
`system.analytics.dashboards`, `system.analytics.reports`, `system.automation.sequences`, `system.automation.rotation`, `system.automation.sla`, `system.automation.macros`, `system.automation.email_templates`, `system.kb.articles`, `system.calendars`, `system.booking`, `system.onboarding_templates`, `system.user_groups`, `system.workflows`, `techsales.marketing.*`, `techsales.catalog.products`, `techfinance.banking`, `techfinance.dunning`, `techpeople.*` — adicionando `create`, `update`, `delete` e, quando pertinente, `export`/`approve`, além dos escopos `own`/`team` para `view` e `update`.

Novos recursos (hoje sem nenhuma chave):

- Workspace/estrutura: `system.branding`, `system.legal_entities`, `system.legal_entity_groups`, `system.language`, `system.pipelines`, `system.custom_properties`, `system.custom_objects`, `system.portal`, `system.snippets`, `system.files`, `system.marketplace`, `system.widget`, `system.import`, `system.audit` (view/create/update/delete conforme aplicável).
- CRM/vendas: `techsales.leads`, `techsales.contacts`, `techsales.companies`, `techsales.deals`, `techsales.quotes`, `techsales.invoices`, `techsales.tickets`, `techsales.tasks`, `techsales.catalog.services`.
- Projetos: `techprojects.projects`, `techprojects.tasks`, `techprojects.spaces`, `techprojects.timesheet`.
- TechHire (itens de menu sem chave): `techhire.pipelines`, `techhire.scorecards`, `techhire.interview_kits`, `techhire.scheduling`, `techhire.talent_pools`, `techhire.referrals`, `techhire.stage_emails`, `techhire.analytics`, `techhire.compliance`, `techhire.hunting`.
- Financeiro: `techfinance.categories`, `techfinance.bank_accounts`, `techfinance.reports` (DRE/fluxo de caixa).

As novas chaves de visualização entram também nos conjuntos de permissões de sistema equivalentes (`permission_set_items`), para que perfis de gestor/admin já existentes não percam nada.

## Parte 2 — Ligar as chaves aos itens de menu

Em `menu-config.ts`, `menu-config-core.ts`, `menu-config-erp.ts`, `menu-config-finance.ts`, `menu-config-people.ts`, `menu-config-projects.ts`, `menu-config-ats.ts`, `menu-config-services.ts`, `menu-config-contracts.ts`:

- Ampliar `MENU_PERMISSIONS` com uma entrada por funcionalidade.
- Itens com `need: "admin"` (exceto plataforma) ganham `permissionAny` mantendo o `need` como atalho — admin continua vendo tudo.
- Itens sem gate ganham apenas um novo campo `permissionResources` (usado só pelo diagnóstico), sem `need` e sem `permissionAny`, para não alterar a visibilidade atual.
- Itens de plataforma ficam como estão.

## Parte 3 — Ajustes na tela de diagnóstico

- `src/lib/menu-audit.ts` passa a considerar `permissionResources` ao derivar os recursos de cada item, para a matriz aparecer mesmo em itens sem gate.
- A tela exibe, por item, o rótulo do contexto: "visível para todos os membros", "acesso herdado do papel de administrador" ou "restrito à plataforma", mantendo a matriz Ação × Acesso em todos os casos.
- Meta de cobertura: nenhum item de menu (fora os de plataforma) fica com matriz vazia. Um teste garante isso.

## Detalhes técnicos

- Migração única, aditiva: apenas `INSERT` no catálogo `public.permissions` e em `permission_set_items`. Nenhuma tabela nova, nenhuma alteração de RLS, autenticação ou schema de negócio.
- `SidebarItem`/`SettingsItem` ganham o campo opcional `permissionResources?: readonly string[]`, ignorado por `canSee`.
- Testes: estender `src/lib/menu-config.test.ts` com (a) toda chave referenciada em `permissionAny`/`permissionResources` existe no catálogo, (b) todo item não-plataforma tem recursos mapeados, (c) visibilidade atual permanece idêntica para member/manager/admin.
- Validações: typecheck, lint, testes unitários e build.

## Fora de escopo

- Nenhuma mudança na visibilidade real do menu nem nos gates dentro das telas.
- Nenhuma concessão automática de permissão a usuários existentes além dos conjuntos de sistema já equivalentes.
