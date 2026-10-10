# Ciclo 10 — Integridade multiworkspace e matriz SQL de permissões

Escopo: frentes 1 e 2 do plano de 16 e o pré-requisito de 13/14 revelado na auditoria (tenant
fixo). Preview apenas; nada publicado; nenhum envio; nenhum dado de cliente alterado; nenhuma
sessão de terceiro. Tudo abaixo vale para o banco **isolado fiel** — não substitui a validação
não-admin no banco real, que continua pendente e bloqueia publicação.

## 1. O risco

81 colunas `workspace_id` têm `DEFAULT '184b9435-…'::uuid` (tenant original). O DEFAULT é aplicado
**antes** dos gatilhos BEFORE, então o ramo "workspace nulo → `default_workspace_for_user`" de
`set_workspace_on_insert` nunca roda. Consequências:

- **Usuário de outro tenant** sem `workspace_id` explícito: gravação recusada (42501) — falha clara, mas quebra o app fora do tenant original.
- **Job/serviço sem sessão** (`auth.uid()` nulo) sem `workspace_id`: gravação **aceita no tenant original** — vazamento silencioso.
  Hoje há 1 workspace, então o risco é latente.

## 2. Funções corrigidas (migração `0101_workspace_from_source_entity`)

| Função                                            | Antes                                                                | Depois                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `create_ticket_survey`                            | pesquisa sem `workspace_id` → DEFAULT                                | grava `new.workspace_id` do chamado; recusa se nulo                                                                             |
| `subscription_after_insert`                       | 1ª fatura sem `workspace_id`                                         | grava o tenant da assinatura; recusa contato de outro tenant (`workspace_mismatch`) e tenant ausente                            |
| `subscription_invoice_after_paid`                 | próxima fatura sem `workspace_id`; sem trava de período              | herda o tenant da assinatura; recusa fatura/assinatura em tenants diferentes; não recria fatura do mesmo período (idempotência) |
| `tickets_default_pipeline` (achado da reprodução) | sem funil próprio, pegava o funil de chamados de **qualquer** tenant | busca só no tenant do chamado; sem funil → NOT NULL recusa                                                                      |

Todas mantêm `SECURITY DEFINER` e `search_path=public` originais; nenhuma permissão foi ampliada.
Compatibilidade: com um tenant o resultado é idêntico; 0 assinaturas e 0 chamados com funil de
outro tenant no banco real (consulta só leitura). Nenhuma linha existente foi alterada.
**Rollback:** recriar as definições anteriores (copiadas na seção 8) — reintroduz o bug; só em emergência.

## 3. Testes — antes/depois (`scripts/isolated-db/workspace-integrity.ts`, 28 casos)

Antes da correção (estrutura real atual, banco isolado): 16 passaram, **9 falharam**, 2 lacunas, 1 não executado.
Falhas reproduzidas: pesquisa de B recusada (42501) ou gravada no tenant original pelo job; 1ª e
próxima fatura de B gravadas no tenant original; assinatura de B com contato de A aceita até o
gatilho falhar; chamado de B herdando o funil de A.

Depois de 0101: **26 passaram, 0 falharam, 1 lacuna conhecida, 1 não executado.**

| Área                                       | Casos                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pesquisa                                   | admin de B, job sem sessão, idempotência (reabrir/fechar = 1), funil de outro tenant                                                                                                                                                                                     |
| Cobrança                                   | insert por usuário e por job, pagamento gera próxima no mesmo tenant, "pago" repetido sem duplicar, workspace adulterado (42501), membro desativado, contato de outro tenant (`workspace_mismatch`), job sem tenant com contato de B (recusado por `workspace_mismatch`) |
| Histórico                                  | lead e negócio de B: etapas e histórico ficam em B (regressão 0099)                                                                                                                                                                                                      |
| Ranking `get_sales_dashboard_secondary_v2` | workspace (2), próprio restrito (1), líder de equipe restrito (0 — contrato real: restrição vale só para próprio/atribuído), workspace adulterado (0), positivo em B                                                                                                     |
| Negócios por equipe                        | sem cargo restrito = workspace inteiro; com cargo restrito = só próprio/atribuído                                                                                                                                                                                        |
| Inbox por equipe                           | e-mail sem contato é privado da caixa (líder não vê); com contato é do workspace; outro tenant não vê                                                                                                                                                                    |
| Lacuna conhecida                           | `lead-missing-ws-user-b`: usuário de B sem `workspace_id` é recusado por causa do DEFAULT                                                                                                                                                                                |
| Não executado                              | "Ver como" modo usuário — exige GoTrue (emissão de sessão)                                                                                                                                                                                                               |

Contratos registrados (não são bugs): negócios não têm escopo de equipe na RLS; a visibilidade
restrita (`job_roles.restricted_visibility`) limita a próprio/atribuído, inclusive para líderes.

Execução agregada (`bun run test:isolated`): fidelidade 0 divergências em 11 categorias;
matriz anterior 43/43; WAL 4/4; integridade 26 passaram/1 lacuna/1 não executado; tempo real
SDK/UI 14 não executados (sem serviço Realtime). Saída **3 = incompleto**, nunca verde.

## 4. Reprodutibilidade do schema

O histórico de migrations continua não reaplicável (47 falham por drift); não foi reescrito.
Novo: `scripts/isolated-db/catalog-manifest.json` — contagem + sha256 por categoria (políticas,
funções, colunas, GRANTs, RLS, gatilhos, restrições, índices, views, publicação), sem dados, sem
corpos de função e sem segredos. `compare-schema.ts` informa "drift desde o manifesto"; atualizar
com `ISO_WRITE_MANIFEST=1` após migração aprovada. Procedimento: `bun run test:isolated`
(extrai catálogo → sobe banco descartável → compara → seed → matriz → WAL → integridade → para).

## 5. Inventário das 81 colunas

Contagens: 5 resolvidas (0099/0101), 1 parcial (`tickets`), 22 pendentes com caminho de servidor
dependente do DEFAULT, 51 candidatas (nenhum caminho de servidor sem tenant encontrado pela
varredura), 3 pendentes de risco alto (sem gatilho de tenant). Nenhum DEFAULT foi removido: 22
caminhos de servidor (`supabaseAdmin`, OAuth, webhooks públicos, motores de e-mail/agenda/booking)
gravam sem `workspace_id` e quebrariam; a varredura é textual e não prova ausência de outros
caminhos (RPCs, helpers genéricos), e a versão anterior do app ainda em uso grava sem
`workspace_id` pela sessão do usuário.

Caminho para remover com segurança, por tabela: (1) corrigir cada caminho de servidor para
passar o tenant da entidade de origem; (2) trocar o DEFAULT por nenhum DEFAULT só depois que a
versão anterior do app sair de uso, deixando o gatilho resolver sessão de usuário e recusar job
sem tenant; (3) adicionar o caso correspondente em `workspace-integrity.ts` antes da migração.

Coluna "Gravações": arquivos de usuário / de servidor / de servidor sem `workspace_id` no payload.

| Tabela                         | Proteção no insert                                           | Pais com tenant                                         | Gravações (usuário/servidor/servidor sem tenant) | Situação                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `activities`                   | trg_set_workspace_activities                                 | companies,contacts,deals,leads,tickets                  | 23/15/9                                          | Pendente: 9 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `ai_summaries`                 | trg_set_workspace_ai_summaries                               | —                                                       | 1/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `api_keys`                     | trg_set_workspace_api_keys                                   | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `booking_pages`                | trg_set_workspace_booking_pages                              | calendar_accounts                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `bookings`                     | trg_set_workspace_bookings                                   | activities,booking_pages,contacts,leads                 | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `calendar_accounts`            | trg_set_workspace_calendar_accounts                          | —                                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `calendar_events`              | trg_set_workspace_calendar_events                            | calendar_accounts,contacts                              | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `companies`                    | trg_set_workspace_companies                                  | companies                                               | 8/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `contact_subscriptions`        | trg_set_workspace_contact_subscriptions                      | subscription_types                                      | 0/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `contacts`                     | trg_set_workspace_contacts                                   | companies                                               | 9/3/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `credit_ledger`                | trg_set_workspace_credit_ledger                              | enrichment_jobs,integrations                            | 4/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `credit_limits`                | trg_set_workspace_credit_limits                              | integrations                                            | 0/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `custom_object_records`        | trg_set_workspace_custom_object_records                      | custom_objects                                          | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `custom_objects`               | trg_set_workspace_custom_objects                             | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `custom_properties`            | trg_set_workspace_custom_properties                          | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `custom_reports`               | trg_set_workspace_custom_reports                             | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `dashboard_widgets`            | trg_set_workspace_dashboard_widgets                          | custom_reports,dashboards                               | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `dashboards`                   | trg_set_workspace_dashboards                                 | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `deal_line_items`              | trg_set_workspace_deal_line_items                            | contracting_presets,deals,job_profiles,service_catalog  | 2/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `deals`                        | deals_lead_workspace_guard,trg_set_workspace_deals           | companies,contacts,leads,pipeline_stage_substatuses     | 9/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `email_accounts`               | trg_set_workspace_email_accounts                             | —                                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_broadcast_recipients`   | trg_set_workspace_email_broadcast_recipients                 | contacts,email_broadcasts,leads                         | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_broadcasts`             | trg_set_workspace_email_broadcasts                           | email_accounts,email_templates,segments                 | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_messages`               | trg_set_workspace_email_messages                             | email_accounts,email_threads                            | 1/2/2                                            | Pendente: 2 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_snippets`               | trg_set_workspace_email_snippets                             | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `email_templates`              | trg_set_workspace_email_templates                            | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `email_threads`                | trg_set_workspace_email_threads                              | companies,contacts,deals,email_accounts,leads           | 0/2/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_tracking_events`        | trg_set_workspace_email_tracking_events                      | email_messages                                          | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `email_unsubscribes`           | trg_set_workspace_email_unsubscribes                         | —                                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `enrichment_jobs`              | trg_set_workspace_enrichment_jobs                            | integrations                                            | 8/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `esign_audit`                  | trg_set_workspace_esign_audit                                | esign_documents,esign_signers                           | 3/7/3                                            | Pendente: 3 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `esign_documents`              | trg_set_workspace_esign_documents                            | contacts,deals                                          | 1/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `esign_signers`                | trg_set_workspace_esign_signers                              | esign_documents                                         | 1/2/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `form_submissions`             | trg_set_workspace_form_submissions                           | forms                                                   | 0/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `forms`                        | trg_set_workspace_forms                                      | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `goals`                        | trg_set_workspace_goals                                      | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `hubspot_sync_state`           | trg_set_workspace_hubspot_sync_state                         | —                                                       | 2/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `integrations`                 | trg_set_workspace_integrations                               | —                                                       | 2/2/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `job_profiles`                 | —                                                            | service_catalog                                         | 1/0/0                                            | Pendente (alto): sem gatilho de tenant; exige derivação do pai/insert explícito                                                      |
| `leads`                        | trg_set_workspace_leads                                      | companies,pipeline_stage_substatuses                    | 8/3/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `macros`                       | trg_set_workspace_macros                                     | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `message_sentiments`           | trg_set_workspace_message_sentiments                         | contacts,leads                                          | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `outbound_webhooks`            | trg_set_workspace_outbound_webhooks                          | —                                                       | 0/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `pipelines`                    | pipelines_enforce_single_default,trg_set_workspace_pipelines | —                                                       | 6/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `playbook_responses`           | trg_set_workspace_playbook_responses                         | playbooks                                               | 0/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `playbooks`                    | trg_set_workspace_playbooks                                  | —                                                       | 0/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `property_history`             | trg_set_workspace_property_history                           | —                                                       | 0/0/0                                            | Resolvido (0099)                                                                                                                     |
| `prospecting_results`          | trg_set_workspace_prospecting_results                        | leads,prospecting_searches                              | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `prospecting_searches`         | trg_set_workspace_prospecting_searches                       | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `push_subscriptions`           | trg_set_workspace_push_subscriptions                         | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `quote_line_items`             | trg_set_workspace_quote_line_items                           | contracting_presets,job_profiles,quotes,service_catalog | 0/2/2                                            | Pendente: 2 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `quotes`                       | trg_set_workspace_quotes                                     | companies,contacts,deals,quote_templates                | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `record_layouts`               | trg_set_workspace_record_layouts                             | —                                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `recurring_plans`              | trg_set_workspace_recurring_plans                            | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `report_schedules`             | trg_set_workspace_report_schedules                           | custom_reports                                          | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `rotation_rules`               | trg_set_workspace_rotation_rules                             | —                                                       | 0/1/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `saved_views`                  | trg_set_workspace_saved_views                                | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `score_events`                 | trg_set_workspace_score_events                               | scoring_rules                                           | 2/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `scoring_cursors`              | trg_set_workspace_scoring_cursors                            | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `scoring_rules`                | trg_set_workspace_scoring_rules                              | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `segments`                     | trg_set_workspace_segments                                   | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `sequence_enrollments`         | trg_set_workspace_sequence_enrollments                       | sequences                                               | 1/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `sequences`                    | trg_set_workspace_sequences                                  | —                                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `service_catalog`              | —                                                            | —                                                       | 1/0/0                                            | Pendente (alto): sem gatilho de tenant; exige derivação do pai/insert explícito                                                      |
| `stage_entries`                | trg_set_workspace_stage_entries                              | —                                                       | 0/0/0                                            | Resolvido (0099)                                                                                                                     |
| `subscription_invoices`        | trg_set_workspace_subscription_invoices                      | subscriptions                                           | 0/0/0                                            | Resolvido (0101): faturas herdam o tenant da assinatura; contato de outro tenant recusado                                            |
| `subscription_types`           | trg_set_workspace_subscription_types                         | —                                                       | 0/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `subscriptions`                | trg_set_workspace_subscriptions                              | contacts,deals,recurring_plans                          | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `survey_responses`             | trg_set_workspace_survey_responses                           | —                                                       | 1/0/0                                            | Resolvido (0101): gatilho de pesquisa grava o tenant do chamado                                                                      |
| `task_queue_items`             | trg_set_workspace_task_queue_items                           | task_queues                                             | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `task_queues`                  | trg_set_workspace_task_queues                                | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `tickets`                      | trg_set_workspace_tickets                                    | companies,contacts,deals,sla_policies                   | 6/1/1                                            | Parcial (0101): funil padrão restrito ao tenant; 1 caminho de servidor sem tenant                                                    |
| `webhook_deliveries`           | trg_set_workspace_webhook_deliveries                         | outbound_webhooks                                       | 0/1/1                                            | Pendente: 1 caminho(s) de servidor dependem do DEFAULT; corrigir antes de remover                                                    |
| `whatsapp_campaign_recipients` | trg_set_workspace_whatsapp_campaign_recipients               | whatsapp_campaigns                                      | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `whatsapp_campaigns`           | trg_set_workspace_whatsapp_campaigns                         | sdr_playbooks                                           | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `whatsapp_conversations`       | trg_set_workspace_whatsapp_conversations                     | contacts,leads,sdr_enrollments,whatsapp_campaigns       | 2/2/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `whatsapp_messages`            | trg_set_workspace_whatsapp_messages                          | wa_ad_referrals,whatsapp_conversations                  | 4/2/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `workflow_events`              | trg_set_workspace_workflow_events                            | —                                                       | 5/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `workflow_runs`                | trg_set_workspace_workflow_runs                              | workflow_events,workflows                               | 3/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `workflows`                    | trg_set_workspace_workflows                                  | —                                                       | 1/0/0                                            | Pendente (candidato): nenhum caminho de servidor sem tenant encontrado; troca do DEFAULT exige verificação da versão anterior do app |
| `workspace_branding`           | trg_branding_updated                                         | —                                                       | 0/1/0                                            | Pendente (alto): sem gatilho de tenant; exige derivação do pai/insert explícito                                                      |

Caminhos de servidor sem tenant (22 tabelas + `tickets`), da varredura: activities (9: e-mail,
Gmail, reuniões, WhatsApp, sequências ATS, booking, hunting), ai_summaries, bookings,
calendar_accounts, calendar_events, contacts (formulário público), email_accounts,
email_broadcast_recipients, email_broadcasts, email_messages (2), email_threads,
email_tracking_events, email_unsubscribes, esign_audit (3), integrations, message_sentiments,
quote_line_items (2), quotes, record_layouts, sequence_enrollments, sequences, tickets,
webhook_deliveries.

## 6. Gates

- `bun run test:isolated`: exit 3 (incompleto pelo tempo real bloqueado e pela lacuna conhecida).
- `bun run verify`: exit 0 — 0 erros de lint (1.275 avisos inalterados), 104 arquivos / 723 testes.
  Primeira execução falhou só por formatação nos dois scripts novos; formatador aplicado só neles.
- `bun run build`: não rodado — nenhum arquivo de `src/` nem configuração mudou; verificação
  automática da plataforma após a migração: "build OK". Smoke não necessário (app não mudou).
- Timeout 240 s: sem nova evidência; não declarado resolvido.

## 7. Lacunas

1. RLS não-admin no banco real (requisito de publicação).
2. 76 DEFAULTs fixos restantes (22 com caminho de servidor a corrigir primeiro; 3 de risco alto sem gatilho: `job_profiles`, `service_catalog`, `workspace_branding`).
3. Tempo real SDK/UI (14) e "Ver como" modo usuário — infraestrutura.
4. Concordância pai/filho só verificada em assinaturas; demais filhos confiam no gatilho de membership (que não compara com o pai).

## 8. Definições anteriores (rollback)

As definições anteriores das quatro funções estão no catálogo extraído antes do ciclo e no
histórico do repositório: `create_ticket_survey`, `subscription_after_insert` e
`subscription_invoice_after_paid` eram idênticas às novas sem a coluna `workspace_id` no INSERT,
sem as checagens `workspace_missing`/`workspace_mismatch` e sem a trava de período;
`tickets_default_pipeline` era idêntica sem o filtro `workspace_id = NEW.workspace_id`.
