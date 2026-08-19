# Grids: Propostas/Ofertas + Fase 2 (People)

Continuação do padrão de grids (Fase 0 já concluída: `use-grid-selection`, `GridBulkBar`, `BulkAssignDialog`). Escopo: só camada de apresentação/listagem. Nenhuma mudança de schema, RLS, permissões ou regra de negócio.

## 1. Propostas/Contratos (`/proposals`)

Hoje a tela é uma lista de cards sem seleção. Vira grid no padrão:

- Substituir a lista de cards por uma tabela (`Table`) com colunas: seleção, Título, Versão, Valor, Status, Responsável, ações.
- Coluna de checkbox por linha + checkbox no header (página atual) e "Selecionar todos" os registros filtrados.
- `GridBulkBar` com: exportar CSV, editar em massa (Status), definir responsável (`assigned_to`), excluir com confirmação por contagem.
- Manter tudo que já existe: filtro de responsável, wizard de importação de contrato, criação de novo contrato, link para o detalhe, exclusão individual.
- Gates de UI por permissão (update/delete de propostas), mantendo RLS como fonte de verdade.

## 2. Fase 2 — People

Telas migradas para o mesmo padrão, uma a uma:

1. **Pessoas** (`/people`) — já é tabela: adicionar seleção, "selecionar todos", `GridBulkBar` com edição em massa de status, tipo de contratação, departamento/cargo (conforme campos existentes), responsável, exportação e exclusão.
2. **Documentos a vencer** (`/people/documents`) — seleção + exportar CSV e exclusão em massa; sem edição em massa (campos derivados de validade).
3. **Benefícios** (`/people/benefits`) — seleção + exportar CSV, edição em massa (ativo/inativo, provedor) e exclusão.
4. **Incidentes** (`/people/incidents`) — seleção + exportar CSV, edição em massa (status, severidade) e exclusão.

Em todas: preservar filtros/abas atuais, estados de carregando/vazio, links para a ficha da pessoa, responsividade e dark mode.

## Detalhes técnicos

- Reutilizar `useGridSelection(rows)` e `GridBulkBar` (`table`, `ids`, `rows`, `entityLabel`, `bulkEditFields`, `assignColumn`, `canUpdate`, `canDelete`, `onDone`).
- `totalMatching` = tamanho do conjunto filtrado em memória quando o filtro é client-side; `onSelectAll` marca todos os ids filtrados.
- `assignColumn` só onde a tabela tem `assigned_to` (`proposals`, `people`); nas tabelas filhas de People passar `assignColumn={null}`.
- `onDone` invalida as queries da tela (mesmo `queryKey` já usado).
- Permissões via `usePermissions().canAny([...])`, seguindo as chaves já usadas nas telas correspondentes.

## Validação

`tsgo` (typecheck), lint/format e verificação manual: seleção por linha, selecionar todos, editar em massa, responsável, exportar e excluir em cada tela.

## Fora de escopo

Editor de colunas, filtros AND/OR salvos, views salvas, edição inline e paginação server-side.
