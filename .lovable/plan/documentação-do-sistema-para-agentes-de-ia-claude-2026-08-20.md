# Documentação do sistema para agentes de IA (Claude)

Objetivo: criar um guia de entrada que o Claude (ou qualquer agente) leia automaticamente ao abrir o repositório, mais um conjunto de documentos detalhados de arquitetura, módulos, banco e convenções.

## Entregáveis

### 1. `CLAUDE.md` (raiz)

Arquivo-guia curto e denso (~200 linhas) com:

- O que é o produto: ERP/CRM multi-módulo (TechSales, TechHire, TechPeople, TechContracts, TechService, TechFinance, TechProjects).
- Stack fixa: TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + Supabase (Lovable Cloud). Router é TanStack Router — não instalar outro.
- Regras invioláveis: nunca editar `src/integrations/supabase/client.ts` e afins; nunca criar Edge Functions (usar `createServerFn`); nunca editar `src/routeTree.gen.ts`; segredos só via `process.env` dentro de handlers.
- Modelo de acesso: `workspace_id` como fonte única de isolamento, `assigned_to` como responsável, RBAC granular via `user_can_act`/`has_role`, RLS + GRANT obrigatórios.
- Mapa de pastas e onde cada coisa vive.
- Comandos de validação (typecheck, lint, build, vitest, playwright) conforme `package.json`.
- Padrões de UI obrigatórios (design system TechHire, PageHeader, DataTable, EmptyState, StatusBadge, tokens semânticos, PT-BR).
- Índice apontando para `docs/architecture/*`.

### 2. `docs/architecture/` (novos documentos)

- `overview.md` — visão do produto, módulos, rotas principais, fluxos ponta a ponta (Lead → Qualificação → Negócio → Proposta → Contrato → Financeiro; Vaga → Candidato → Candidatura → Oferta → Pessoa).
- `data-model.md` — inventário detalhado de tabelas por módulo (extraído do banco real), colunas de isolamento (`workspace_id`, `assigned_to`), enums, funções de banco relevantes e triggers principais.
- `security-rbac.md` — camadas de autorização: RLS, GRANT, `access_profiles`/`job_roles`/permissões granulares, `delete-guard`, `rls-denied`, rotas `_authenticated` vs públicas, `/api/public/*`.
- `server-functions.md` — mapa das server functions por domínio (`src/lib/**/*.functions.ts`), quando usar `requireSupabaseAuth`, regra de arquivo fino, rotas de API e webhooks/cron.
- `frontend-conventions.md` — rotas e grupos, grids (`use-grid-selection`, `GridBulkBar`), kanban (`KanbanBoard`, `use-view-mode`), filtros de responsável, timeline/realtime, formulários e moeda BRL, i18n PT-BR.
- `integrations.md` — Lovable AI Gateway, Apollo.io, Unipile/WhatsApp, HubSpot, Google Calendar/Meet, MCP server, e-mail/e-sign; estados de integração e onde ficam credenciais.
- `workflows-automation.md` — motor de workflows, `workflow_events`, ações (`create_survey_activity`, `open_deal_dialog`), token catalog, cron.
- `testing-and-ops.md` — como validar, suíte e2e existente, runbook operacional e armadilhas conhecidas (typecheck lento, uso do helper `sel()`).
- `README.md` — índice do diretório.

### 3. Reaproveitamento

Os docs atuais (`techhire-design-system.md`, `rbac-mvp.md`, `visibility-matrix.md`, `workspace-isolation-compliance.md`, `operations-runbook.md`, `erp-core-architecture.md`, `ats-*`) serão referenciados, não duplicados. Nenhum documento existente é apagado.

## Detalhes técnicos

- Levantamento por leitura: `src/routes/**` para rotas, `src/lib/**/*.functions.ts` para server functions, `src/components/**` para componentes canônicos.
- Levantamento de banco via consultas somente-leitura em `information_schema`/`pg_policies` para listar tabelas, colunas de isolamento e políticas por módulo (nenhuma migration será criada).
- Sem alteração de código de aplicação: apenas arquivos markdown novos.
- Sem exposição de segredos, IDs de projeto, URLs de backend ou chaves em nenhum documento.

## Fora de escopo

- Refatorações de código, migrations, mudanças de RLS ou UI.
- Documentação de features ainda não implementadas (backlog fica só como link para `docs/backlog-pendencias.md` e `docs/roadmap.md`).
