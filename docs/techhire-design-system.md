# TechHire Design System — Padrão Oficial

Este documento institucionaliza a **Design Foundation** como padrão visual e de experiência **oficial** do TechHire — para todos os módulos atuais (ATS) e futuros. O piloto foi validado em `/insights` e na lista de vagas (`/jobs`).

> Direção: **quiet premium**, SaaS B2B enterprise. Referências de qualidade (não de marca): Linear, Stripe Dashboard, Attio, Ashby, Greenhouse, GitHub, Shopify Admin, Atlassian.

---

## 1. Princípios visuais

1. **Quiet premium** — superfícies neutras, bordas 1px discretas, sombras sutis, raios 6–10px, hierarquia tipográfica forte.
2. **Sem espetáculo** — zero glassmorphism, sem gradientes decorativos (apenas em accents de IA), animações curtas (120–180ms ease-out).
3. **Densidade inteligente** — pensado para alto volume sem virar planilha.
4. **Cor com intenção** — cada cor tem significado semântico (status, etapa, score, risco, IA, DEI).
5. **Acessível por padrão** — contraste AA, foco visível, navegação por teclado, dark mode garantido.
6. **Presentacional puro** — componentes do design system não importam Supabase, server functions, queries ou mutations.

---

## 2. Tokens disponíveis (`src/styles.css`)

Definidos em `:root` (light) e `.dark`, expostos como classes Tailwind via `@theme inline`.

| Família     | Tokens (resumo)                                                                               | Classe exemplo         |
| ----------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| Superfícies | `--surface-1`, `--surface-2`, `--surface-3`, `--surface-sunken`                               | `bg-surface-2`         |
| Bordas      | `--border-subtle`, `--border-default`, `--border-strong`                                      | `border-border-subtle` |
| Texto       | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-disabled`                    | `text-text-secondary`  |
| Status      | `--status-open`, `--status-onhold`, `--status-closed`, `--status-draft`                       | `bg-status-open`       |
| Stage       | `--stage-sourced/screen/interview/offer/hired/rejected`                                       | `text-stage-interview` |
| Score       | `--score-strong (≥80)`, `--score-good (60–79)`, `--score-mixed (40–59)`, `--score-weak (<40)` | `bg-score-strong`      |
| Risco       | `--risk-low`, `--risk-medium`, `--risk-high`                                                  | `bg-risk-high`         |
| IA          | `--ai-accent`, `--ai-surface`, `--ai-border`                                                  | `border-ai-border`     |
| DEI         | `--dei-accent`, `--dei-surface`                                                               | `bg-dei`               |

**Regra de ouro:** se existe token semântico, **nunca** use cor arbitrária (`text-gray-400`, `bg-[#fafafa]`). Tokens garantem dark mode e consistência.

### Escalas

- **Espaçamento**: `2 / 4 / 6 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56`. Card padrão `p-4`/`p-5`. Gap padrão `gap-5`/`gap-6`.
- **Raio**: `rounded-md` (cards/badges), `rounded-lg` (containers principais).
- **Sombra**: `shadow-xs` (card), `shadow-sm` (drawer), `shadow-md` (popover), `shadow-lg` (modal).
- **Ícones**: 14px em badges, 16px em UI densa, 18–20px em headers.
- **Tipografia**: `text-2xl font-semibold` (page title), `text-sm font-semibold` (section), `text-xs` (metadados), `tabular-nums` em todo número de KPI/lista.

---

## 3. Componentes obrigatórios para novas telas

A camada **global** vive em `@/components/techhire/ui` (fachada estável). Componentes específicos do ATS continuam em `@/components/ats/ui`.

### Globais (`@/components/techhire/ui`)

| Componente      | Quando usar                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `PageHeader`    | Topo de **toda** rota. Título + descrição + ação primária + ações secundárias + tabs opcional. |
| `SectionHeader` | Cabeçalho de seções dentro de páginas e drawers.                                               |
| `MetricCard`    | KPI individual. Aceita `tone`, `delta`, `icon`, `hint`, `loading`.                             |
| `FilterBar`     | Busca + filtros + ações em qualquer lista.                                                     |
| `FormSection`   | Agrupador de formulário com título/descrição à esquerda e campos à direita.                    |
| `EmptyState`    | Toda lista/painel vazio, com CTA acionável.                                                    |
| `Skeletons.*`   | Loading **fiel ao layout final**. Nunca "Carregando…" solto.                                   |
| `StatusBadge`   | Status de domínio (open/onhold/closed/draft).                                                  |
| `MetaPill`      | Chip neutro para metadados densos (senioridade, modalidade, contadores).                       |
| `AIInsightCard` | Insight de IA ou DEI, sempre com explicabilidade visível.                                      |

### Específicos do ATS (`@/components/ats/ui`)

`StageBadge`, `ScoreBadge`, `SourceBadge`, `RiskBadge`, e — no futuro — `CandidateCard`, `JobCard`, `PipelineColumn`, `EvaluationCard`.

> **Não criar** novos componentes globais sem antes verificar se um existente cobre o caso. Se cobrir parcialmente, estender via props antes de duplicar.

---

## 4. Padrões de layout

### 4.1 Estrutura da página

```text
PageHeader
  ├─ eyebrow (contexto)
  ├─ title
  ├─ description (opcional, pode ter aria-live)
  ├─ secondaryActions  primaryAction
  └─ tabs (opcional)

[MetricCard grid]   ← apenas se a tela tiver KPIs

FilterBar           ← apenas se a tela tiver lista

Conteúdo principal
  ├─ DataTable / Cards grid / Kanban / Layout de detalhe
  └─ Empty / Loading / Error states (sempre os três)
```

### 4.2 Listas

- Densidade alta, mas com respiro: `py-3` por linha mínimo.
- Busca com **debounce 300ms**. Nunca trigger só por Enter.
- Filtros visíveis (chips), nunca escondidos em "Mais filtros" por default.
- Empty state diferenciado para "nunca teve dados" vs "filtro vazio".
- Skeleton com o **mesmo grid** do conteúdo final.

### 4.3 Detalhes

- Drawer (`Sheet`) para **preview rápido sem perder contexto** da lista.
- Rota dedicada (`/jobs/$id`) para edição/profundidade.
- Header da rota usa `PageHeader` com `eyebrow` para breadcrumb implícito.

### 4.4 Formulários

- Agrupar em `FormSection` (título + descrição à esquerda, campos à direita).
- **Sempre** `htmlFor` ↔ `id` em Labels e Inputs (inclui `SelectTrigger id`).
- Validação inline com mensagem clara e próxima ação.
- Ação primária à direita, secundária à esquerda, destrutiva isolada.

---

## 5. Padrões de estado

| Estado     | Componente / regra                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Loading    | `Skeletons.*` fiel ao layout final. Para refresh silencioso: indicador `Atualizando…` sem trocar o conteúdo. |
| Empty      | `EmptyState` com ícone, título, descrição curta e **CTA acionável**.                                         |
| Error      | Mensagem clara + botão "Tentar novamente" que chama `refetch()` / `invalidate()`.                            |
| Sucesso    | Toast curto (`sonner`), nunca modal de confirmação.                                                          |
| Destrutivo | `AlertDialog` com confirmação explícita do nome do recurso, quando aplicável.                                |

---

## 6. Padrões de badges/status

- Status de domínio → `StatusBadge` (open/onhold/closed/draft).
- Etapa de pipeline → `StageBadge` (ATS).
- Score 0–100 → `ScoreBadge` (ATS) — cor derivada automaticamente.
- Origem → `SourceBadge` (ATS).
- Risco/fraude → `RiskBadge` (ATS).
- Metadado neutro → `MetaPill`.

**Nunca** crie um `<Badge>` shadcn cru para representar status semântico — sempre via componente do design system.

---

## 7. Responsividade

- Breakpoints Tailwind padrão: `sm 640 / md 768 / lg 1024 / xl 1280`.
- Grids de cards: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` é o default seguro.
- Headers: ações colapsam para baixo do título em `< sm`.
- Listas em mobile viram cards verticais; tabelas densas só `≥ md`.
- Nunca `h-screen` → use `h-dvh` para evitar bugs em mobile.

---

## 8. Acessibilidade

- **AA mínimo** em contraste.
- Botões de ícone → `aria-label` obrigatório.
- Inputs → `Label htmlFor` ↔ `id` obrigatório (inclui `SelectTrigger id`).
- Foco visível: nunca remover `outline` sem substituir por `ring`.
- `Progress`, `Slider`, ícones interativos → `aria-label` descritivo.
- `PageHeader` aceita `descriptionLive` para anunciar texto dinâmico.
- Exatamente **um** `<main>` por página (já provido pelo layout).
- Tap targets ≥ 44px em mobile (use `min-h-11 min-w-11` em botões ícone).

---

## 9. Dark mode

- Todos os tokens têm pares light/dark. Ao usar tokens, dark mode "simplesmente funciona".
- **Proibido** `text-white`, `bg-black`, `text-gray-XXX`, `bg-[#...]` em componentes de UI.
- QA visual em dark mode é parte do checklist de aceite (seção 11).

---

## 10. Quando usar cada componente

| Caso                                       | Componente                                                |
| ------------------------------------------ | --------------------------------------------------------- |
| Topo de qualquer rota                      | `PageHeader`                                              |
| Cabeçalho de seção dentro de página/drawer | `SectionHeader`                                           |
| KPI numérico com tendência                 | `MetricCard`                                              |
| Tela com lista → busca + filtros           | `FilterBar`                                               |
| Tabela densa de registros                  | `DataTable` (shadcn `Table` + padrões deste doc)          |
| Card grid de registros (vagas, candidatos) | Grid + componente de domínio (`JobCard`, etc)             |
| Drawer de preview                          | `Sheet` (shadcn) + `SectionHeader` internos               |
| Formulário com múltiplas seções            | `FormSection`                                             |
| Lista vazia / filtro sem resultado         | `EmptyState`                                              |
| Carregamento inicial                       | `Skeletons.*`                                             |
| Bloco de insight de IA ou DEI              | `AIInsightCard`                                           |
| Status semântico do domínio                | `StatusBadge` / `StageBadge` / `ScoreBadge` / `RiskBadge` |
| Metadado neutro (senioridade, modalidade)  | `MetaPill`                                                |

---

## 11. Checklist de aceite para novas telas

Veja [`new-screen-ux-ui-checklist.md`](./new-screen-ux-ui-checklist.md).

---

## 12. Governança

- Toda nova tela deve referenciar este documento na PR.
- Mudanças em tokens (`src/styles.css`) ou em componentes globais (`src/components/techhire/ui/`) exigem revisão dedicada de design system.
- Componentes específicos de domínio que se mostrarem úteis em outro módulo devem ser **promovidos** para `techhire/ui` via re-export antes de serem movidos fisicamente, para não quebrar imports.

---

## 13. Histórico

- **Wave 0** — tokens + biblioteca + docs.
- **Wave 1** — piloto `/insights`.
- **Wave 1.1** — lista de vagas `/jobs`.
- **Wave 1.2 (oficialização)** — esta entrega: camada `techhire/ui`, checklist, template, correções de a11y de fundação.
- **Próximas Waves** — rollout em Pipeline, Detalhe da vaga, Perfil do candidato, Scorecards, Entrevistas, Ofertas, Configurações, Carreiras.
