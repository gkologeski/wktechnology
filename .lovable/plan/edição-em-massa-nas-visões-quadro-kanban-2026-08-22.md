# Edição em massa nas visões Quadro/Kanban

Hoje a edição em massa dinâmica (`GridBulkBar` + `BulkEditFieldsDialog`) existe apenas nas visões de Tabela/Grid. As visões Quadro/Kanban não têm seleção de cards. O objetivo é permitir selecionar vários cards no quadro e aplicar as mesmas ações em massa já disponíveis nos grids.

## Comportamento proposto

- Cada card do quadro ganha um checkbox (visível no hover/foco, sempre visível quando já há seleção ativa), sem alterar o clique de abrir o registro nem o drag-and-drop.
- Cabeçalho da coluna ganha ação "Selecionar coluna" (marca/desmarca todos os cards visíveis daquela etapa).
- Com 1+ cards marcados, aparece a mesma barra flutuante `GridBulkBar` já usada nos grids, com: Editar em massa (diálogo dinâmico por catálogo de campos), Atribuir responsável, Criar atividade (quando aplicável), Exportar CSV e Excluir com confirmação por contagem.
- `Shift+clique` seleciona a faixa de cards entre o último marcado e o atual dentro da mesma coluna.
- Após concluir qualquer ação: seleção limpa, toast de resultado e recarga automática dos dados do quadro.
- Permissões: os botões seguem os mesmos `canUpdate`/`canDelete` já usados na tela; RLS continua sendo a fonte de verdade (deleções/updates sem efeito viram aviso de permissão).
- Acessibilidade: checkbox com rótulo acessível ("Selecionar <título do card>"), foco visível, contagem anunciada na barra; responsivo e dark mode preservados.

## Cobertura

Genérico (via componentes compartilhados):
- `KanbanBoard` — Propostas, Contratos, Projetos, Tarefas de projeto, Serviços, Pessoas, Incidentes, Ofertas (ATS), Faturas, NFS-e, Lançamentos financeiros, Chamados internos (bug reports).
- `EntityBoard` — quadros das listas genéricas de entidades (`entity-list`).
- `DealsBoard` — quadro de Negócios.
- `TicketsBoard` — quadro de Chamados.

Quadros cuja tabela não está no catálogo de edição em massa (`BULK_EDIT_ENTITIES`) continuam com seleção + exportar/atribuir/excluir, mas sem o botão "Editar em massa" — igual à regra atual dos grids.

## Detalhes técnicos

1. Novo hook leve `src/components/kanban/use-board-selection.ts` reaproveitando a API de `use-grid-selection` (`selectedIds`, `toggleOne`, `toggleMany`, `clear`), sem a parte de "selecionar todos os filtrados" (o quadro já carrega o conjunto visível).
2. `KanbanBoard`: novas props opcionais `selectable`, `selectedIds`, `onToggle(id, opts)`, `onToggleColumn(ids)`. Renderiza o checkbox no card e a ação de coluna. Sem essas props, comportamento atual inalterado.
3. `EntityBoard`, `DealsBoard`/`DealsBoardCard`, `TicketsBoard`/`TicketCard`: mesmas props opcionais; o checkbox intercepta o clique (`stopPropagation`) para não abrir o drawer/detalhe.
4. Novo wrapper `src/components/kanban/board-bulk-bar.tsx` que monta `GridBulkBar` a partir das linhas selecionadas do quadro (tabela, `entityLabel`, `assignColumn`, `activityEntity`, `onDone` → invalidação das chaves já usadas pela tela).
5. Nas telas listadas, ligar o hook + wrapper reutilizando as mesmas chaves de invalidação e flags de permissão que a visão de Tabela já usa. Nenhuma alteração em schema, RLS, server functions ou regra de negócio.
6. Validações: `bun run typecheck`, `bun run lint`, `bun run test`.

## Fora de escopo

- "Selecionar todos os resultados do filtro" no quadro (o quadro é limitado ao conjunto carregado).
- Mover vários cards de etapa por drag-and-drop simultâneo (a mudança de etapa em massa continua possível pelo diálogo de edição em massa).
