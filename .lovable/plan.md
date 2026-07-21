# Workflows cross-módulo — plano faseado

## Situação atual (já entregue)

- `src/lib/notifications.functions.ts` migrado para `supabaseAdmin` nas leituras de `profiles.notification_preferences` (destravou GRANTs por coluna).
- Levantamento de schema das 13 tabelas alvo: identificadas divergências (algumas usam `workspace_id` sem `owner_id`; `products/recurring_plans` usam `active` em vez de `status`).

Nada além disso foi commitado ainda para a feature de workflows cross-módulo. As partes abaixo são o que falta.

## Escopo alvo

Habilitar workflows para disparar E agir sobre entidades de qualquer módulo:

- CRM já suportado: leads, contacts, companies, deals, tickets, ATS (5).
- Novas entidades: `projects`, `project_tasks`, `project_milestones`, `contracts`, `financial_entries`, `bank_payments`, `quotes`, `proposals`, `products`, `services`, `recurring_plans`, `subscription_invoices`, `customer_invoices`.

## Fases

### Fase 1 — Fundação de tipos e schemas (client-side, sem migração)

Arquivos:
- `src/lib/workflows/types.ts` — expandir `WorkflowEntity`, `ENTITY_LABELS`, `ENTITY_GROUPS` (grupos "Projetos", "Financeiro", "Comercial", "Contratos"), `ENTITY_FIELDS` (campos por entidade).
- `src/lib/workflows/schemas.ts` — expandir `EntityEnum`; adicionar ações genéricas `create_record` / `update_record` / `delete_record` com `table` (whitelist) + `values` (record).
- `src/lib/workflows/associations.ts` — mapeamento de FKs cross-módulo (ex.: `projects.company_id`, `contracts.deal_id`, `financial_entries.legal_entity_id`).

### Fase 2 — Engine (server-side, sem migração)

Arquivo: `src/lib/workflows/engine.server.ts`

- Atualizar `assignFieldFor` e `notificationLinkFor` para novas entidades.
- Implementar handlers `create_record` / `update_record` / `delete_record` com:
  - Whitelist de tabelas + resolução automática de `owner_id` (default: `ctx.ownerId`).
  - Suporte a tokens `{{campo}}` em qualquer valor.
  - Tabelas sem `owner_id` (ex.: `project_tasks`) recebem `workspace_id` derivado do pai.

### Fase 3 — Migração DB (aprovação necessária)

Uma única migração que:

1. Reescreve `public.enqueue_workflow_event()`:
   - Resolve `v_owner`: tenta `NEW.owner_id`; senão resolve via `NEW.workspace_id` → `workspaces.created_by`.
   - Detecção de `stage_changed` por entidade:
     - `projects.status`, `project_tasks.status_id`, `contracts.status`, `financial_entries.status`, `quotes.status`, `proposals.status`, `bank_payments.status`, `products.active`, `subscription_invoices.status`, `customer_invoices.status`.
2. Anexa triggers `AFTER INSERT/UPDATE` em cada uma das 13 tabelas com `tg_argv` correto.
3. Sem alterar RLS/policies.

### Fase 4 — UI Builder

Arquivo: `src/components/workflows/workflow-builder.tsx`

- Novos grupos no diálogo de seleção de entidade.
- Nova categoria "Registros (genérico)" na biblioteca de ações com `create_record` / `update_record` / `delete_record`.
- Reaproveita `ExtraFieldsEditor` e `TokenInput` já existentes para o mapa de valores.

### Fase 5 — Documentação e testes

- Atualizar `docs/backlog-pendencias.md` e `docs/operations-runbook.md` com as novas capacidades.
- Smoke: criar um workflow que, ao ganhar um `deal`, gera automaticamente um `financial_entry` (a receber) — valida trigger, resolução de owner, ação genérica e tokens.

## Riscos e decisões pendentes

- **Tabelas sem `owner_id`** (`project_tasks`, `project_milestones`, `bank_payments`, `customer_invoices`): dependem de resolução via `workspace_id`. Confirma o fallback `workspaces.created_by`?
- **Volume de eventos**: `financial_entries` gera muitos INSERTs (importação de extratos). Sugiro trigger com filtro `WHEN` para pular INSERTs em lote — precisa de flag em `source` para diferenciar.
- Sem alteração de RLS nesta feature; todas as ações executam via `supabaseAdmin` no engine, respeitando `owner_id` do run.

## Como validar manualmente após Fase 3

1. Habilitar um workflow em `financial_entries` (event=created) com ação `send_notification`.
2. Criar um lançamento manual em `/finance/entries`.
3. Verificar `workflow_events` e `workflow_runs` populados.

## Próximo passo recomendado

Aprovar as fases 1+2 (código puro, sem risco de banco) para eu executar juntas neste próximo turno. A migração da Fase 3 vai em turno separado para você revisar o SQL antes de rodar.
