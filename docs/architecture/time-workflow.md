# TechProjects — Ciclo 3: modelos, alocações, apontamento, cronômetro, aprovação e fechamento

Migrations `0173_techprojects_cycle3_time_foundation.sql` e `0174_techprojects_cycle3_time_workflow.sql`
(aditivas). Prova isolada: `bash tests/sql/time-workflow-isolated.sh drizzle/migrations/0173_*.sql drizzle/migrations/0174_*.sql`.

## Peças

| Tema                                       | Banco                                                                                                                                                                                                       | Servidor                                                   | Tela                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Política versionada                        | `project_time_policies`, `project_time_policy_get/save`                                                                                                                                                     | `time-governance.functions.ts`                             | `/projects/settings/time`                               |
| Modelos por serviço                        | `project_delivery_templates`, `_versions`, `_services`, `project_delivery_template_save/suggest/apply`                                                                                                      | idem                                                       | `/projects/settings/time`, `/projects/$id/horas`        |
| Aprovadores, gestor operacional, delegação | `project_time_approvers`, `project_time_approver_set/revoke`, `project_time_can_approve`, `project_time_has_approver`                                                                                       | idem                                                       | `/projects/$id/horas`                                   |
| Alocação com vigência e capacidade         | colunas novas em `people_allocations` + gatilho de capacidade (justificativa acima da política)                                                                                                             | —                                                          | TechPeople (existente)                                  |
| Jornada                                    | `people.work_schedule` (segundos por dia da semana); nula = **não configurada**, nunca 8 h presumidas                                                                                                       | `time-metrics.server.ts`                                   | Minhas Horas, Timesheet                                 |
| Apontamento                                | `project_time_entries` (+ `entry_kind`, `duration_seconds`, `timezone`, `revision`, `review_flags`, `submission_id`, `period_closing_id`, `client_acceptance_id`) e gatilho `project_time_entries_validate` | `time-tracking.functions.ts`                               | Apontar horas                                           |
| Cronômetro                                 | `project_timer_sessions` (um ativo por pessoa/workspace) e `project_timer_segments` (trabalho, pausa paga, pausa não paga)                                                                                  | `time-workflow.functions.ts`                               | widget (oculto no layout por decisão anterior), My Work |
| Envio e aprovação                          | `project_timesheet_submissions/_items`, `project_timesheet_preview/submit/withdraw/decide`, `project_time_reopen_approval`, `project_time_pending_for_me`                                                   | `time-workflow.functions.ts`, `time-approval.functions.ts` | Minhas Horas, Timesheet, Revisão de Horas               |
| Aceite do cliente                          | `project_client_acceptances`, `project_client_acceptance_record/void`                                                                                                                                       | `time-governance.functions.ts`                             | `/projects/$id/horas`                                   |
| Fechamento                                 | `project_period_closings`, `project_period_close_preview/close/reopen` + permissões `techprojects.timesheet_closing.manage.workspace` e `techprojects.timesheet_reopen.manage.workspace`                    | idem                                                       | `/projects/$id/horas`                                   |
| Jibble sem horário                         | `project_jibble_hour_classify/preview/materialize`                                                                                                                                                          | idem                                                       | Conciliação › Horas sem horário                         |

## Regras

- **Situação de aprovação só muda pelo fluxo.** Sessão de usuário comum não grava `status`, `approved_*`, `submission_id`, `period_closing_id` etc.; os RPCs ligam `app.project_time_workflow` só dentro da transação. Importadores continuam com `app.clockify_import`.
- **Editar depois do envio** volta o apontamento a rascunho, sobe `revision` e invalida o item pendente; o aprovador nunca decide dado antigo (`DECIDE_STALE`).
- **Envio atômico e versionado:** a prévia devolve um hash (ids+revisões); o envio confere o hash sob trava por pessoa. Duas abas enviando juntas geram uma versão.
- **Aprovação:** só aprovador nomeado (ou delegado vigente) do projeto/profissional; deny e membership inativo vencem; autoaprovação proibida por padrão (e, mesmo liberada, exige ser aprovador). Projeto sem aprovador bloqueia o envio com pendência — admin não aprova automaticamente.
- **Lançamento por duração** não inventa horário; recebe `review_flags = {unpositioned}`. Acima do limite diário vira `daily_excess`. Cronômetro sobreposto vira `overlap` (grava, não descarta).
- **Cronômetro:** ações idempotentes por versão (`TIMER_STALE` quando outra aba mudou). Finalizar divide na meia-noite do fuso da sessão com UTC exato; trecho na troca de horário de verão sem horário local exibível fica `dst_ambiguous` (UTC preservado). Pausa paga é presença, não hora de projeto.
- **Aceite do cliente:** opcional por projeto; registro manual por aprovador com evidência. Não há portal nem e-mail.
- **Fechamento** congela aprovados (retrato em `entries_snapshot`), bloqueia edição/exclusão via UI/API/SQL comum, não é fatura nem pagamento. Reabrir exige permissão específica e motivo. Importados bloqueados (`locked`+`import`) ficam fora e nunca contam como aprovados.
- **Escopo de leitura:** política restritiva `ptime_scope_select` — próprios, visão completa (admin/permissão de workspace) ou projetos/profissionais que a pessoa lidera.
- **Jibble sem horário:** só `candidate` (dia sem intervalo do Jibble, sem apontamento de outra fonte, pessoa e projeto mapeados) pode virar apontamento, por ação de admin com justificativa, como `locked`+`import` com origem `jibble:hour_entry:<id>`.

## Pendências conhecidas

- Feriados e ausências não existem como cadastro no TechPeople: não são descontados da meta.
- O widget do cronômetro segue oculto no layout (decisão anterior); o cronômetro do servidor está pronto.
- Política WK usa os padrões (nenhuma versão salva); nenhum aprovador nomeado ainda nos projetos WK.
