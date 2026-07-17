
## Objetivo

Diferenciar visualmente, no Kanban de negócios, os cards com maior probabilidade de fechar e/ou maior valor — sem poluir o layout atual (quiet premium).

## Como funciona

### 1. Score de "proximidade de fechamento" (heurística, client-side)

Função pura em `src/lib/deals/hot-score.ts`, calculada sobre os deals já carregados (sem query extra):

```
score = 0.40 * probStage        // % do estágio no pipeline
      + 0.25 * dueSoon          // 1 se expected_close_date ≤ 14d, decai linearmente até 60d
      + 0.20 * recentActivity   // atividade em <=7d = 1, <=30d = 0.5, else 0
      + 0.15 * ageDecay         // deals muito antigos sem mover perdem score
```

Resultado em 0–100. Estágios `won`/`lost` sempre 0.

### 2. Sinal de "high value" (percentil do funil)

Calculado por render, ignorando won/lost:
- `p80 = percentile(deals.value, 80)`
- Card é **high-value** se `value >= p80` e `value > 0`.

### 3. Sinal de "hot"
- **Hot** se `score >= 70`.
- **Rising** (secundário) se `score >= 50 && < 70`.

## Tratamento visual (sutil)

Em `deals-board-card.tsx`, adicionar props `isHot`, `isHighValue`, `score`.

- **Borda esquerda** de 2px:
  - `hot` → `var(--hs-orange)` (cor primária já existente)
  - `high-value` → `var(--hs-stage-4)` ou token semântico `--hs-accent`
  - `hot + high-value` → gradient vertical entre os dois tokens
- **Ícone discreto** (14px) no canto superior direito, ao lado do badge de prioridade:
  - `Flame` (lucide) para hot
  - `Gem` para high-value
  - Tooltip: "Score 82 · Fecha em 9 dias" / "Top 20% em valor"
- **Valor em negrito** já existe; para high-value, aplicar `text-[var(--hs-orange)]` no valor.
- **Nada de**: glow, gradient no fundo, badge grande, cor do card alterada.

Nas colunas (`deals-board-column.tsx`):
- Contador extra minúsculo ao lado de `(count)`: `· 3 quentes` quando houver hot cards. Text-muted, sem cor de alerta.

## Toggle "Foco em fechamento"

Em `deals-toolbar.tsx`:
- Botão toggle (ícone `Target`) `Foco em fechamento`.
- Persistido em `localStorage: deals.focusMode`.
- Quando ativo:
  - Reordena cada coluna por `score desc` (fallback: valor desc).
  - Aplica `opacity-60` em cards com `score < 40` (cold) para reforçar o contraste — sem escondê-los.
  - Toolbar mostra pill "Foco em fechamento · N quentes".
- Quando inativo: comportamento e ordem atuais preservados; destaque visual (bordas/ícones) permanece sempre visível.

## Acessibilidade

- Ícones sempre com `aria-label` e tooltip textual.
- Borda esquerda + ícone → duplo canal (não depende só de cor).
- Foco visível preservado (`focus-visible:ring-[var(--hs-orange)]`).
- Dark mode: tokens `--hs-orange` / `--hs-accent` já se adaptam.

## Arquivos

**Novos**
- `src/lib/deals/hot-score.ts` — score + percentil + helpers puros, com testes.
- `src/lib/deals/hot-score.test.ts` — casos: won/lost=0, p80 com <5 deals, sem data.

**Alterados**
- `src/components/deals/deals-board-card.tsx` — props `isHot`/`isHighValue`/`score`, borda, ícones, valor destacado.
- `src/components/deals/deals-board-column.tsx` — contador de "quentes".
- `src/components/deals/deals-board.tsx` — computa score/percentil, aplica ordenação e opacidade quando `focusMode`.
- `src/components/deals/deals-toolbar.tsx` — toggle "Foco em fechamento".
- `src/routes/_authenticated/deals.tsx` (ou wrapper equivalente) — estado do toggle + persistência.

## Fora do escopo

- Nenhuma mudança em RLS, schema, server functions ou lógica de negócio.
- Sem novos campos no banco (score é derivado em runtime).
- Sem alterar `deals-hubspot-table.tsx` (só o kanban).
- Nada de IA/LLM — heurística determinística.

## Validação manual

1. Abrir `/deals`, ver bordas laranja/azul discretas nos cards certos.
2. Passar mouse: tooltip explica o motivo.
3. Ativar "Foco em fechamento": cards quentes sobem, frios ficam esmaecidos.
4. Desativar: ordem e opacidade voltam ao normal, marcadores permanecem.
5. Dark mode: contraste ok.
