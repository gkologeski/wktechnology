# Tornar a barra de ações em massa visível nos quadros Kanban

## Diagnóstico (confirmado por leitura do código)

A edição em massa no Kanban de Negócios **existe e está funcional** (`deals` está em `BULK_EDIT_ENTITIES` e `DealsBoard` renderiza `GridBulkBar` quando há seleção). O problema é de layout:

- `src/components/bulk-action-bar.tsx` usa `sticky top-2`, o que só funciona bem no topo da área de rolagem.
- Nos quadros especializados, a `GridBulkBar` é renderizada **depois** do `DndContext`/`KanbanScrollContainer`, ou seja, abaixo de todas as colunas. Como as colunas ocupam a altura da tela, a barra fica fora da área visível — foi o que aconteceu no print (2 cards selecionados, barra fora da tela).

## Escopo

Mover a `GridBulkBar` para **acima** do quadro (antes do `DndContext`/`KanbanScrollContainer`) nos quadros especializados que ainda a renderizam no final:

1. `src/components/deals/deals-board.tsx`
2. `src/components/leads/leads-board.tsx`
3. `src/components/tickets/tickets-board.tsx`
4. `src/components/ats/jobs/job-pipeline-board.tsx`

Os quadros genéricos (`KanbanBoard`, `EntityBoard`) serão revisados e ajustados da mesma forma se também renderizarem a barra ao final.

Sem mudanças de schema, RLS, permissões ou lógica de negócio — apenas posição no JSX.

## Validação

- `bunx tsgo --noEmit`
- ESLint dos arquivos alterados
- `bun run test`
- Smoke manual: em /deals (Quadro), selecionar 2 cards e confirmar a barra visível no topo com "Editar em massa"

## Validação manual pelo usuário

Em Negócios → modo Quadro, marcar cards e conferir a barra no topo do quadro com Exportar, Editar em massa, Responsável, Criar atividade e Excluir.
