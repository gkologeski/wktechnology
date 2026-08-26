# Plano: corrigir edição/movimentação em massa no Kanban de Negócios

## Objetivo
Permitir que, no Kanban de Negócios, ao selecionar 2 ou mais negócios e arrastar um deles para outra etapa, todos os negócios selecionados sejam movidos juntos.

## Diagnóstico confirmado
- A tela `/deals` renderiza o Kanban com `DealsBoard` e `selectable` habilitado.
- `DealsBoard` já mostra seleção de cards e a barra de ações em massa (`GridBulkBar`).
- O drag-and-drop atual em `DealsBoard` usa apenas `e.active.id`, então move somente o card arrastado, mesmo quando há múltiplos cards selecionados.
- O componente genérico `KanbanBoard` também possui seleção em massa, mas `DealsBoard` usa uma implementação própria para negócios.

## Implementação proposta
1. Ajustar o `DealsBoard` para calcular o lote de movimentação:
   - Se o card arrastado estiver selecionado, mover todos os cards selecionados.
   - Se o card arrastado não estiver selecionado, manter o comportamento atual e mover apenas ele.
2. Aplicar atualização em massa para a nova etapa:
   - Atualizar `stage_id` para a etapa destino.
   - Atualizar a coluna legada `stage` quando a etapa destino for compatível com os valores legados ou tiver tipo `won`/`lost`.
   - Invalidar as queries de negócios ao final.
3. Tratar bloqueio por RLS/permissão de forma clara:
   - Usar `.select("id")` após o update para saber quantos registros foram realmente alterados.
   - Exibir aviso quando nenhum ou apenas parte dos negócios selecionados for atualizado.
4. Manter comportamento especial para etapa perdida:
   - Se a etapa destino for do tipo `lost`, abrir o diálogo de motivo somente para o card arrastado nesta correção, preservando o fluxo atual e evitando perda de contexto para múltiplos registros.
   - A movimentação em massa para etapas não-perdidas será corrigida agora.

## Arquivos a alterar
- `src/components/deals/deals-board.tsx`

## Validação
- Verificar no código que o Kanban continua renderizando a barra de ações em massa.
- Validar manualmente no preview:
  - selecionar dois negócios na mesma coluna;
  - arrastar um selecionado para outra etapa;
  - confirmar que ambos mudam de coluna após atualização;
  - confirmar que arrastar um card não selecionado move somente ele.
- Rodar validação focada disponível sem executar mudanças fora do escopo.

## Fora do escopo
- Alterar permissões/RLS.
- Criar novo schema ou migration.
- Redesenhar o Kanban.
- Implementar movimentação em massa para etapa `lost` com motivo compartilhado, a menos que seja pedido depois.
