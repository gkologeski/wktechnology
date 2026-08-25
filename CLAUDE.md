# CLAUDE.md — Guia do agente para o TechERP

Leia este arquivo antes de qualquer alteração. Ele resume o que o sistema é, as
regras invioláveis e onde cada coisa vive. Detalhes por tema estão em
`docs/architecture/` (índice no final).

---

## 1. O que é o produto

**TechERP** (WK Technology) é um ERP/CRM multi-módulo, multi-tenant, em
português do Brasil. Um único código-base serve sete módulos verticais sobre um
núcleo comum (Core ERP):

| Módulo        | Id interno  | Domínio                                                                 |
| ------------- | ----------- | ----------------------------------------------------------------------- |
| TechSales     | `crm`       | Leads, prospecção, contatos, empresas, negócios, propostas, cotações    |
| TechHire      | `ats`       | Vagas, candidatos, candidaturas, entrevistas, ofertas, sourcing/hunting |
| TechPeople    | `people`    | Pessoas, alocações, documentos, benefícios, onboarding, incidentes      |
| TechContracts | `contracts` | Contratos (prestação, compra, aditivos), modelos, assinatura eletrônica |
| TechService   | `service`   | Tickets, SLA, base de conhecimento, chat ao vivo, macros                |
| TechFinance   | `finance`   | Contas a pagar/receber, NFS-e, faturas, bancos, DRE, fluxo de caixa     |
| TechProjects  | `projects`  | Projetos, listas, tarefas, marcos, timesheet, entregas                  |

Core ERP (compartilhado): Empresas, Contatos, Produtos, Catálogo de Serviços,
Usuários/Times, Permissões, Pipelines, Arquivos, Workflows, Integrações.

Domínios de produção: `app.wktechnology.com.br`, `crm.wktechnology.com.br`,
`ats.wktechnology.com.br` (o subdomínio define o módulo ativo).

## 2. Stack — fixa, não substituir

- **TanStack Start v1** (full-stack React) + **TanStack Router** file-based.
  Nunca instalar `react-router-dom` nem outro router.
- **React 19**, **Vite 7**, **TypeScript**, **Tailwind CSS v4** (tema em
  `src/styles.css`, sem `tailwind.config.js`).
- **shadcn/ui + Radix** para primitivos; **@dnd-kit** para drag-and-drop;
  **TanStack Query** para dados; **react-hook-form + zod** para formulários.
- **Supabase** (Lovable Cloud) para banco, auth, storage e realtime.
- Deploy em runtime edge (Cloudflare Workers).

## 3. Regras invioláveis

1. **Nunca criar Supabase Edge Functions.** Lógica de servidor interna usa
   `createServerFn` de `@tanstack/react-start`. HTTP externo (webhooks, cron,
   API pública) usa file routes em `src/routes/api/public/*`.
2. **Nunca editar arquivos gerados**: `src/routeTree.gen.ts`,
   `src/integrations/supabase/client.ts`, `client.server.ts`,
   `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, `.env`,
   `supabase/config.toml`.
3. **Segredos só no servidor**, lidos com `process.env['X']` **dentro** do
   `.handler()` — nunca em escopo de módulo, nunca com prefixo `VITE_`.
4. **Toda tabela nova em `public`** precisa, na mesma migration e nesta ordem:
   `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
   Sem `GRANT` a tabela é inalcançável em runtime.
5. **`workspace_id` é a fonte única de isolamento.** Não introduzir filtros
   manuais por `owner_id` em telas ou queries; visibilidade vem de RLS + RBAC.
6. **Papéis nunca em tabela de perfil.** Ficam em `user_roles` / `user_job_roles`
   e são checados por funções `security definer` (`has_role`, `user_can_act`).
7. **Idioma da interface é PT-BR.** Rótulos, mensagens e valores de campo em
   português, exceto termos técnicos padronizados (pipeline, start, stop).
8. **Arquivos `*.functions.ts` são finos**: só imports, tipos e declarações de
   server functions exportadas. Helpers e constantes vão para outro módulo ou
   para dentro do handler (o code-splitting apaga irmãos em escopo de módulo).
9. **Não remover funcionalidade existente** em tarefas de UI/refactor, e não
   alterar RLS, schema ou regra de negócio em tarefa de UX/UI.

## 4. Modelo de acesso (resumo)

- `workspaces` + `workspace_members` definem o tenant. 267 de 312 tabelas têm
  `workspace_id`; as demais são globais de plataforma ou tabelas-ponte.
- `assigned_to` = responsável pelo registro (65 tabelas). É filtro/coluna de
  UI, **não** mecanismo de segurança.
- RBAC granular: `job_roles`, `access_profiles`, `permissions`,
  `permission_sets`, `field_permission_rules`; avaliação por
  `public.user_can_act(recurso, ação, escopo)` e `current_user_permissions()`.
- Há 1.284 políticas RLS cobrindo 311 tabelas. Deleção negada por RLS **não
  gera erro** — use sempre `deleteRowGuarded` de `src/lib/delete-guard.ts`.
- Rotas autenticadas ficam em `src/routes/_authenticated/**` (o layout
  pathless faz o gate, `ssr: false`). Rotas públicas ficam na raiz e **não**
  têm `beforeLoad` de auth.

Detalhes: `docs/architecture/security-rbac.md`.

## 5. Mapa de pastas

```
src/routes/                 rotas file-based
  __root.tsx                layout raiz, head global, Toaster, auth listener
  _authenticated/           app logado (gate no layout pathless)
    (ats)/                  TechHire
  api/public/**             webhooks, cron ticks, API pública v1, SCIM, widget
  <públicas>.tsx            careers, kb, portal, offer, quote, interview, lp...
src/lib/                    lógica de domínio (~278 entradas)
  *.functions.ts            server functions (RPC tipado)
  *.server.ts               código server-only (engines, workers, adapters)
  ats/  people/ contracts/ projects/ finance*/ prospecting/ workflows/
  access-control/           RBAC: matriz, escopos, enforcement, diagnósticos
  menu-config*.ts           menus por módulo
  modules/                  módulo ativo, licenças, branding
  integrations/             Apollo, HubSpot, Lusha, ViaCEP, BrasilAPI, ClickUp
src/components/
  ui/                       shadcn (não estilizar por fora)
  techhire/ui/              fachada oficial do design system do produto
  ats/ contracts/ deals/ people/ projects/ kanban/ grid/ entity/ workflows/
src/integrations/supabase/   clientes gerados (não editar)
docs/                        documentação (ver índice abaixo)
tests/e2e/                   Playwright
```

## 6. Padrões de UI obrigatórios

Importe de `@/components/techhire/ui`: `PageHeader`, `SectionHeader`,
`MetricCard`, `FilterBar`, `FormSection`, `EmptyState`, `Skeletons`,
`StatusBadge`, `AIInsightCard`. Badges de domínio ATS (`StageBadge`,
`ScoreBadge`, `SourceBadge`, `RiskBadge`) ficam em `@/components/ats/ui`.

Toda tela precisa de: loading, empty, error, estados disabled, foco visível,
labels acessíveis, responsividade (desktop/tablet/mobile) e dark mode.
Use apenas tokens semânticos de `src/styles.css` — proibido `text-white`,
`bg-black`, `bg-[#...]`.

Grids: `use-grid-selection.ts`, `GridBulkBar`, `BulkAssignDialog`,
`AssigneeCell`, `AssigneeFilter`. Kanban: `KanbanBoard` + `ViewModeToggle` +
`use-view-mode.ts` (persistência em search param).

Referência: `docs/techhire-design-system.md` e
`docs/new-screen-ux-ui-checklist.md`.

## 7. Comandos

```bash
bun run typecheck     # tsc --noEmit (lento; ~30s+ — ver armadilhas)
bun run lint          # eslint .
bun run build         # produção
bun run build:dev     # build de desenvolvimento (valida prerender)
bun run test          # vitest run
bun run test:e2e      # playwright
bun run format        # prettier
```

## 8. Armadilhas conhecidas

- **Typecheck lento**: evite selects Supabase gigantes inline; use helpers de
  projeção existentes e tipos de `src/lib/db-types.ts`.
- **Erros transitórios do banco** (`schema cache`, `statement timeout`): use
  `withTransientRetry` de `src/lib/db/transient-retry.ts`.
- **Exclusão silenciosa por RLS**: `delete-guard.ts` (item 4 acima).
- **Erro de permissão em UI**: trate com
  `src/lib/access-control/handle-permission-error.ts` e `rls-denied.ts`.
- **Server fn protegida em loader de rota pública** → 401 no prerender.
  Chame via `useServerFn` + `useQuery`, ou mova a rota para `_authenticated/`.
- **Módulo ativo não vem da URL**, vem de host → `localStorage` → path.

## 9. Índice da documentação

| Documento                                   | Conteúdo                                       |
| ------------------------------------------- | ---------------------------------------------- |
| `docs/architecture/README.md`               | Índice do diretório                            |
| `docs/architecture/overview.md`             | Módulos, rotas e fluxos ponta a ponta          |
| `docs/architecture/data-model.md`           | Tabelas por módulo, isolamento, enums, funções |
| `docs/architecture/security-rbac.md`        | RLS, GRANT, RBAC granular, rotas públicas      |
| `docs/architecture/server-functions.md`     | Server functions, API routes, webhooks         |
| `docs/architecture/frontend-conventions.md` | Rotas, grids, kanban, forms, i18n              |
| `docs/architecture/integrations.md`         | IA, Apollo, HubSpot, Unipile, Google, MCP      |
| `docs/architecture/workflows-automation.md` | Motor de workflows, eventos, cron              |
| `docs/architecture/testing-and-ops.md`      | Validação, e2e, operação                       |

Documentos pré-existentes que continuam válidos: `docs/erp-core-architecture.md`,
`docs/techhire-design-system.md`, `docs/new-screen-ux-ui-checklist.md`,
`docs/rbac-mvp.md`, `docs/visibility-matrix.md`,
`docs/workspace-isolation-compliance.md`, `docs/operations-runbook.md`,
`docs/ats-design-system.md`, `docs/ats-platform-foundation.md`,
`docs/roadmap.md`, `docs/backlog-pendencias.md`, `docs/hubspot-feature-map.md`,
`docs/qa/`.
