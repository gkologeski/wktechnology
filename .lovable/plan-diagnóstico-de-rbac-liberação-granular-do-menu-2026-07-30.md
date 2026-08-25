# Diagnóstico de RBAC + liberação granular do menu

Duas entregas: (1) uma tela de diagnóstico que mostra as permissões efetivas do usuário e explica item por item do menu por que ele aparece ou está oculto; (2) auditoria dos itens de menu que hoje exigem o papel "manager", trocando o gate por permissões granulares.

## Situação atual (verificada)

- `src/lib/menu-config.ts` já suporta `permissionAny` (qualquer chave libera o item) e `canSee(need, perms, permissionAny)`, mas hoje só o item **Prospecção** usa isso.
- Existem **58 itens** com `need: "manager"` entre `menu-config.ts` (core/marketing/analytics/automação/configurações) e os menus por módulo: `menu-config-finance.ts`, `menu-config-people.ts`, `menu-config-services.ts`.
- O catálogo `public.permissions` já cobre Finanças, Pessoas, Projetos, TechHire, Contratos e parte do TechSales. **Não existem** chaves para: Marketing (landing pages, formulários, campanhas, agente SDR), Dashboards/Relatórios/Analytics, Sequências/Distribuição/SLA/Macros, Base de conhecimento, Catálogo/Produtos e Calendários/Agendamentos.

## Parte 1 — Tela de diagnóstico de RBAC

Nova rota `/settings/rbac-diagnostics` (dentro de Controle de acesso, visível para admin/owner e platform admin).

Conteúdo:

- **Cabeçalho** com workspace ativo, usuário, papel efetivo (owner/admin/manager/member) e flag de platform admin.
- **Resumo**: total de permissões efetivas, cargos atribuídos (primário e secundários) e conjuntos de permissões extras.
- **Permissões efetivas**: lista agrupada por módulo com busca, reaproveitando o formato já usado em `/settings/my-permissions`.
- **Auditoria do menu** (o ponto central do pedido): tabela com todos os itens do sidebar e de configurações, e para cada um:
  - visível: sim/não;
  - regra aplicada: `permissionAny` atendida / papel exigido (`admin`, `manager`, `platform`) / sem restrição;
  - motivo em PT-BR quando oculto, ex.: "Oculto: requer qualquer uma de techsales.marketing.campaigns.view, techsales.marketing.campaigns.manage — nenhuma concedida";
  - chaves que faltam, com botão para copiar a chave.
- **Modo "inspecionar outro usuário"** (somente admin/owner): seletor de membro do workspace que recalcula tudo com as permissões daquele usuário, para diagnosticar casos como o do marketing@.
- Estados de loading (skeleton), vazio e erro, seguindo o design system (PageHeader, SectionHeader, DataTable/StatusBadge, tokens semânticos).

Backend: nova server function autenticada que retorna, para o usuário atual ou (com validação de admin) para um `user_id` alvo do mesmo workspace: papel, flags, cargos, conjuntos e permissões efetivas via `current_user_permissions` / `user_effective_permissions`. Nenhuma alteração de RLS.

## Parte 2 — Auditoria dos itens `need: "manager"`

Para cada um dos 58 itens, adicionar `permissionAny` com as chaves de visualização correspondentes, mantendo `need: "manager"` como atalho (manager/admin continuam vendo tudo — nada é removido de quem já vê hoje).

Mapeamento por área:

- **Finanças** (`menu-config-finance.ts`): `techfinance.entries.view.*`, `payments`, `invoices`, `recurrences`, `cost_centers`, `banking`, `nfse`, `dunning` conforme a tela.
- **Pessoas** (`menu-config-people.ts`): `techpeople.onboarding.*`, `documents`, `wellbeing.*`, `benefits`, `timesheet`, `allocations`.
- **Serviços/Catálogo** (`menu-config-services.ts` + Produtos): nova chave de catálogo.
- **Automação e dados** (Workflows, Sequências, Distribuição, SLA, Macros): `system.workflows.manage.workspace` + novas chaves de sequências/distribuição/SLA/macros.
- **Marketing** (Landing Pages, Formulários, Campanhas Email/WhatsApp, Agente SDR): novas chaves.
- **Dashboards/Relatórios/Analytics**, **Base de conhecimento**, **Calendários/Agendamentos**: novas chaves.

Migração SQL aditiva:

- `INSERT ... ON CONFLICT DO NOTHING` das novas linhas em `public.permissions` (módulo, recurso, ação, escopo, `label_pt` em PT-BR).
- Incluir as novas chaves nos conjuntos de permissões de sistema equivalentes (`permission_set_items`) para que perfis existentes de gestor/marketing não perderem nada.
- Nenhuma tabela nova, nenhuma política alterada.

`SettingsItem` passa a aceitar `permissionAny` (hoje só `SidebarItem` tem), e `visibleSettingsItems` passa a considerá-lo.

## Detalhes técnicos

- Arquivos alterados: `src/lib/menu-config.ts`, `src/lib/menu-config-finance.ts`, `src/lib/menu-config-people.ts`, `src/lib/menu-config-services.ts`, `src/lib/menu-config.test.ts` (novos casos), `src/components/settings-menu.tsx` (gate por permissão).
- Arquivos novos: `src/routes/_authenticated/settings.rbac-diagnostics.tsx`, `src/lib/access-control/rbac-diagnostics.functions.ts`, e um helper puro `src/lib/menu-audit.ts` que percorre o menu e retorna `{ item, visible, rule, missingKeys }` — usado pela tela e pelos testes.
- Testes: estender `menu-config.test.ts` garantindo que (a) um membro com apenas as chaves de uma área vê exatamente os itens dessa área, (b) manager/admin continuam vendo tudo, (c) todas as chaves referenciadas em `permissionAny` existem no catálogo.
- Validações: `typecheck`, `lint`, `build` e os testes unitários.

## Fora de escopo

- Não altero RLS, autenticação, schema de negócio nem os gates dentro das telas (apenas visibilidade de menu).
- Não removo o fallback por papel; itens hoje visíveis para manager continuam visíveis.
