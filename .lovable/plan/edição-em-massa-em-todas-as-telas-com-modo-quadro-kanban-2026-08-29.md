# Edição em massa em todas as telas com modo quadro (Kanban)

## Situação atual verificada

- `KanbanBoard` e `EntityBoard` já têm seleção de cards (`useBoardSelection`) e renderizam `GridBulkBar` quando `selectable` está ativo.
- Telas já cobertas: Leads, Negócios, Tickets, Contratos, Propostas, Serviços, Projetos, Tarefas de projeto, Faturas, Ofertas (ATS), Lançamentos financeiros, além de todas as listas genéricas via `EntityList`/`EntityBoard`.
- Lacuna 1 — `GridBulkBar` só habilita "Editar em massa" quando a tabela está em `BULK_EDIT_ENTITIES` **ou** quando recebe `bulkEditFields`. `KanbanBoard` e `EntityBoard` não expõem `bulkEditFields`, então telas cujas tabelas ficam fora do catálogo perdem a ação no quadro:
  - `people` (Pessoas) e `people_incidents` (Incidentes) — já passam `bulkEditFields` no grid, mas não no quadro.
  - `bug_reports` (Chamados internos) e `nfse_invoices` (NFS-e) — não passam em nenhum lugar.
- Lacuna 2 — o quadro de candidaturas dentro da vaga (`JobPipelineBoard`, em `src/components/ats/jobs/job-pipeline-board.tsx`) não tem seleção de cards nem barra de ações em massa, ao contrário dos outros quadros.

## O que será feito

1. Adicionar prop opcional `bulkEditFields` a `KanbanBoard` e `EntityBoard`, repassada a `GridBulkBar` (comportamento atual inalterado quando a prop não é informada).
2. Passar `bulkEditFields` nos quadros de Pessoas e Incidentes, reutilizando exatamente a mesma lista já usada no grid dessas telas (extraída para uma constante no próprio arquivo, sem duplicação).
3. Definir `bulkEditFields` para Chamados internos (status, prioridade) e para NFS-e apenas os campos seguros e editáveis; NFS-e permanece `readOnly` no movimento de etapa (status vem da integração), portanto nada que dependa do provedor será editável.
4. Habilitar seleção + ações em massa no `JobPipelineBoard`: checkbox por card, checkbox por coluna, `useBoardSelection` e `GridBulkBar` (tabela `ats_applications`, que já está no catálogo dinâmico), incluindo mover em massa de etapa reaproveitando o handler de etapa já existente na tela da vaga.
5. Preservar RBAC: as ações continuam guardadas por `canUpdate`/`canDelete` das telas e pela RLS; exclusões seguem por `reportBulkDelete`/`delete-guard`.

## Fora do escopo

- Nenhuma migration, alteração de RLS, GRANT, schema ou regra de negócio.
- Sem alteração no catálogo `get_entity_field_catalog` (evitamos migration usando `bulkEditFields`).
- Sem redesenho visual das telas nem mudança de funcionalidades existentes.

## Detalhes técnicos

- Arquivos previstos: `src/components/kanban/kanban-board.tsx`, `src/components/entity-board.tsx`, `src/routes/_authenticated/people.index.tsx`, `src/routes/_authenticated/people.incidents.tsx`, `src/routes/_authenticated/admin.bug-reports.tsx`, `src/routes/_authenticated/finance.nfse.tsx`, `src/components/ats/jobs/job-pipeline-board.tsx` e a tela da vaga que a consome (`src/routes/_authenticated/(ats)/jobs.$id.tsx`).
- Reuso obrigatório: `GridBulkBar`, `BoardCardCheckbox`, `useBoardSelection`, `BulkEditFieldsDialog`/`BulkEditDialog`.
- Invalidação de cache após cada ação segue o `invalidateKeys`/`onDone` já existente.

## Validações previstas

`bunx tsgo --noEmit`, `bun run lint` nos arquivos alterados, `bun run test` e smoke manual nos quadros afetados.

## Como validar manualmente

1. Abrir Pessoas, Incidentes, Chamados internos, NFS-e e a vaga (aba pipeline) no modo quadro.
2. Selecionar múltiplos cards (inclusive por coluna e com Shift).
3. Conferir a barra com Exportar, Editar em massa, Responsável (quando aplicável) e Excluir (quando permitido).
4. Aplicar uma edição e confirmar atualização imediata dos cards.
