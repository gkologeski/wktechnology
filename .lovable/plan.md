## Objetivo

Transformar `/home` em um **dashboard cross-módulos** com KPIs numéricos e mini-gráficos dos módulos que o usuário atual tem acesso (contratado + habilitado + com permissão de visualização). A tela atual (grid de módulos + atalhos) é movida para um novo item no sidebar chamado **"Módulos"** em `/modules`. O dashboard tem um **filtro global de período** (date range picker pt-BR).

## Escopo

- **Nova Home dashboard** — KPIs + mini-charts (linha/barra) por módulo, filtrados por contratação + permissão do usuário, todos respeitando um **período selecionável** (default: Últimos 30 dias).
- **Nova rota `/modules`** — recebe o conteúdo atual de `/home` (grid + atalhos).
- **Sidebar ERP** — adicionar item "Módulos" logo abaixo de "Home".
- **DateRangePicker pt-BR** — usa a skill `date-range-picker-br` (presets Hoje/Ontem/Últimos 7/30/90/… + intervalo custom).

Fora do escopo: alterar RLS, criar novas tabelas, mudar semântica dos KPIs já existentes por módulo.

## Arquitetura

### 1. Skill: DateRangePicker pt-BR

Criar seguindo a skill selecionada:
- `src/lib/date-presets.ts` — `getPresetRange(key)` e `PRESETS` (grupos Dias / Semanas / Trimestres / Semestres / Anos / Últimos N / Personalizado), semana com `weekStartsOn: 1`, semestre calculado por mês.
- `src/components/date-range-picker.tsx` — `Popover` + coluna esquerda de presets + `Calendar` (`mode="range"`, `className="p-3 pointer-events-auto"`), formatação `dd/MM/yyyy` com `ptBR`.
- Props: `value`, `onChange(range, presetKey?)`, `defaultPreset = "last30"`, `align`, `className`.
- Garantir dep `date-fns` (já usada no projeto — apenas confirmar; se faltar, `bun add date-fns`).

O dashboard mantém o range em `useState` (não vai para URL nesta fase para manter o escopo enxuto) com default `last30`.

### 2. Server function agregadora

`src/lib/home/dashboard.functions.ts` (nova) — `getHomeDashboard` protegida por `requireSupabaseAuth`:

- Input validado por Zod: `{ from: string /* ISO */, to: string /* ISO */ }`. Handler faz `new Date(...)`.
- Resolve workspace ativo e módulos contratados/habilitados (reusa `listWorkspaceModules`).
- Para cada módulo habilitado, agrega em paralelo (RLS já aplica escopo do usuário) restringindo `created_at`/`due_date`/eventos ao intervalo `[from, to]`:
  - **CRM**: leads criados, negócios criados, valor do pipeline aberto, série diária de negócios criados.
  - **ATS**: candidaturas criadas, entrevistas no período, ofertas enviadas, série de candidaturas.
  - **Contratos**: contratos criados, ativos, aguardando assinatura, expirando em 30 dias após `to`.
  - **Projetos**: projetos ativos, tarefas concluídas no período, tarefas abertas atribuídas ao usuário.
  - **Financeiro**: recebíveis abertos, a pagar aberto, vencidos, série de entradas no período.
  - **Pessoas**: pessoas ativas, documentos expirando (30 dias após `to`), onboardings em curso.
- KPIs "instantâneos" (ex.: pipeline aberto, ativos hoje) **não** filtram por período; KPIs de fluxo e a série sim. Cada KPI carrega `scope: "period" | "current"` no DTO para o front rotular quando fizer sentido.
- Retorna DTO plano: `{ modules: Array<{ id: ModuleId, kpis: KPI[], series?: { label, points: {day,value}[] } }> }`.

### 3. Filtragem por permissão

Reusar `usePermissions` (client) e as `permission_keys` já existentes por módulo (`techsales.*`, `techhire.*`, etc.). No cliente: só renderiza a seção do módulo se `can("<modulo>.dashboard.view")` (com bypass automático para owner/admin). Server function não decide visibilidade — RLS garante escopo dos dados.

### 4. Nova Home (`src/routes/_authenticated/home.index.tsx`)

- `PageHeader` "Início" com ação secundária "Ver módulos" → `/modules`.
- Barra logo abaixo do header com o `DateRangePicker` alinhado à direita (label "Período").
- `useQuery` com `queryKey: ["home-dashboard", from, to]` — troca de período re-fetch automático.
- Para cada módulo visível: `SectionHeader` + grid de `MetricCard` (KPIs) + `LineChart`/`BarChart` (`recharts`, já usado em `dashboard.tsx`).
- Estados: loading (skeletons), erro por módulo isolado (não derruba a página), empty ("nenhum módulo ativo").

### 5. Nova rota `/modules` (`src/routes/_authenticated/modules.index.tsx`)

- Renderiza exatamente o conteúdo atual da Home: `ModulesGrid` + `ShortcutsGrid` + rodapé de status.
- Extrair `ModulesGrid` e `ShortcutsGrid` para `src/components/erp/modules-grid.tsx` e `.../shortcuts-grid.tsx` para reuso e manter a Home enxuta.

### 6. Sidebar

Editar `src/lib/menu-config-erp.ts` para adicionar `{ title: "Módulos", url: "/modules", icon: Boxes }` logo após Home no grupo ERP.

## UX/UI (TechHire standard)

- Tokens semânticos de `src/styles.css`.
- Componentes oficiais: `PageHeader`, `SectionHeader`, `MetricCard`, `Skeleton`, `Card`.
- `DateRangePicker` pt-BR com trigger `Button` mostrando `dd/MM/yyyy – dd/MM/yyyy`.
- Mini-charts com `var(--color-primary)` e grid `var(--color-border)`; `ResponsiveContainer` altura 180–220 px.
- Responsivo: KPIs em 1/2/4 colunas; período colapsa para linha própria em mobile.
- Loading skeletons fiéis ao layout final; erro por módulo com "Tentar novamente" (invalida a query).

## Segurança

- `getHomeDashboard` usa `requireSupabaseAuth` — RLS garante que o usuário só vê dados do workspace/registros permitidos.
- Nenhuma alteração de RLS, schema ou policies.

## Arquivos afetados

**Criar**
- `src/lib/date-presets.ts`
- `src/components/date-range-picker.tsx`
- `src/lib/home/dashboard.functions.ts`
- `src/routes/_authenticated/modules.index.tsx`
- `src/components/erp/modules-grid.tsx`
- `src/components/erp/shortcuts-grid.tsx`

**Editar**
- `src/routes/_authenticated/home.index.tsx` (reescrita: agora dashboard com filtro de período)
- `src/lib/menu-config-erp.ts` (novo item "Módulos")

## Como validar manualmente

1. Login com owner: `/home` mostra KPIs + mini-charts de todos os módulos ativos, período default "Últimos 30 dias".
2. Trocar o período no picker (ex.: "Últimos 90 dias", "Esse Trimestre", intervalo custom) — todos os KPIs e charts recarregam.
3. Login com usuário restrito (ex.: só CRM+ATS): `/home` mostra apenas essas seções.
4. Clicar "Módulos" no sidebar → abre grid antigo em `/modules`, botão "Entrar" funcional.
5. Desabilitar um módulo em `/workspace/modules` → seção desaparece da Home.

## Próximo passo (não executar automaticamente)

Depois de aprovado, implementar picker + server function + Home + rota `/modules` + sidebar em uma passada, com validação `tsgo` e build.