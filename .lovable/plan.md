## Objetivo

Reescrever `/deals` copiando a estrutura visual e de interação da tela de Deals do HubSpot, com fidelidade alta (5/5) e suportando múltiplos pipelines configuráveis.

## O que muda para o usuário

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Negócios                                          [+ Criar negócio  ▾]   │
│ Pipeline: [Vendas Brasil ▾]  Owner: [Todos ▾]  Período: [Este mês ▾]  ✕ │
│ ┌──────┬──────┬──────────┐                                               │
│ │Board │Lista │Previsão  │     🔍 Buscar…       [ Filtros ]  [ Ações ▾ ]│
│ └──────┴──────┴──────────┘                                               │
├──────────────────────────────────────────────────────────────────────────┤
│  Novo     Qualificado  Proposta  Negociação  Ganho    Perdido           │
│  R$ 12k   R$ 48k       R$ 90k    R$ 31k      R$ 22k   R$ 8k             │
│  ▰▰▱▱▱   ▰▰▰▰▱       ▰▰▰▰▰    ▰▰▱▱▱       ▰▰▰▱▱   ▰▱▱▱▱             │
│  ┌────┐  ┌────┐       ┌────┐   ┌────┐      ┌────┐  ┌────┐               │
│  │card│  │card│       │card│   │card│      │card│  │card│               │
│  └────┘  └────┘       └────┘   └────┘      └────┘  └────┘               │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Topo**: seletor de pipeline + filtros rápidos (owner, close date, valor, prioridade) como chips removíveis.
- **Abas de visualização**: `Board` (kanban), `Lista` (tabela densa estilo HubSpot), `Previsão` (forecast por estágio/owner).
- **Kanban rico**:
  - Header de coluna com nome do estágio, contagem, soma de valor, soma **ponderada** (`valor × probabilidade`), barra de progresso fina mostrando o ratio.
  - Card mostra: nome do negócio, valor + moeda, empresa (com avatar/iniciais), contato principal, owner (avatar), data de fechamento com cor (vermelho se atrasada), prioridade (badge).
  - Drag-and-drop entre colunas com optimistic update (já existe via dnd-kit).
- **Lista**: tabela com seleção, colunas configuráveis, agrupamento por estágio (collapsable), bulk actions e atalho de inline-edit, reutilizando `EntityList`.
- **Previsão**: tabela por estágio com `count`, `amount`, `weighted`, `weighted total`, e breakdown por owner.
- **Drawer lateral**: ao clicar em qualquer card/linha, abre `Sheet` à direita (substitui o `Dialog` atual) com abas internas: **Overview** (campos), **Atividades** (timeline reusando `activity-timeline`), **Notas**, **Contatos vinculados**, **Mais campos (HubSpot)** lendo `hs_raw`.

## Mudanças técnicas

### 1. Pipelines configuráveis
- Tabela `pipelines` já existe (`entity`, `stages jsonb`, `is_default`) e `deals` já tem `pipeline_id` + `stage_id`. Não precisa migration nova.
- Hook `usePipelines(entity)` em `src/lib/pipelines.ts`:
  - Busca pipelines do usuário (`entity = 'deal'`).
  - Faz seed automático na primeira carga: se nenhum pipeline existir, cria "Pipeline padrão" com os 6 estágios atuais de `DEAL_STAGES`, atribuindo `probability` (10/30/50/70/100/0) e cores tokenizadas.
  - Persiste o pipeline selecionado em `localStorage`.
- `stage` enum legado em `deals.stage` continua funcionando como fallback; novos negócios passam a usar `stage_id` (string do pipeline). Renderização aceita ambos.

### 2. Nova estrutura de arquivos
```text
src/routes/_authenticated/deals.tsx        (reescrito — orquestrador + tabs)
src/components/deals/
  deals-toolbar.tsx        (pipeline selector + chips de filtros rápidos)
  deals-board.tsx          (kanban estilo HubSpot)
  deals-board-column.tsx   (header com weighted + progresso)
  deals-board-card.tsx     (card denso)
  deals-list.tsx           (wrapper sobre EntityList)
  deals-forecast.tsx       (tabela de previsão)
  deal-detail-drawer.tsx   (Sheet lateral com abas)
src/lib/pipelines.ts       (hook + seed default)
```

### 3. Design tokens (fidelidade 5/5)
- Acrescentar em `src/styles.css` tokens próximos à paleta HubSpot:
  - `--hs-orange: oklch(...)` (primário CTA), `--hs-stage-*` (6 cores frias→quentes por estágio), `--hs-surface` (cinza muito claro de fundo), `--hs-divider`, `--hs-text-muted`.
  - Tipografia: usar a stack atual (não trocar fonte global), mas hierarquia/spacing/border-radius alinhados ao HubSpot (radius mais sutil 4px, headers em 13px uppercase tracking).
- Cards com sombra mínima + hover border laranja. Drawer com largura ~560px e sticky header com nome + valor + estágio editável inline (igual HubSpot).

### 4. Filtros rápidos
- Chips controlados em estado local + sincronizados com URL search params (`?owner=&period=&minValue=`), aplicados sobre `deals` antes do agrupamento. Reutilizar `applyFilters` apenas no modo Lista.

### 5. Forecast
- Cálculo client-side a partir dos deals carregados do pipeline atual:
  ```ts
  weighted = sum(value * (stage.probability ?? 0) / 100)
  ```
- Mostra "Meta" opcional (input local em `localStorage`) + gap to goal.

## Fora de escopo
- Multi-currency real (continua só formatação por `currency` do registro).
- Reordenar estágios por drag — feito via `/settings/pipelines` JSON atual.
- Edição inline do nome do negócio no card (apenas no drawer).
- Permissões por time.

## Critério de aceitação
1. `/deals` mostra dropdown de pipeline; trocar pipeline recarrega colunas.
2. Board exibe header com count + soma + weighted + barra; cards densos com empresa/contato/owner/data.
3. Tab Lista renderiza tabela com bulk actions usando `EntityList`.
4. Tab Previsão mostra tabela weighted por estágio + owner.
5. Clique em card/linha abre drawer lateral (não mais dialog).
6. Filtros rápidos (owner/período) refletem em todas as três views.
7. Drag-and-drop entre estágios continua persistindo via `supabase.update`.
