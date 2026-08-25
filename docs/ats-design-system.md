# ATS Design System — Quiet Premium

Fundação visual do ATS TechHire. Objetivo: produto SaaS B2B premium, confiável e denso, inspirado na qualidade (não na marca) de Linear, Stripe Dashboard, Attio, Ashby, Greenhouse, GitHub e Atlassian.

Princípios:

- **Quiet premium**: superfícies neutras, bordas 1px discretas, sombras sutis, raios 6–10px, hierarquia tipográfica forte.
- **Sem espetáculo**: zero glassmorphism, gradientes apenas em accents de IA, animações curtas (120–180ms ease-out).
- **Densidade inteligente**: pensado para alto volume de candidatos sem virar planilha.
- **Cor com intenção**: cada cor tem um significado semântico (status, etapa, score, risco, IA, DEI).
- **Acessível por padrão**: contraste AA, foco visível, navegação por teclado, dark mode garantido.

## Tokens (`src/styles.css`)

Definidos em `:root` (light) e `.dark`, e expostos como classes Tailwind via `@theme inline`.

### Superfícies e bordas

| Token              | Classe Tailwind         | Uso                               |
| ------------------ | ----------------------- | --------------------------------- |
| `--surface-1`      | `bg-surface-1`          | Fundo de página                   |
| `--surface-2`      | `bg-surface-2`          | Cards, painéis                    |
| `--surface-3`      | `bg-surface-3`          | Elementos elevados, hover de card |
| `--surface-sunken` | `bg-surface-sunken`     | Inputs, skeletons, listas zebra   |
| `--border-subtle`  | `border-border-subtle`  | Divisores leves dentro de cards   |
| `--border-default` | `border-border-default` | Borda padrão de card              |
| `--border-strong`  | `border-border-strong`  | Borda em estados ativos/foco      |

### Texto

| Token              | Classe                | Uso                   |
| ------------------ | --------------------- | --------------------- |
| `--text-primary`   | `text-text-primary`   | Conteúdo principal    |
| `--text-secondary` | `text-text-secondary` | Descrições, labels    |
| `--text-tertiary`  | `text-text-tertiary`  | Eyebrows, metadados   |
| `--text-disabled`  | `text-text-disabled`  | Estados desabilitados |

### Status de vaga · Etapa de pipeline · Score · Risco · IA · DEI

| Família | Tokens                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| Status  | `--status-open`, `--status-onhold`, `--status-closed`, `--status-draft`                                        |
| Stage   | `--stage-sourced`, `--stage-screen`, `--stage-interview`, `--stage-offer`, `--stage-hired`, `--stage-rejected` |
| Score   | `--score-strong` (≥80), `--score-good` (60–79), `--score-mixed` (40–59), `--score-weak` (<40)                  |
| Risco   | `--risk-low`, `--risk-medium`, `--risk-high`                                                                   |
| IA      | `--ai-accent`, `--ai-surface`, `--ai-border`                                                                   |
| DEI     | `--dei-accent`, `--dei-surface`                                                                                |

Cada token gera classes Tailwind correspondentes: `bg-status-open`, `text-stage-interview`, `border-ai-border`, `bg-ai-surface`, etc.

### Escalas

- **Espaçamento**: `2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56` (Tailwind nativo). Padding padrão de card: `p-4`/`p-5`. Gap padrão de seção: `gap-5`/`gap-6`.
- **Raio**: `rounded-md` (cards), `rounded-lg` (containers principais), `rounded-md` (badges pequenas, usar `rounded` apenas em primitives shadcn).
- **Sombra**: `shadow-xs` (card padrão), `shadow-sm` (drawer), `shadow-md` (popover), `shadow-lg` (modal).
- **Ícones**: 14px em badges, 16px em UI densa, 18–20px em headers.
- **Tipografia**: `text-2xl font-semibold` (page title), `text-sm font-semibold` (section), `text-xs` (metadados), `tabular-nums` em qualquer número de KPI/listagem.

## Componentes (`src/components/ats/ui/`)

Todos presentacionais — **proibido** importar Supabase, server functions, queries ou mutations.

| Componente         | Quando usar                                                                    |
| ------------------ | ------------------------------------------------------------------------------ |
| `AtsPageHeader`    | Topo de toda rota ATS. Título + descrição + ação primária + ações secundárias. |
| `AtsSectionHeader` | Cabeçalho de seções dentro de páginas/drawers.                                 |
| `MetricCard`       | KPI individual. Aceita `tone`, `delta`, `icon`, `hint`, `loading`.             |
| `StatusBadge`      | Status de vaga.                                                                |
| `StageBadge`       | Etapa de pipeline.                                                             |
| `ScoreBadge`       | Score de candidato/match (0–100). Cor derivada automaticamente.                |
| `SourceBadge`      | Fonte do candidato (LinkedIn, Indeed, indicação…).                             |
| `RiskBadge`        | Sinalização de risco/fraude.                                                   |
| `EmptyState`       | Toda lista/painel vazio. Sempre com CTA acionável.                             |
| `Skeletons.*`      | Loading fiel ao layout final (Metric/MetricsGrid/Card/Row).                    |
| `FilterBar`        | Busca + chips de filtro + ações. Reservado para listas (não aplicado ainda).   |
| `AIInsightCard`    | Bloco de insight de IA ou DEI. Discreto, com explicabilidade.                  |
| `FormSection`      | Seção de formulário com título/descrição à esquerda e campos à direita.        |

## Padrões de UX

- Toda tela tem **uma** ação primária clara no PageHeader.
- Toda lista deve oferecer busca, filtros visíveis e empty state com CTA.
- Toda ação destrutiva pede confirmação explícita.
- Todo loading usa skeleton fiel — nunca "Carregando…" solto.
- Todo erro explica o problema e sugere uma próxima ação (botão "Tentar novamente").
- Todo formulário relevante é agrupado em `FormSection`.
- Drawers (Sheet) para detalhes rápidos sem perder o contexto da lista.

## Roadmap de aplicação

- **Wave 0 (concluída)**: tokens + biblioteca + docs.
- **Wave 1 — piloto (concluída)**: `/insights`.
- **Wave 1 — extensão**: `jobs.tsx`, `candidates.tsx`, `interview-kits.tsx`, etc.
- **Wave 2+**: Pipeline, Perfil do candidato, Scorecards, Entrevistas, Ofertas, Configurações, Carreiras.
