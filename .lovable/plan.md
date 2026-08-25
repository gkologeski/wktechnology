# Edição em massa no Kanban

## Objetivo

Permitir editar, excluir, criar atividade e mudar de estágio múltiplos cards selecionados na visualização em quadro (Kanban), usando a mesma seleção e os mesmos campos de edição em massa já disponíveis na lista.

## Situação atual verificada

- `EntityList` já suporta edição em massa na lista via `BulkActionBar`, `BulkEditDialog`, `BulkCreateActivityDialog`, `ConfirmCountDialog` e `bulkEditFields`.
- O Kanban usa `src/components/kanban/use-board-selection.ts` e `kanban-board.tsx`.
- A seleção múltipla de cards no Kanban já existe.
- A barra de ações em massa e os diálogos correspondentes ainda não estão integrados ao Kanban.

## O que será feito

1. Reutilizar os componentes de ação em massa existentes (`BulkActionBar`, `BulkEditDialog`, `BulkCreateActivityDialog`, `ConfirmCountDialog`) dentro do `KanbanBoard` quando houver cards selecionados.
2. Adicionar ação "Mover para estágio" na barra de ações em massa do Kanban, permitindo escolher a coluna/estágio destino.
3. Garantir que `bulkEditFields` seja passado do `EntityList` para o `EntityBoard`/`KanbanBoard` e usado pelo `BulkEditDialog`.
4. Manter a integração com `use-board-selection`: limpar seleção após ação bem-sucedida e invalidar o cache da query da entidade.
5. Preservar RBAC: ações só aparecem quando o usuário tem permissão; usar `<Can>` ou verificação equivalente, seguindo o padrão do `EntityList`.

## Detalhes técnicos

- Arquivos principais: `src/components/kanban/kanban-board.tsx`, `src/components/entity-list.tsx`, `src/components/entity-board.tsx`.
- Reutilizar `bulkUpdateEntity` de `src/lib/grid/bulk-edit.functions.ts` para edição de campos.
- Reutilizar `reportBulkDelete` e `deleteRowGuarded` para exclusão em massa.
- Reutilizar `bulkCreateActivity` (server function) para criação de atividade em massa.
- Para mudança de estágio, usar `bulkUpdateEntity` atualizando o campo definido em `boardStageField`.
- Sem migration, sem alteração de RLS/schema e sem mudança de regra de negócio.

## Como validar

1. Abrir uma lista com visualização Kanban (ex: leads, negócios).
2. Selecionar múltiplos cards.
3. Confirmar que a barra de ações em massa aparece com as opções: Editar, Excluir, Criar atividade, Mover para estágio.
4. Testar cada ação e confirmar que o cache é invalidado e os cards atualizam.
5. Rodar `bun run typecheck`, `bun run lint` e `bun run build:dev`.

## Riscos

- A barra de ações pode conflitar com o drag-and-drop do Kanban quando cards estão selecionados.
- Mudança de estágio em massa pode disparar muitas atualizações simultâneas; usar batch via `bulkUpdateEntity`.
- Reutilizar `bulkEditFields` pode expor campos que não fazem sentido no contexto de quadro; validar com o usuário se necessário.
