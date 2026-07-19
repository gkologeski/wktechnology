## Grupos Empresariais no TechFinance

Permitir que o workspace agrupe múltiplos CNPJs (legal_entities) em Grupos Empresariais, com relação N:N, e usar esses grupos como filtro consolidado em todas as telas financeiras — incluindo relatórios comparativos por CNPJ dentro do grupo.

### Fase 1 — Schema (migration)

Novas tabelas em `public`:

- `legal_entity_groups` — grupo empresarial.
  - Campos: `id`, `workspace_id`, `code` (opcional, único por workspace), `name`, `description`, `color`, `is_system` (para o grupo padrão "Todas as empresas"), `active`, `created_by`, `created_at`, `updated_at`.
- `legal_entity_group_members` — associação N:N.
  - Campos: `group_id`, `legal_entity_id`, `created_at`. PK composta `(group_id, legal_entity_id)`.

Regras:
- GRANT SELECT/INSERT/UPDATE/DELETE `authenticated`, ALL `service_role`.
- RLS: acesso apenas para membros do workspace (padrão já usado em `legal_entities`); somente admin do workspace pode escrever (via `has_workspace_role`/policy equivalente já usada em outras tabelas).
- Trigger `updated_at`.
- Backfill: criar 1 grupo `is_system=true`, code `ALL`, nome "Todas as empresas" por workspace com CNPJs, populando `legal_entity_group_members` com todos os `legal_entities` do workspace.
- Trigger em `legal_entities` (INSERT/soft-delete) para manter o grupo `is_system=true` sincronizado com todas as empresas ativas do workspace.

### Fase 2 — Server functions

Novo arquivo `src/lib/legal-entity-groups.functions.ts`:

- `listLegalEntityGroups()` → retorna grupos do workspace com `member_ids` e contagem de CNPJs.
- `upsertLegalEntityGroup({ id?, code, name, description, color, active })` — admin only; bloqueia edição de nome/code em grupos `is_system`.
- `deleteLegalEntityGroup({ id })` — admin only; bloqueia exclusão de grupos `is_system`.
- `setGroupMembers({ group_id, legal_entity_ids })` — admin only; bloqueia alteração em grupos `is_system`.

Extensão em `src/lib/legal-entities.functions.ts`:
- `resolveLegalEntityIds(selector)` — helper server-side que aceita `{ legalEntityId?: string, groupId?: string }` e retorna o array final de IDs a filtrar. Base para reuso nas outras server functions financeiras.

Ajuste em `src/lib/finance.functions.ts` (aditivo, não quebra chamadas atuais):
- Todas as listagens/agregações que hoje aceitam `legalEntityId` passam a aceitar também `groupId` (opcional). Quando `groupId` presente, resolvem para os IDs do grupo e aplicam `IN (...)`. Server functions afetadas: `listFinancialEntries`, `getFinancialSummary`, `getDreReport`, `getCashFlow`, `listCategories`, `listBankAccounts`, `listCostCentersWithTotals`, e agregados de dashboard.

### Fase 3 — UI: filtro consolidado

Atualização em `src/components/finance/legal-entity-select.tsx`:

- Componente passa a suportar dois modos: **Empresa** e **Grupo**.
  - Estrutura visual: um único `Select` agrupado em duas seções ("Grupos" e "Empresas"), como Linear/Attio. Item selecionado exibe badge "Grupo" ou "CNPJ".
- Hook `useLegalEntityFilter` estendido para persistir `{ kind: "entity"|"group"|"all", id?: string }` em `localStorage` (chave existente `finance.legalEntityId` migra para `finance.legalEntitySelection`) e no query param `?le=` / `?leg=`.
- Backward-compat: quando `kind==="entity"` continua enviando `legalEntityId`; quando `kind==="group"` envia `groupId`.
- Sync entre abas via `StorageEvent` (já existe).

Todas as telas que já usam `useLegalEntityFilter` passam a receber o seletor unificado, sem trocar chamadas — apenas passando `{ legalEntityId, groupId }` para as server functions.

### Fase 4 — Gestão de grupos (nova rota)

Nova rota `src/routes/_authenticated/settings.legal-entity-groups.tsx`, no mesmo padrão de `settings.legal-entities.tsx`:

- `PageHeader` com título "Grupos empresariais" e ação primária "Novo grupo".
- Tabela com: Nome (+ badge "Padrão" para `is_system`), Código, CNPJs (chips com nome/código truncados), Status, Ações (editar, excluir).
- Dialog de criar/editar: campos `code`, `name`, `description`, `color`, `active`, e um multi-select de CNPJs (reusando dados de `listLegalEntities`).
- Grupo `is_system` é apenas leitura para nome/code/members; permite editar cor/descrição.
- Loading, empty, error states seguindo padrão de `settings.legal-entities.tsx`.

Entrada no menu lateral de Configurações abaixo de "Empresas (CNPJs)".

### Fase 5 — Relatórios comparativos

Em `finance.dre.tsx` e `finance.cash-flow.tsx`, quando o filtro atual é um **Grupo**:

- Botão toggle "Consolidado | Comparativo".
- Modo Comparativo: tabela ganha colunas por CNPJ do grupo + coluna "Total". Server function retorna também o breakdown por `legal_entity_id` (novo campo opcional `groupBreakdown: true` no input).
- Preserva o layout existente quando o filtro é uma empresa única ou "Todas".

### Fase 6 — QA & validações

- `bun run typecheck` e build.
- Verificar RLS/GRANTs via `supabase--linter` após migration.
- Manual: criar grupo, associar 2 CNPJs, alternar seletor em DRE/A pagar/A receber/Fluxo de caixa/Dashboard, verificar persistência em `?leg=` + reload + nova aba, verificar comparativo, verificar bloqueios em grupo padrão.

### Fora de escopo (não implementar agora)

- Eliminação automática de transferências intra-grupo (você não marcou).
- Rateio automático entre CNPJs do grupo.
- Exportação de relatório comparativo para Excel/PDF.

### Detalhes técnicos

- Todas as políticas RLS seguem `owner_id`/`workspace_id` conforme padrão já vigente (evitando reintroduzir padrões marcados nas security memories anteriores).
- Nenhuma alteração em autenticação, schema fora dessas 2 tabelas, ou em módulos fora do TechFinance.
- Sem novas dependências npm.
