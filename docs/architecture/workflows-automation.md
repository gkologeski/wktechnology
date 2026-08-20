# Workflows, eventos e automação

## 1. Peças

| Tabela | Papel |
| --- | --- |
| `workflows` | definição: gatilho, condições, passos |
| `workflow_events` | fila de eventos a processar |
| `workflow_runs` | execuções (estado, log, erro) |
| `workflow_approvals` | passos que exigem aprovação humana |
| `workflow_subscriptions` | inscrições/gatilhos derivados |
| `workflow_action_templates` | modelos de ação reutilizáveis |
| `workflow_time_cursors` | cursores de gatilhos baseados em tempo |
| `domain_events` | barramento de eventos de domínio (auditoria + relatórios) |

Código em `src/lib/workflows/**` (motor em `*.server.ts`, API em
`*.functions.ts`) e UI em `src/components/workflows/**`.

## 2. Ciclo de vida

```text
mudança no banco (trigger) ou chamada explícita
  → enqueue_workflow_event(...)          → workflow_events
  → tick (cron a cada 15 min) ou wake
  → motor: casa gatilho, avalia condições (AND/OR aninhado)
  → workflow_runs: executa passos em ordem
      ↳ passo de aprovação → workflow_approvals (pausa)
      ↳ falha → log no run; erros repetidos vão para DLQ (move_to_dlq)
  → efeitos: e-mail, tarefa, atividade, atualização de campo, webhook,
             criação de registro, abertura de modal na UI
```

Gatilhos baseados em tempo usam `workflow_time_cursors` e o tick agendado.
`platform_cron_status` e `cron_run_logs` mostram saúde do agendador; o
reschedule é feito por `src/routes/api/public/hooks/reschedule-cron.ts`.

**Operação:** fila muito grande degrada o motor. Já houve caso de 5.077 eventos
redundantes travando o processamento — drenar eventos obsoletos é procedimento
válido, documentado em `docs/operations-runbook.md`.

## 3. Ações que afetam a UI

Duas ações não produzem efeito no servidor, mas registram **intenção** que o
cliente consome por polling e abre um diálogo:

- `create_survey_activity` — cria atividade do tipo `survey`; no lead, o
  `SurveyActivityDialog` (questionário de qualificação) abre automaticamente na
  etapa "Em qualificação".
- `open_deal_dialog` — ao mover o lead para "Oportunidade", abre o modal de
  criação de negócio já preenchido.

Padrão para novas ações desse tipo: gravar a intenção, o cliente detecta e
abre; nunca depender de push para correção do fluxo.

## 4. Workflow Builder

`src/components/workflows/**`:

- reordenação **drag-and-drop** de passos, inclusive entre níveis;
- `extra-fields-editor.tsx` — edita dinamicamente todos os campos do passo
  selecionado;
- `TokenInput` — variáveis como *pills* em campos de texto;
  `token-catalog.ts` lista tokens do gatilho e de entidades associadas
  (empresa, contato, responsável);
- `useReferenceLabels` + `FkPicker` (busca server-side em
  `src/lib/workflow-refs.functions.ts`) resolvem UUID → nome legível — nunca
  exibir hash ao usuário;
- condições em grupos recursivos AND/OR.

O builder é carregado de forma lazy (peso de bundle).

## 5. Automação fora do motor de workflows

- **Triggers SQL**: `auto_advance_lead_stage`,
  `auto_advance_lead_on_inbound_email`, `contact_link_company_by_domain`,
  `link_contacts_by_email_domain`, `recalc_deal_value`,
  `recalc_financial_entry`, `apply_sla_to_ticket`, `create_ticket_survey`,
  `people_*_sync_*`, `ats_*` (pipeline default, silver medalist, oferta ↔
  e-sign), `log_property_changes` (histórico de campos).
- **Fila de e-mail**: `enqueue_email` → `email_queue_dispatch` →
  `email_send_state` (com DLQ e supressão).
- **Sequências e cadências**: `sequences`, `sequence_enrollments`,
  `prospecting_cadences`, `ats_sourcing_sequences` (passos com atraso e
  condição de parada).
- **Dunning** financeiro: `dunning_policies`, `dunning_runs`.
- **Relatórios agendados**: `report_schedules`, `audit_exports`.
- **Scoring contínuo**: `scoring_rules`, `score_events`, `score_contributions`,
  `scoring_cursors`, `ml_scoring_models`, `ml_forecast_scores`.
- **Notificações**: `notifications`, `push_subscriptions`, lembretes de tarefa.

## 6. Convenção de eventos de domínio

Nome: `<módulo>.<área>.<verbo_no_passado>` — ex.: `ats.job.posted`,
`ats.candidate.hired`, `ats.dsar.requested`, `ats.consent.revoked`.
Emitir **sempre no servidor** (`recordAtsEvent` / `emitEvent`). Relatórios de
funil e workflows v2 consomem `domain_events`.

## 7. Checklist para automação nova

- [ ] Gatilho e condições definidos e testáveis com dado real.
- [ ] Passo idempotente (reprocessar o evento não duplica efeito).
- [ ] Falha registrada no run, com mensagem útil e sem PII.
- [ ] Efeito externo auditado; crédito contabilizado quando aplicável.
- [ ] Feature flag para rollout gradual quando houver risco.
- [ ] Token novo adicionado ao `token-catalog.ts` com rótulo em PT-BR.
- [ ] Evento novo documentado neste arquivo.
