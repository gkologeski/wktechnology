## Etapas

### 1. Ajustar e aplicar a migração

- Na migração em rascunho, trocar o trecho que cria `tickets.assigned_to` por: backfill `assignee_id = owner_id` onde está vazio, gatilho de default na criação e inclusão de `assignee_id` no predicado "registro é meu" das políticas de `tickets`.
- Manter tudo aditivo: nenhuma coluna removida, renomeada ou com tipo alterado.
- Aceitar o rascunho — só nesse momento a migração é aplicada ao banco do projeto.

### 2. Chamados (TechService)

- `src/components/tickets/types.ts`: manter `owner_id` e `assignee_id`; adicionar rótulos claros (Criador × Responsável).
- `src/routes/_authenticated/tickets.tsx`: filtros "Meus" / "Não atribuídos" e o seletor de responsável passam a resolver por `assignee_id ?? owner_id` (via helper de `src/lib/entity/responsible.ts` com a lista de colunas do chamado).
- `src/components/tickets/ticket-card.tsx` e `tickets-board.tsx`: exibir sempre o nome do responsável (nunca UUID) com `AssigneeCell`; card mostra "Criado por" apenas no detalhe/sidebar.
- Edição em massa de responsável em chamados grava `assignee_id`.

### 3. Hunting (TechHire)

- `src/routes/_authenticated/(ats)/hunting/captures.tsx`: coluna/badge de Responsável do candidato usando `responsibleId` (`assigned_to ?? owner_id`) e `AssigneeCell`.
- Filtro de responsável e ação em massa "Atribuir responsável" no quadro/lista de capturados, gravando `assigned_to` em `ats_candidates`.
- Quem capturou (`captured_by`) fica exibido como informação de origem, separado de Responsável.

### 4. Revisão e validação

- `bun run typecheck:inc`, `bun run lint`, `bun run test`.
- Conferência manual: em Chamados filtrar "Meus" e atribuir responsável; em Hunting → Capturados atribuir responsável a 2+ candidatos em massa.

## Fora de escopo

Nenhuma mudança de RLS além do predicado de escopo próprio já previsto, nenhuma alteração em regra de negócio de SLA, e nenhuma remoção de funcionalidade existente.
