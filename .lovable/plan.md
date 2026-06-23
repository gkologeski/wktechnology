# Eliminar flicker do card ao soltar no kanban

## Causa

Na última iteração ativamos `refetchOnWindowFocus: true` na query `["deals", "list"]` em `src/routes/_authenticated/deals.tsx`. Ao soltar um card:

1. O `onDragEnd` faz `setQueryData` otimista (já reposiciona o card).
2. O drop devolve o foco para a janela/board, o que dispara o `refetchOnWindowFocus`.
3. A query re-busca a lista inteira e re-emite os dados, fazendo o card desmontar/remontar na nova coluna várias vezes — exatamente o "piscar com imagem de baixa qualidade" (o navegador reaproveita o layer GPU do transform do dnd-kit enquanto o React repinta).

O `refetchOnMount: "always"` (responsável por atualizar o kanban ao voltar para `/deals`) não causa o problema; apenas o focus refetch.

## Mudança

`src/routes/_authenticated/deals.tsx`, query `["deals", "list"]`:

- Remover `refetchOnWindowFocus: true`.
- Manter `refetchOnMount: "always"` (atualiza ao reentrar na rota).

Resultado: o drop usa apenas a atualização otimista, sem refetch concorrente, e o card transita suavemente para a nova fase. Erros de update continuam invalidando a query (`qc.invalidateQueries` no catch do `applyStageUpdate`), garantindo a reconciliação quando necessário.

## Fora do escopo

- Migrar para `DragOverlay` do dnd-kit.
- Mudar a animação/estilo do card.
- Alterar lógica de fases ganhas/perdidas.
