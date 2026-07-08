# Workflows — Implementação completa (Fases 1–5)

Escopo aprovado: todas as 5 fases entram. Execução incremental, uma fase por vez, cada uma validada antes de avançar.

## Fase 1 — Ações "Criar entidade" (crítica)

Novas ações no engine + builder + validador:
- `create_lead` — first_name, last_name, email?, phone?, company_name?, source?, owner_id?
- `create_contact` — first_name, last_name, email?, phone?, company_id?, owner_id?
- `create_company` — name, domain?, industry?, owner_id?
- `create_deal` — name, value?, currency?, pipeline_id?, stage_id?, owner_id?, contact_id?, company_id?
- `create_ticket` — subject, description?, priority?, pipeline_id?, assignee_id?, contact_id?
- `create_task` — subject, body?, due_in_days?, assignee_id? (atalho tipado sobre `create_activity`)

Cada ação suporta **mapping via placeholder** `{{field.xxx}}` resolvido pelo engine antes do insert. `owner_id` herda do workflow por padrão.

## Fase 2 — CRM avançado

- `copy_field_from_association` — copia valor de registro associado (ex: `company.industry` → `deal.industry`).
- `associate_records` / `disassociate_records`.
- `clear_field`, `increment_field`.
- `send_email` (usa `email_templates` + `email_messages`).
- `send_whatsapp` (usa `wa_templates` + fila `whatsapp_messages`).

## Fase 3 — Fluxo avançado

- `switch_by_value` — múltiplos cases + default.
- `branch_multi` — até N ramos paralelos com filtros próprios.
- `delay_until_date` — espera até campo tipo data (± offset).
- `goal` / `exit_criteria` — remove enrollment ao atingir. Novo `goal_filters` no workflow.

## Fase 4 — Governança ✅

- **Draft vs. publicado**: colunas `workflows.status`, `published_version`, `draft_actions`, `draft_trigger`, `draft_goal_filters`, `last_published_at`. Editor salva sempre em rascunho; "Publicar" copia para produção e incrementa versão. Engine só executa `status='published'`.
- **Testar com registro** — dry-run em memória (walk das ações + resolução de filtros no snapshot), registrado como `workflow_runs.is_test=true` para aparecer no histórico do registro.
- **Enrollment history por registro** — `workflow_runs.entity_id`+`entity` indexado; server fn `listRecordEnrollments` pronto para plugar no record-layout.
- **Bulk enroll** ao publicar — server fn `bulkEnrollWorkflow` enfileira eventos sintéticos `created` para registros que batem no filtro do gatilho e chama o tick.

## Fase 5 — Avançado

- `approval_step` — pausa run, cria notificação, retoma ao decidir. Nova tabela `workflow_approvals`.
- `custom_code` — JS server-side sandbox restrito, timeout 5s, apenas admins. Risco documentado; se sandbox inviável no Worker, restringe a DSL limitada.
- `format_data` — upper/lower/trim/date_add/date_format/number_round/template_string em variáveis do run.
- `send_slack` / `send_teams` — via `slack_integrations` existente + connector Teams.
- **Triggers baseados em tempo** (novo — HubSpot: "time-based enrollment"):
  - `time_since_field` — dispara N minutos/horas/dias após valor de campo data (ex: `created_at + 7d`, `last_activity_at + 30d`, `expected_close_date - 3d`).
  - `no_activity_for` — dispara quando registro fica N dias sem atividade (nenhuma linha nova em `activities` para aquele `entity_id`).
  - `stuck_in_stage_for` — dispara quando registro fica N dias na mesma stage (usa `stage_entries.entered_at`).
  - `field_unchanged_for` — dispara quando campo não muda por N dias (usa `property_history`).
  - Implementação: cron `workflows-time-triggers-tick` (a cada 15 min) varre workflows com trigger temporal e enfileira eventos sintéticos em `workflow_events` para o tick regular processar. Novo tipo de trigger `time_based` com config `{ kind, field?, amount, unit }` além dos `event`s atuais.

## Detalhes técnicos

**Schema (uma migração por fase):**

- Fase 1: sem migração; extensão do JSON `actions` + validador + engine.
- Fase 3–4: `workflows` ganha `status`, `published_version`, `draft_actions jsonb`, `goal_filters jsonb`.
- Fase 4: `workflow_runs` ganha `entity_id uuid` indexado (verificar antes).
- Fase 5:
  - Nova tabela `workflow_approvals (id, run_id, workflow_id, requested_by, approver_user_id, status, decided_at, comment)` + GRANTs + RLS.
  - `workflows.trigger` passa a aceitar variante `{ type: 'time_based', kind, field?, amount, unit, filters[] }` (retrocompatível).
  - Cron novo: `SELECT cron.schedule('workflows-time-triggers-tick', '*/15 * * * *', ...)` chamando `/api/public/hooks/workflows-time-triggers-tick` com `apikey`.
  - Tabela auxiliar `workflow_time_cursors (workflow_id, entity_id, last_fired_at)` para não redisparar.

**Arquivos impactados:**

- `src/lib/workflows/types.ts` — novos tipos de ação e triggers, categorias, labels.
- `src/lib/workflows/engine.server.ts` — handlers por tipo, resolver `{{field.x}}`/`{{ctx.x}}`.
- `src/lib/workflows.functions.ts` — Zod schemas; novas fns `publishWorkflow`, `testWorkflow`, `bulkEnroll`, `decideApproval`, `listRecordEnrollments`.
- `src/components/workflows/workflow-builder.tsx` — forms por tipo, toggle Draft/Publicado, botão Testar, seletor de trigger temporal.
- `src/components/workflows/workflow-runs-list.tsx` — status `waiting_approval`, `waiting_until`.
- Novo `src/components/workflows/record-enrollments.tsx`.
- Novo `src/lib/workflows/template-resolver.server.ts`.
- Novo `src/routes/api/public/hooks/workflows-time-triggers-tick.ts`.

**Segurança:**

- Ações `create_*` respeitam `requireTool(userId, "manage_workflows")` na config; owner do registro criado = owner do workflow (RLS preservada).
- `custom_code` restrito a admin; sandbox via lib compatível com Worker ou DSL limitada.
- Cron temporal usa `apikey` no header (padrão do projeto).

**Validação por fase:**

- `bunx tsgo --noEmit`
- Testar cada ação no builder + "Rodar agora"
- Verificar `workflow_runs` e log
- Fase 4: editar draft não afeta runs ativas
- Fase 5: fluxo aprovação end-to-end; triggers temporais disparando no horário certo sem duplicar

## Ordem de execução

1. Fase 1
2. Fase 2
3. Fase 3
4. Fase 4
5. Fase 5 (triggers temporais como último item — dependem de cron novo)

## Fora do escopo

- A/B testing de workflow.
- Alterações em RLS/auth/schemas fora do necessário.
- Redesign visual das telas existentes.
