
## Problemas observados

1. **ERP Home mostra a cara do TechSales.** Ao selecionar "ERP Home" no seletor, `navigate({ to: "/home" })` funciona, mas:
   - Em produção, o usuário continua no host `crm.wktechnology.com.br` → o `AppSidebar` calcula `activeModule = "crm"` e renderiza header/menus de **TechSales**, com "Dashboard" em destaque.
   - `HostRouterGuard` não trata `/home` como caminho neutro (só reconhece `/workspace`, `/settings`, `/account`, `/admin`), então nunca redireciona para o host do workspace.
   - Resultado prático: a página `/home` até carrega, mas visualmente parece "o dashboard do TechSales".

2. **ATS não tem dashboard.** `MODULES.ats.defaultRoute = "/jobs"`. O TechHire só tem `/insights` (painel de funil) — não é uma home equivalente a `/dashboard` do TechSales (KPIs + gráficos + tarefas + atividade).

---

## Escopo

- **Fix A — ERP Home neutro:** o `/home` deve renderizar num shell de workspace neutro (sem branding TechSales/TechHire, sem menus de módulo), inclusive no host `crm.*`.
- **Fix B — Dashboard TechHire:** criar `/ats-dashboard` como home do TechHire, seguindo a **Design Foundation do TechHire** e a mesma "shape" (KPIs + widgets + próximas atividades) do `/dashboard` do TechSales, com dados de vagas/candidatos/entrevistas.

Fora de escopo: alterar RLS, schema, autenticação, o `/dashboard` do TechSales, ou o `/insights` (que continua vivo como painel específico de funil).

---

## Fix A — ERP Home neutro

**A1. Reconhecer `/home` como rota neutra do workspace**
- `src/components/host-router-guard.tsx`: incluir `/home` (e por consistência `/marketplace`, `/invoices`) em `WORKSPACE_PATH_PREFIXES`. Assim, em produção, ao clicar "ERP Home" a partir do host `crm.*` ou `ats.*`, o guarda redireciona para o host neutro do workspace (`app.wktechnology.com.br/home`).
- `src/components/module-switcher.tsx`: o botão "ERP Home" já chama `navigate({ to: "/home" })`. Adicionar navegação cross-host quando o host atual não é o workspace host (usar `buildModuleUrl`-equivalente para `/home` ou compor URL com `WORKSPACE_HOST` + `isReachableHost` como fallback). Fecha o popover como já faz.

**A2. Shell neutro do ERP Home**
- `src/lib/modules/active-module.ts`: adicionar `detectWorkspacePath(pathname)` (retorna `true` para `/home`, `/home/*`, `/workspace/*`, `/settings/*`, `/marketplace`, `/invoices`) e expor um hook `useIsWorkspaceShell()`.
- `src/components/app-sidebar.tsx`: quando `useIsWorkspaceShell()` for `true`, renderizar cabeçalho "ERP · Workspace" (nome/cor neutros — usar cinza do design system, ícone `LayoutGrid`/`Home`) e um grupo de menu enxuto: Home (`/home`), Controle de Acesso (`/home/access`), Módulos (`/workspace/modules`), Configurações (`/settings`), Marketplace (`/marketplace`). **Sem** menus do TechSales/TechHire.
- Não alterar `MODULES` (o "workspace" não é um módulo do ERP; é o shell do host).

**A3. Manter compatibilidade**
- Se o host workspace ainda não estiver alcançável (`isReachableHost` = false), o `HostRouterGuard` mantém o comportamento atual (não redireciona), e o `AppSidebar` já mostra o shell neutro pelo path — então a experiência dentro do host `crm.*` também fica correta.

---

## Fix B — Dashboard do TechHire

**B1. Rota**
- Criar `src/routes/_authenticated/(ats)/ats-dashboard.tsx` com path `/ats-dashboard` (mantém o padrão de prefixos ATS conhecidos; `ATS_ROUTE_PREFIXES` é derivado do menu, então o novo item entra automaticamente).
- Alterar `MODULES.ats.defaultRoute` de `/jobs` para `/ats-dashboard` em `src/lib/modules/registry.ts`.
- Em `src/lib/menu-config-ats.ts`, inserir "Dashboard" como **primeiro** item do sidebar do ATS, apontando para `/ats-dashboard`. "Insights" permanece logo abaixo (painel de funil, é complementar). "Vagas" continua após.
- Atualizar `src/routes/_authenticated.tsx` (redirect de `/`) se necessário: `ats` host → `MODULES.ats.defaultRoute` (já usa a constante, então não precisa mudar).

**B2. Layout do Dashboard TechHire (Design Foundation)**
Presentational only. Segue `AtsPageHeader`, `SectionHeader`, `MetricCard`, `EmptyState`, `LoadingSkeleton`, `ErrorState` e tokens de `src/styles.css`.

```text
┌─ AtsPageHeader (eyebrow "TechHire", título "Dashboard", ações rápidas) ─┐
├─ 4× MetricCard  ── Vagas abertas · Candidatos ativos · Entrevistas 7d · Ofertas em aberto ─┤
├─ [ Funil de contratação (gráfico) ]   [ Novas aplicações últimos 30d (linha) ]              │
├─ [ Vagas em destaque (lista compacta) ] [ Próximas entrevistas (lista) ]                    │
├─ [ Minhas tarefas (activities completed=false) ] [ Atividade recente (audit/timeline) ]     │
└─ Loading skeleton fiel ao layout, EmptyState por bloco, ErrorState com "Tentar novamente" ──┘
```

Dados via **server functions/RPCs existentes** — nada de acessar Supabase direto em componente presentacional:
- KPIs: reutilizar `ats.functions.ts` (contagens de `ats_jobs`, `ats_candidates`, `ats_interviews`, `ats_offers` já filtradas por workspace via RLS). Onde faltar, criar um `getAtsDashboardMetrics` em `src/lib/ats/dashboard.functions.ts` protegido por `requireSupabaseAuth`.
- Funil: reusar dados de `PipelineInsightsPanel` (já existe em `/insights`) — extrair query para função server e consumir nos dois lugares.
- Próximas entrevistas: `ats_interviews` filtradas `starts_at >= now()` limit 5.
- Minhas tarefas: `activities` `completed=false`, filtro `owner_id = auth.uid()`, mesmas queries do TechSales, mas escopadas a atividades vinculadas a entidades ATS (`ats_candidate_id` / `ats_job_id` não nulos) ou fallback a todas as próprias — decidir na implementação priorizando o mais simples: mostrar todas as próprias, com badge "ATS" quando pertinente.

**B3. Sem alterar TechSales**
- `/dashboard` do TechSales permanece intocado. Não compartilha código de UI com o novo, apenas as convenções de layout do ATS Design Foundation.

---

## Arquivos que serão criados

- `src/routes/_authenticated/(ats)/ats-dashboard.tsx` — página.
- `src/lib/ats/dashboard.functions.ts` — server functions (`getAtsDashboardMetrics`, `getAtsUpcomingInterviews`, `getAtsFunnelSummary`) com `requireSupabaseAuth`.
- (Opcional) `src/components/ats/dashboard/*` — blocos `KpiRow`, `FunnelBlock`, `UpcomingInterviewsList`, `MyTasksBlock` isolando UI.

## Arquivos que serão alterados

- `src/components/host-router-guard.tsx` — adiciona `/home`, `/marketplace`, `/invoices` a `WORKSPACE_PATH_PREFIXES`.
- `src/components/module-switcher.tsx` — "ERP Home" navega cross-host para `WORKSPACE_HOST` em produção (com fallback SPA se host não alcançável).
- `src/lib/modules/active-module.ts` — adiciona `detectWorkspacePath()` e hook `useIsWorkspaceShell()`.
- `src/components/app-sidebar.tsx` — quando `useIsWorkspaceShell()`, renderiza header neutro e menu enxuto do ERP; não mostra menus de módulo.
- `src/lib/modules/registry.ts` — `MODULES.ats.defaultRoute = "/ats-dashboard"`; ajusta primeiro item do menu para "Dashboard".
- `src/lib/menu-config-ats.ts` — insere item "Dashboard" (`/ats-dashboard`) no topo.

## Validações que serão executadas

- `bunx tsgo --noEmit` após a implementação.
- Checagem visual via Playwright em `/home` (shell neutro), `/ats-dashboard` (KPIs + widgets renderizando com dados reais), `/dashboard` (TechSales intocado), e no seletor de módulos alternando entre ERP Home ↔ TechHire ↔ TechSales.

## Riscos e mitigação

- **Cross-host em produção quando host workspace não estiver com SSL/DNS:** já coberto por `isReachableHost` — cai em navegação SPA no mesmo host, mas o shell neutro por path garante que a experiência ainda fica "ERP Home".
- **Loop de redirect:** `HostRouterGuard` já tem proteção com `LOOP_MAX`/`LOOP_COOLDOWN_MS`.
- **`ATS_ROUTE_PREFIXES` gerado a partir do menu:** ao adicionar `/ats-dashboard` no menu ATS, a detecção path-first passa a considerá-lo módulo ATS automaticamente.
- Nada de RLS/schema/autenticação alterado.

## Como validar manualmente

1. No seletor de módulos, escolher **ERP Home** → o combo fecha, a URL vira `/home` (ou `app.*/home` em produção), o sidebar deixa de mostrar TechSales e apresenta o shell neutro "ERP · Workspace".
2. Escolher **TechHire** → aterrissa em `/ats-dashboard` com KPIs, funil, próximas entrevistas e tarefas. Sidebar mostra TechHire com "Dashboard" no topo.
3. Escolher **TechSales** → continua indo para `/dashboard` inalterado.
4. Em produção nos três subdomínios (`app.*`, `ats.*`, `crm.*`), digitar `/home`, `/ats-dashboard`, `/dashboard` diretamente e confirmar que o `HostRouterGuard` roteia para o host correto sem loop.
