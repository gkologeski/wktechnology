## Item 6 — Workflows engine + builder visual

Hoje a tabela `workflows` existe mas não roda nada: a página é só um CRUD de JSON cru. Vou entregar três coisas: (1) captura de eventos via triggers no Postgres, (2) executor server-side processado por pg_cron, (3) builder visual substituindo a tela atual.

### Modelo de eventos

Migration:
- `workflow_events(id, entity, entity_id, owner_id, event_type, before jsonb, after jsonb, processed_at, created_at)` — fila append-only.
- `workflow_runs(id, workflow_id, event_id, status, started_at, finished_at, error, log jsonb)` — uma execução por (workflow × evento).
- Triggers `AFTER INSERT/UPDATE` em `leads`, `contacts`, `companies`, `deals` inserindo em `workflow_events` com `event_type ∈ {created, updated, stage_changed}` (stage_changed só para deals quando `stage_id` muda).
- Índice em `(processed_at) WHERE processed_at IS NULL`.
- RLS owner em ambas as tabelas novas.

### Trigger DSL (formato `trigger` na tabela `workflows`)

```json
{
  "event": "created" | "updated" | "stage_changed",
  "filters": [{ "field": "source", "op": "eq", "value": "site" }]
}
```

Operadores suportados: `eq`, `neq`, `in`, `contains`, `gt`, `lt`, `changed_to` (só faz sentido em `updated`/`stage_changed`).

### Action DSL (array `actions`)

Tipos suportados nesta entrega:
- `set_field` `{field, value}` — update no próprio registro
- `create_activity` `{type, title, body, due_in_days?}` — insere em `activities`
- `add_to_sequence` `{sequence_id}` — placeholder que apenas grava log (executor real vem no item 7)
- `send_notification` `{title, body}` — insere em `notifications` se a tabela existir; senão log
- `assign_to` `{user_id}` — set `owner_id`
- `webhook` `{url, payload?}` — POST JSON

Suporte a tokens `{{field}}` em strings, resolvendo contra `after`.

### Executor

`src/lib/workflows/engine.server.ts`:
- `processEvent(eventId)` — carrega evento, lista workflows ativos com `entity == event.entity`, avalia trigger+filters, para cada match cria `workflow_runs` e executa ações sequencialmente, gravando log por step. Marca `processed_at` ao final.
- Idempotência: `unique(workflow_id, event_id)` em `workflow_runs`.

Endpoint cron: `src/routes/api/public/hooks/workflows-tick.ts`:
- Pega até 50 eventos com `processed_at IS NULL`, processa um por um (try/catch isolado).

pg_cron a cada 1 minuto chamando o hook.

### UI — Builder visual

Substituir `src/routes/_authenticated/settings.workflows.tsx`:
- Lista de workflows (cards com nome, entidade, on/off, contagem de runs últimas 24h).
- Drawer/dialog "Editar workflow" com:
  - **Quando** — entidade + tipo de evento (select)
  - **Se** — filtros (linhas dinâmicas field/op/value); fields populados conforme entidade
  - **Então** — lista ordenada de ações; cada ação tem form específico por tipo (`set_field`, `create_activity`, etc.) em vez de JSON cru
  - Toggle ativo + nome
- Aba "Execuções recentes" mostrando últimas 20 entradas de `workflow_runs` com status e log expandível.

Componente em `src/components/workflows/workflow-builder.tsx`. Sem libs novas.

### Entregáveis (arquivos)

1. Migration: `workflow_events`, `workflow_runs`, triggers em 4 tabelas, índices, RLS, registro pg_cron.
2. `src/lib/workflows/engine.server.ts` — executor.
3. `src/lib/workflows/types.ts` — tipos do DSL.
4. `src/lib/workflows.functions.ts` — `listWorkflows`, `saveWorkflow`, `deleteWorkflow`, `listRecentRuns`, `runEventNow` (debug).
5. `src/routes/api/public/hooks/workflows-tick.ts` — endpoint cron.
6. `src/routes/_authenticated/settings.workflows.tsx` — nova UI.
7. `src/components/workflows/workflow-builder.tsx` — drawer/builder visual.
8. `src/components/workflows/workflow-runs-list.tsx` — execuções recentes.
9. Atualizar `docs/roadmap.md` marcando item 6 ✅.

### Fora do escopo desta entrega

- Triggers temporais ("3 dias depois de…") — entra com Sequences (item 7).
- Branching/if-else dentro das ações — sequencial linear por enquanto.
- Versionamento de workflows.

Após sua validação, sigo para o item 7 (Sequences executor) reusando o mesmo executor.
