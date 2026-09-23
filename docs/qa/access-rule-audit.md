# Auditoria de regras de acesso — criador/administrador vs. workspace/permissão

> Gerado por `bun run audit:access` (2026-09-23).
> Não editar à mão: regenerar o arquivo após qualquer migração que altere policies.

## Como ler

- **Visão 1a** — regra RESTRICTIVE de criador/administrador: aplicada em AND, então bloqueia até quem tem permissão de workspace. É o caso crítico.
- **Visão 1b** — escrita apenas para o criador, sem nenhuma alternativa por permissão.
- **Visão 2** — regra baseada em workspace e/ou permissão (modelo oficial).
- **Visão 3** — tabela sem regra própria (catálogo global).
- **Visão 4** — outra regra; a regra é citada na linha.
- Coluna *legado* marca uso de `is_workspace_admin_of` / `resolve_workspace_id` (verificação antiga de administrador).
- Coluna *pessoal* marca dado por usuário, em que restringir ao próprio usuário é correto por desenho.

## Resumo

| Visão | Áreas | das quais pessoais por desenho |
| --- | --- | --- |
| 1a | 14 | 0 |
| 1b | 22 | 8 |
| 2 | 252 | 6 |
| 3 | 3 | 0 |
| 4 | 24 | 3 |

Total de áreas (tabelas) analisadas: **315**.

## Visão 1a — regra obrigatória de criador/administrador (crítico)

| Módulo | Área | Tela / rota | Tipo de regra | Policies restritivas | Legado | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| TechContracts | `contracts` | /contracts/:id<br>/contracts/index<br>/contracts/links<br>/contracts/templates/:id<br>/contracts/templates/index<br>/<br>+35 | criador do registro | contracts_perm_select<br>contracts_perm_update | não | 6 policy(ies) de workspace coexistem |
| TechSales | `deal_line_items` | /catalog/line-item-migration<br>/deals<br>/deals/:id<br>/catalog/contracting-presets<br>/catalog/job-profiles<br>/contracts/:id<br>+8 | admin pela verificação antiga; criador do registro | deal_line_items_baseline_owner_or_admin_del<br>deal_line_items_baseline_owner_or_admin_ins | sim | 3 policy(ies) de workspace coexistem |
| TechService | `kb_articles` | /kb/:slug<br>/kb/index<br>/settings/kb<br>/tickets/:id | admin pela verificação antiga | kb_articles_perm_delete<br>kb_articles_perm_update | sim | 3 policy(ies) de workspace coexistem |
| TechService | `macros` | /settings/macros<br>/tickets/:id | criador do registro | macros_perm_insert<br>macros_perm_select | não | 6 policy(ies) de workspace coexistem |
| TechPeople | `people_allocations` | /people/:id<br>/people/analytics<br>/people/billing<br>/people/contract-margin<br>/people/my-team<br>/projects/hours-review<br>+1 | criador do registro | people_alloc_perm_select | não | 6 policy(ies) de workspace coexistem |
| TechPeople | `people_benefits` | /people/:id<br>/people/analytics<br>/people/benefits | admin pela verificação antiga; criador do registro | people_benefits_perm_delete<br>people_benefits_perm_select<br>people_benefits_perm_update | sim | 4 policy(ies) de workspace coexistem |
| TechPeople | `people_documents` | /people/:id<br>/people/documents<br>/people/import-forms<br>/people/my-team | admin pela verificação antiga; criador do registro | people_docs_perm_delete<br>people_docs_perm_select<br>people_docs_perm_update | sim | 4 policy(ies) de workspace coexistem |
| TechPeople | `people_goals` | /people/:id | admin pela verificação antiga; criador do registro | people_goals_perm_delete<br>people_goals_perm_select<br>people_goals_perm_update | sim | 6 policy(ies) de workspace coexistem |
| TechPeople | `people_incidents` | /people/:id<br>/people/incidents<br>/people/psychosocial | admin pela verificação antiga | people_incidents_perm_delete | sim | 5 policy(ies) de workspace coexistem |
| TechPeople | `people_one_on_ones` | /people/:id<br>/people/my-team | admin pela verificação antiga; criador do registro | people_1x1_perm_delete<br>people_1x1_perm_select<br>people_1x1_perm_update | sim | 6 policy(ies) de workspace coexistem |
| TechPeople | `people_reviews` | /people/:id | admin pela verificação antiga; criador do registro | people_reviews_perm_delete<br>people_reviews_perm_select<br>people_reviews_perm_update | sim | 6 policy(ies) de workspace coexistem |
| TechProjects | `projects` | /projects_/:id/entrega<br>/projects/:id<br>/projects/index<br>/projects/lists/:id<br>/projects/my-hours<br>/projects/my-work<br>+6 | criador do registro | projects_perm_select<br>projects_perm_update | não | 6 policy(ies) de workspace coexistem |
| TechContracts | `quote_line_items` | /quote/:token<br>/settings/quotes<br>/deals<br>/deals/:id | admin pela verificação antiga; criador do registro | quote_line_items_baseline_owner_or_admin<br>quote_line_items_baseline_owner_or_admin_del<br>quote_line_items_baseline_owner_or_admin_ins | sim | 3 policy(ies) de workspace coexistem |
| TechService | `sla_policies` | /settings/sla | criador do registro | sla_perm_select | não | 6 policy(ies) de workspace coexistem |

## Visão 1b — escrita somente para o criador (sem alternativa por permissão)

| Módulo | Área | Tela / rota | Tipo de regra | Policies de criador | Classificação |
| --- | --- | --- | --- | --- | --- |
| Plataforma / Acesso | `access_profile_permissions` | `src/lib/access-profiles.functions.ts` | somente dono do workspace; herda do registro pai | app_perm_owner_all | revisar |
| Plataforma / Acesso | `access_profile_tools` | `src/lib/access-profiles.functions.ts` | somente dono do workspace; herda do registro pai | app_tool_owner_all | revisar |
| Plataforma / Acesso | `access_profiles` | /settings/teams | somente dono do workspace | ap_owner_all | revisar |
| Core ERP | `chat_conversation_members` | /<br>/admin/bug-reports<br>/tickets<br>/tickets/:id | herda do registro pai; criador do registro; próprio usuário | chat_members_delete<br>chat_members_insert<br>chat_members_update_self | pessoal (correto por desenho) |
| Core ERP | `chat_message_attachments` | / | herda do registro pai; próprio usuário | chat_att_insert | pessoal (correto por desenho) |
| Core ERP | `chat_messages` | /<br>/admin/bug-reports<br>/tickets<br>/tickets/:id | próprio usuário | chat_msg_insert<br>chat_msg_update_own | pessoal (correto por desenho) |
| Core ERP | `copilot_messages` | /__root | herda do registro pai; próprio usuário | copilot_messages via session | pessoal (correto por desenho) |
| Core ERP | `copilot_sessions` | /__root | próprio usuário | copilot_sessions user all | pessoal (correto por desenho) |
| Core ERP | `domain_events` | /candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>/hunting/<br>/hunting/captures<br>+22 | criador do registro | domain_events_owner_all | revisar |
| Core ERP | `field_permission_rules` | /settings/permissions | criador do registro | fpr_write | revisar |
| Plataforma / Acesso | `job_role_sets` | /settings/permissions | herda do registro pai; criador do registro | jrs_write | revisar |
| Core ERP | `ml_forecast_scores` | `src/lib/ml-forecast.functions.ts` | criador do registro | ml_forecast owner all | revisar |
| Core ERP | `ml_scoring_models` | `src/lib/ml-scoring.functions.ts` | criador do registro | ml_scoring_models owner all | revisar |
| Core ERP | `notifications` | /settings/notifications<br>/<br>/companies/:id<br>/contacts/:id<br>/deals<br>/deals/:id<br>+3 | próprio usuário | notif_delete_own<br>notif_update_own | pessoal (correto por desenho) |
| Core ERP | `onboarding_runs` | /onboarding/:entity<br>/settings/onboarding-templates<br>/companies<br>/contacts<br>/tasks<br>/tickets | criador do registro | onb_runs_owner_manage | revisar |
| Integrações | `outbound_webhooks` | /settings/webhooks<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>/hunting/<br>+15 | admin pela verificação antiga | outbound_webhooks_admin_delete<br>outbound_webhooks_admin_insert<br>outbound_webhooks_admin_update | revisar |
| Plataforma / Acesso | `permission_set_items` | /settings/permissions<br>/accept-invite/index<br>/settings/goals<br>/settings/teams<br>/settings/user-groups | herda do registro pai; criador do registro | psi_write | revisar |
| Core ERP | `push_subscriptions` | /settings/mobile | próprio usuário | user_delete_push_subscriptions<br>user_insert_push_subscriptions<br>user_update_push_subscriptions | pessoal (correto por desenho) |
| Core ERP | `team_members` | /settings/teams<br>/<br>/accept-invite/index<br>/campaigns/whatsapp<br>/candidates/index<br>/companies<br>+26 | somente dono do workspace | team_members_owner_modify | revisar |
| Integrações | `unipile_message_log` | /candidates/:id | criador do registro | owner manages unipile_message_log | revisar |
| Core ERP | `user_grid_preferences` | /companies<br>/contacts<br>/deals<br>/leads<br>/services/index<br>/tasks | próprio usuário | Users delete own grid prefs<br>Users insert own grid prefs<br>Users update own grid prefs | pessoal (correto por desenho) |
| Plataforma / Acesso | `user_roles` | /settings/user-groups<br>/<br>/accept-invite/index<br>/settings<br>/settings/goals<br>/settings/privacy<br>+2 | somente dono do workspace | user_roles_admin_modify | revisar |

## Visão 2 — workspace / permissão (modelo oficial)

| Módulo | Área | Tela / rota | Ressalva |
| --- | --- | --- | --- |
| Core ERP | `ab_test_events` | `src/lib/ab-tests.functions.ts` | — |
| Core ERP | `ab_tests` | `src/lib/ab-tests.functions.ts` | — |
| Plataforma / Acesso | `access_audit_log` | /settings/access-policy<br>/<br>/candidates/:id<br>/candidates/index<br>/catalog/contracting-presets<br>/catalog/job-profiles<br>+39 | — |
| Core ERP | `activities` | /<br>/__root<br>/admin/bug-reports<br>/campaigns/whatsapp<br>/candidates/index<br>/communications<br>+51 | usa verificação antiga de admin |
| Core ERP | `activity_comments` | /contacts/:id<br>/deals<br>/deals/:id<br>/leads/:id<br>/tickets/:id | — |
| Core ERP | `activity_survey_responses` | /companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/prospecting/queues/:queueId/play<br>/settings/platform/status<br>+2 | — |
| Core ERP | `ads_accounts` | /settings/ads-sync | — |
| Core ERP | `ads_audiences` | /settings/ads-sync | — |
| Core ERP | `ads_lead_forms` | /settings/ads-sync | — |
| Core ERP | `ai_summaries` | /contacts/:id<br>/deals<br>/deals/:id<br>/leads/:id<br>/tickets/:id | — |
| Core ERP | `api_keys` | /settings/api-keys | usa verificação antiga de admin |
| Core ERP | `apollo_phone_reveals` | /leads/:id<br>/prospecting/queues/:queueId/play | — |
| TechHire | `ats_application_events` | /<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>/insights<br>+3 | usa verificação antiga de admin |
| TechHire | `ats_applications` | /<br>/ats-dashboard<br>/briefing<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>+17 | usa verificação antiga de admin |
| TechHire | `ats_async_video_responses` | /api/public/interview/:token | usa verificação antiga de admin |
| TechHire | `ats_candidate_consents` | /compliance | usa verificação antiga de admin |
| TechHire | `ats_candidate_email_queue` | /careers/:slug<br>/careers/index | usa verificação antiga de admin |
| TechHire | `ats_candidate_flags` | /candidates/:id<br>/fraud-flags | usa verificação antiga de admin |
| TechHire | `ats_candidates` | /candidates/:id<br>/candidates/index<br>/<br>/ats-dashboard<br>/careers/:slug<br>/careers/index<br>+23 | usa verificação antiga de admin |
| TechHire | `ats_daily_briefings` | /briefing | usa verificação antiga de admin |
| TechHire | `ats_dsar_requests` | /compliance | usa verificação antiga de admin |
| TechHire | `ats_hunting_captures` | /hunting/<br>/hunting/captures<br>/hunting/search<br>/hunting/templates | usa verificação antiga de admin |
| TechHire | `ats_hunting_templates` | /hunting/<br>/hunting/captures<br>/hunting/templates | usa verificação antiga de admin |
| TechHire | `ats_interview_kits` | /interview-kits<br>/jobs/:id<br>/notetaker | usa verificação antiga de admin |
| TechHire | `ats_interviewer_availability` | /scheduling | usa verificação antiga de admin |
| TechHire | `ats_interviewer_pool_members` | /scheduling | usa verificação antiga de admin |
| TechHire | `ats_interviewer_pools` | /scheduling | usa verificação antiga de admin |
| TechHire | `ats_interviews` | /<br>/ats-dashboard<br>/briefing<br>/candidates/:id<br>/candidates/index<br>/companies<br>+11 | usa verificação antiga de admin |
| TechHire | `ats_job_postings` | /jobs/:id<br>/sourcing/multi-posting | usa verificação antiga de admin |
| TechHire | `ats_jobs` | /jobs/:id<br>/jobs/index<br>/<br>/ats-dashboard<br>/briefing<br>/candidates/:id<br>+18 | usa verificação antiga de admin |
| TechHire | `ats_match_scores` | /match-scores | usa verificação antiga de admin |
| TechHire | `ats_offers` | /offers<br>/ats-dashboard<br>/briefing<br>/candidates/:id<br>/candidates/index<br>/copilot<br>+3 | usa verificação antiga de admin |
| TechHire | `ats_pipelines` | /pipelines<br>/<br>/candidates/:id<br>/candidates/index<br>/jobs/:id<br>/jobs/index | usa verificação antiga de admin |
| TechHire | `ats_referral_programs` | /sourcing/referrals | usa verificação antiga de admin |
| TechHire | `ats_referrals` | /sourcing/referrals | usa verificação antiga de admin |
| TechHire | `ats_scorecard_responses` | /scorecards<br>/candidates/:id<br>/compliance<br>/jobs/:id | usa verificação antiga de admin |
| TechHire | `ats_scorecards` | /scorecards<br>/jobs/:id | usa verificação antiga de admin |
| TechHire | `ats_sourcing_enrollments` | /sourcing/analytics<br>/sourcing/inbox<br>/sourcing/pools<br>/sourcing/sequences<br>/sourcing/sequences_/:id<br>/hunting/<br>+2 | usa verificação antiga de admin |
| TechHire | `ats_sourcing_sequence_steps` | /sourcing/inbox<br>/sourcing/sequences<br>/sourcing/sequences_/:id | usa verificação antiga de admin |
| TechHire | `ats_sourcing_sequences` | /sourcing/analytics<br>/sourcing/inbox<br>/sourcing/sequences<br>/sourcing/sequences_/:id | usa verificação antiga de admin |
| TechHire | `ats_sourcing_step_log` | /sourcing/analytics<br>/sourcing/inbox | — |
| TechHire | `ats_stage_email_log` | /stage-emails<br>/<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>+2 | usa verificação antiga de admin |
| TechHire | `ats_stage_emails` | /stage-emails<br>/<br>/candidates/:id<br>/candidates/index<br>/jobs/:id<br>/jobs/index | usa verificação antiga de admin |
| TechHire | `ats_talent_pool_members` | /sourcing/pools<br>/candidates/:id<br>/hunting/<br>/hunting/captures<br>/hunting/templates | usa verificação antiga de admin |
| TechHire | `ats_talent_pools` | /sourcing/pools<br>/candidates/:id | usa verificação antiga de admin |
| Core ERP | `attribution_touchpoints` | `src/lib/attribution.functions.ts` | — |
| Core ERP | `audit_export_runs` | /settings/audit-export | — |
| Core ERP | `audit_exports` | /settings/audit-export | — |
| Core ERP | `audit_logs` | /settings/audit-export<br>/settings/audit-log<br>/accept-invite/:token<br>/candidates/:id<br>/companies<br>/companies/:id<br>+12 | — |
| TechFinance | `bank_charges` | /finance/banking<br>/finance/banking/reconciliation | — |
| TechFinance | `bank_connection_events` | /finance/banking<br>/finance/banking/reconciliation | — |
| TechFinance | `bank_connection_tokens` | /finance/banking<br>/finance/banking/reconciliation | — |
| TechFinance | `bank_connections` | /finance/banking<br>/finance/banking/reconciliation<br>/settings/integrations/contaazul | — |
| TechFinance | `bank_payments` | /finance/banking<br>/finance/banking/reconciliation | — |
| TechFinance | `bank_statement_transactions` | /finance/banking<br>/finance/banking/reconciliation<br>/settings/integrations/contaazul | — |
| Core ERP | `booking_pages` | /settings/booking | — |
| Core ERP | `bookings` | /companies/:id<br>/contacts/:id<br>/dashboard<br>/deals/:id<br>/leads/:id<br>/settings/booking<br>+1 | — |
| Core ERP | `bug_reports` | /admin/bug-reports<br>/<br>/qa/test-cases<br>/settings/my-tickets | usa verificação antiga de admin |
| Core ERP | `calendar_accounts` | /settings/calendars<br>/companies/:id<br>/contacts/:id<br>/deals<br>/deals/:id<br>/jobs/:id<br>+6 | — |
| Core ERP | `calendar_events` | /settings/calendars<br>/companies/:id<br>/contacts/:id<br>/deals<br>/deals/:id<br>/jobs/:id<br>+6 | usa verificação antiga de admin |
| Core ERP | `charging_templates` | /settings/charging-templates<br>/settings/dunning | — |
| Core ERP | `chat_conversations` | /<br>/admin/bug-reports<br>/tickets<br>/tickets/:id | — |
| Core ERP | `companies` | /companies<br>/companies/:id<br>/<br>/__root<br>/[/mcp]/invoke-tool/:tool<br>/[/mcp]/list-tools<br>+30 | — |
| Core ERP | `contaazul_sync_state` | /settings/integrations/contaazul | usa verificação antiga de admin |
| Core ERP | `contact_subscriptions` | — | — |
| Core ERP | `contacts` | /contacts<br>/contacts/:id<br>/<br>/__root<br>/[/mcp]/invoke-tool/:tool<br>/[/mcp]/list-tools<br>+42 | — |
| TechContracts | `contract_approvals` | /contracts/:id | — |
| TechContracts | `contract_defaults` | /contracts/:id<br>/contracts/index<br>/contracts/links<br>/settings/contract-defaults | — |
| TechContracts | `contract_events` | /contracts/:id<br>/contracts/index<br>/contracts/links<br>/deals/:id<br>/finance/audit<br>/finance/bank-accounts<br>+12 | — |
| TechContracts | `contract_link_ai_suggestions` | /contracts/:id<br>/contracts/links | — |
| TechContracts | `contract_template_services` | /contracts/index<br>/contracts/templates/:id<br>/contracts/templates/index<br>/deals/:id | — |
| TechContracts | `contract_templates` | /contracts/index<br>/contracts/templates/:id<br>/contracts/templates/index<br>/deals/:id | — |
| TechContracts | `contracting_presets` | /catalog/contracting-presets<br>/contracts/:id<br>/deals/:id<br>/people/:id | — |
| TechFinance | `credit_ledger` | /contacts<br>/hunting/captures<br>/leads<br>/prospecting/index<br>/settings/enrichment<br>/settings/integrations/:slug<br>+1 | — |
| TechFinance | `credit_limits` | /contacts<br>/leads<br>/settings/integrations/:slug<br>/settings/integrations/index | — |
| Core ERP | `custom_object_records` | /settings/custom-objects | — |
| Core ERP | `custom_objects` | /settings/custom-objects | — |
| Core ERP | `custom_properties` | /settings/custom-properties<br>/companies<br>/companies/:id<br>/contacts<br>/contacts/:id<br>/deals<br>+8 | usa verificação antiga de admin |
| Core ERP | `custom_reports` | /reports<br>/dashboards<br>/settings/exports | — |
| TechFinance | `customer_invoices` | /invoices<br>/finance/nfse<br>/people/billing<br>/people/contract-margin | usa verificação antiga de admin |
| TechFinance | `customer_payments` | /invoices | — |
| Core ERP | `dashboard_widgets` | /dashboards | — |
| Core ERP | `dashboards` | /dashboards | — |
| TechSales | `deal_contacts` | /contacts<br>/contacts/:id<br>/deals<br>/deals/:id<br>/__root<br>/companies<br>+14 | — |
| TechSales | `deal_loss_reasons` | /deals<br>/communications<br>/companies<br>/contacts<br>/contracts/index<br>/jobs/index<br>+19 | — |
| TechSales | `deals` | /deals<br>/deals/:id<br>/<br>/__root<br>/[/mcp]/invoke-tool/:tool<br>/[/mcp]/list-tools<br>+39 | — |
| TechFinance | `dunning_policies` | /settings/dunning | — |
| TechFinance | `dunning_runs` | /settings/dunning | — |
| Integrações | `email_accounts` | /campaigns/email<br>/inbox/email<br>/settings/email<br>/deals/:id<br>/inbox/index<br>/settings/exports<br>+5 | — |
| Integrações | `email_broadcast_recipients` | /campaigns/email<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/tickets/:id | — |
| Integrações | `email_broadcasts` | /campaigns/email | usa verificação antiga de admin |
| Integrações | `email_messages` | /inbox/email<br>/settings/email<br>/analytics<br>/companies/:id<br>/contacts/:id<br>/deals<br>+6 | usa verificação antiga de admin |
| Integrações | `email_snippets` | /campaigns/email<br>/inbox/email<br>/settings/email<br>/settings/email-templates<br>/deals/:id<br>/tasks/queues/:queueId/play | — |
| Integrações | `email_templates` | /campaigns/email<br>/inbox/email<br>/settings/email<br>/settings/email-templates<br>/deals/:id<br>/settings/workflows<br>+1 | — |
| Integrações | `email_threads` | /inbox/email<br>/settings/email<br>/analytics<br>/companies/:id<br>/contacts/:id<br>/deals<br>+5 | usa verificação antiga de admin |
| Integrações | `email_tracking_events` | /inbox/email<br>/settings/email<br>/analytics<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>+5 | — |
| Integrações | `email_unsubscribes` | /campaigns/email | — |
| Core ERP | `enrichment_job_items` | /settings/enrichment<br>/contacts<br>/leads<br>/prospecting/index<br>/settings/integrations/:slug<br>/settings/integrations/index | — |
| Core ERP | `enrichment_jobs` | /settings/enrichment<br>/companies<br>/companies/:id<br>/contacts<br>/leads<br>/prospecting/index<br>+2 | — |
| TechContracts | `esign_attachments` | /proposals/:id<br>/proposals/index<br>/settings/clauses<br>/verify/:hash | — |
| TechContracts | `esign_audit` | /settings/esign<br>/offers<br>/proposals/:id<br>/proposals/index<br>/settings/clauses<br>/sign/:token<br>+1 | — |
| TechContracts | `esign_documents` | /settings/esign<br>/offers<br>/proposals/:id<br>/proposals/index<br>/settings/clauses<br>/sign/:token<br>+1 | — |
| TechContracts | `esign_signers` | /settings/esign<br>/offers<br>/sign/:token | — |
| Core ERP | `feature_flags` | /api/public/v1/ats/applications<br>/api/public/v1/ats/applications/:id/hire<br>/api/public/v1/ats/jobs | usa verificação antiga de admin |
| TechFinance | `financial_bank_accounts` | /finance/bank-accounts<br>/finance/banking<br>/finance/banking/reconciliation<br>/finance/cash-flow<br>/finance/categories<br>/finance/dre<br>+6 | — |
| TechFinance | `financial_categories` | /finance/categories<br>/finance/bank-accounts<br>/finance/cash-flow<br>/finance/dre<br>/finance/entries/:id<br>/finance/index<br>+4 | — |
| TechFinance | `financial_cost_centers` | /finance/cost-centers<br>/settings/integrations/contaazul | — |
| TechFinance | `financial_entries` | /finance/entries/:id<br>/<br>/catalog/contracting-presets<br>/catalog/job-profiles<br>/catalog/line-item-migration<br>/contracts/:id<br>+29 | — |
| TechFinance | `financial_entry_allocations` | /finance/cost-centers<br>/settings/integrations/contaazul | — |
| TechFinance | `financial_payments` | /finance/bank-accounts<br>/finance/banking<br>/finance/banking/reconciliation<br>/finance/cash-flow<br>/finance/categories<br>/finance/dre<br>+5 | — |
| TechFinance | `financial_recurrences` | /finance/recurrences<br>/people/analytics | usa verificação antiga de admin |
| Core ERP | `form_submissions` | /forms<br>/settings/forms<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>+1 | — |
| Core ERP | `forms` | /forms<br>/settings/forms | — |
| Core ERP | `goals` | /settings/goals<br>/dashboard | — |
| Integrações | `hubspot_owners` | /settings/hubspot-users<br>/companies<br>/contacts<br>/leads | — |
| Integrações | `hubspot_sync_state` | /settings/integrations/:slug | — |
| TechSales | `icp_criteria` | /leads/:id<br>/prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/scoring | — |
| Integrações | `integrations` | /settings/integrations/:slug<br>/settings/integrations/contaazul<br>/settings/integrations/index<br>/contacts<br>/dashboard<br>/leads<br>+4 | usa verificação antiga de admin |
| Core ERP | `ip_access_log` | /settings/access-policy<br>/settings/data-residency | — |
| TechHire | `job_profiles` | /catalog/job-profiles<br>/catalog/contracting-presets<br>/catalog/line-item-migration<br>/contracts/:id<br>/contracts/index<br>/contracts/links<br>+4 | — |
| Plataforma / Acesso | `job_role_permission_overrides` | /settings/permissions | — |
| Plataforma / Acesso | `job_roles` | /accept-invite/index<br>/settings/goals<br>/settings/permissions<br>/settings/teams<br>/settings/user-groups | usa verificação antiga de admin |
| TechService | `kb_categories` | /kb/:slug<br>/kb/index<br>/settings/kb | — |
| Core ERP | `landing_page_events` | /landing-pages/:id<br>/landing-pages/index<br>/lp/:slug | — |
| Core ERP | `landing_pages` | /landing-pages/:id<br>/landing-pages/index<br>/lp/:slug | usa verificação antiga de admin |
| TechSales | `lead_sources` | /leads<br>/leads/:id<br>/settings/lead-sources<br>/communications<br>/companies<br>/companies/:id<br>+24 | usa verificação antiga de admin |
| TechSales | `leads` | /leads<br>/leads/:id<br>/<br>/__root<br>/[/mcp]/invoke-tool/:tool<br>/[/mcp]/list-tools<br>+25 | — |
| Core ERP | `legal_entities` | /finance/legal-entities<br>/finance/legal-entity-groups<br>/settings/legal-entities<br>/settings/legal-entity-groups<br>/companies<br>/contacts<br>+21 | — |
| Core ERP | `legal_entity_group_members` | /finance/legal-entity-groups<br>/settings/legal-entity-groups<br>/finance/audit<br>/finance/bank-accounts<br>/finance/cash-flow<br>/finance/categories<br>+7 | — |
| Core ERP | `legal_entity_groups` | /finance/legal-entity-groups<br>/settings/legal-entity-groups<br>/finance/audit<br>/finance/bank-accounts<br>/finance/cash-flow<br>/finance/categories<br>+7 | — |
| TechService | `live_chat_messages` | /inbox/chat | — |
| TechService | `live_chat_sessions` | /inbox/chat | — |
| Integrações | `marketplace_installations` | /settings/marketplace/:slug<br>/settings/marketplace/index | — |
| Core ERP | `media_assets` | /settings/media<br>/lp/:slug<br>/settings/branding<br>/settings/quote-templates | — |
| Core ERP | `meet_recording_index` | /jobs/:id<br>/settings/booking<br>/settings/calendars | usa verificação antiga de admin |
| Core ERP | `meeting_participants` | /meetings<br>/companies/:id<br>/contacts/:id<br>/deals<br>/deals/:id<br>/leads/:id<br>+4 | — |
| Core ERP | `meeting_summaries` | /meetings<br>/companies/:id<br>/contacts/:id<br>/deals<br>/deals/:id<br>/leads/:id<br>+3 | — |
| Core ERP | `meetings` | /meetings<br>/companies/:id<br>/contacts/:id<br>/dashboard<br>/deals<br>/deals/:id<br>+6 | usa verificação antiga de admin |
| Core ERP | `message_drafts` | /companies/:id<br>/contacts/:id<br>/deals/:id<br>/inbox/email<br>/inbox/index<br>/inbox/whatsapp<br>+5 | usa verificação antiga de admin |
| Core ERP | `message_sentiments` | /analytics | — |
| Plataforma / Acesso | `module_branding` | /settings/branding<br>/__root<br>/careers/:slug<br>/careers/index | — |
| TechFinance | `nfse_invoices` | /finance/nfse<br>/invoices | — |
| Core ERP | `onboarding_templates` | /onboarding/:entity<br>/settings/onboarding-templates<br>/companies<br>/contacts<br>/tasks<br>/tickets | — |
| TechPeople | `people` | /people/:id<br>/people/analytics<br>/people/benefits<br>/people/documents<br>/people/import-forms<br>/people/index<br>+5 | — |
| TechPeople | `people_events` | /people/:id<br>/people/documents | — |
| TechPeople | `people_onboarding_plans` | /people/:id<br>/people/analytics<br>/people/index<br>/people/offboarding<br>/people/onboarding<br>/people/onboarding-templates<br>+1 | — |
| TechPeople | `people_onboarding_tasks` | /people/:id<br>/people/analytics<br>/people/index<br>/people/offboarding<br>/people/onboarding<br>/people/onboarding-templates<br>+1 | — |
| TechPeople | `people_onboarding_templates` | /people/:id<br>/people/analytics<br>/people/index<br>/people/offboarding<br>/people/onboarding<br>/people/onboarding-templates<br>+1 | — |
| TechPeople | `people_psychosocial_assessments` | /people/:id<br>/people/incidents<br>/people/psychosocial | — |
| Plataforma / Acesso | `permission_sets` | /settings/permissions<br>/accept-invite/:token<br>/accept-invite/index<br>/candidates/:id<br>/companies<br>/companies/:id<br>+14 | usa verificação antiga de admin |
| Core ERP | `pipeline_stage_substatuses` | /settings/pipelines<br>/communications<br>/companies<br>/companies/:id<br>/contacts<br>/contacts/:id<br>+21 | — |
| Core ERP | `pipelines` | /settings/pipelines<br>/__root<br>/analytics<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>+54 | — |
| TechService | `playbook_responses` | — | — |
| TechService | `playbooks` | — | — |
| TechProjects | `project_folders` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_list_custom_fields` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_list_templates` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_lists` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_members` | /projects/:id<br>/projects/index<br>/projects/lists/:id<br>/projects/my-hours<br>/projects/my-work<br>/projects/spaces<br>+3 | — |
| TechProjects | `project_milestones` | /projects/:id<br>/projects/index<br>/projects/lists/:id<br>/projects/my-work<br>/projects/spaces<br>/projects/tasks<br>+3 | — |
| TechProjects | `project_spaces` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_task_checklists` | /projects/lists/:id | — |
| TechProjects | `project_task_dependencies` | /projects/lists/:id | — |
| TechProjects | `project_task_statuses` | /projects/lists/:id<br>/projects/spaces | — |
| TechProjects | `project_tasks` | /projects/:id<br>/projects/index<br>/projects/lists/:id<br>/projects/my-hours<br>/projects/my-work<br>/projects/spaces<br>+3 | — |
| TechProjects | `project_time_entries` | /projects/:id<br>/projects/hours-review<br>/projects/index<br>/projects/lists/:id<br>/projects/my-hours<br>/projects/my-work<br>+8 | — |
| TechProjects | `project_updates` | /projects_/:id/entrega<br>/deals/:id | — |
| Core ERP | `property_history` | /companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/prospecting/queues/:queueId/play<br>/tasks/:id<br>+1 | — |
| TechContracts | `proposal_approvals` | /proposals/:id<br>/proposals/index<br>/settings/clauses<br>/verify/:hash | — |
| TechContracts | `proposal_clauses` | /proposals/:id<br>/proposals/index<br>/settings/clauses<br>/verify/:hash | — |
| TechContracts | `proposals` | /proposals/:id<br>/proposals/index<br>/settings/clauses<br>/verify/:hash | — |
| TechSales | `prospecting_cadence_steps` | /prospecting/index<br>/settings/prospecting<br>/leads | usa verificação antiga de admin |
| TechSales | `prospecting_cadences` | /prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/prospecting<br>/leads<br>/leads/:id | usa verificação antiga de admin |
| TechSales | `prospecting_call_attempts` | /prospecting/campaigns/:id<br>/prospecting/campaigns/index | — |
| TechSales | `prospecting_campaign_variants` | /prospecting/campaigns/:id<br>/prospecting/campaigns/index | — |
| TechSales | `prospecting_campaigns` | /prospecting/campaigns/:id<br>/prospecting/campaigns/index | — |
| TechSales | `prospecting_enrollments` | /prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/prospecting<br>/leads<br>/leads/:id | usa verificação antiga de admin |
| TechSales | `prospecting_qualifications` | /prospecting/queues/:queueId/play<br>/leads/:id<br>/settings/platform/status | usa verificação antiga de admin |
| TechSales | `prospecting_questionnaires` | /prospecting/index<br>/prospecting/queues/:queueId/play<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>+5 | usa verificação antiga de admin |
| TechSales | `prospecting_questions` | /prospecting/index<br>/prospecting/queues/:queueId/play<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>+5 | usa verificação antiga de admin |
| TechSales | `prospecting_queues` | /prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/prospecting<br>/leads<br>/leads/:id | usa verificação antiga de admin |
| TechSales | `prospecting_results` | /prospecting/index<br>/settings/prospecting<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>+2 | — |
| TechSales | `prospecting_scripts` | /prospecting/campaigns/:id<br>/prospecting/campaigns/index<br>/prospecting/index<br>/settings/prospecting-scripts | — |
| TechSales | `prospecting_searches` | /prospecting/index<br>/settings/prospecting<br>/settings/enrichment | — |
| TechContracts | `quote_templates` | /quote/:token<br>/settings/quote-templates<br>/settings/quotes<br>/deals<br>/deals/:id | usa verificação antiga de admin |
| TechContracts | `quotes` | /settings/quotes<br>/deals<br>/deals/:id<br>/quote/:token | — |
| Core ERP | `record_layouts` | /settings/record-layouts<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/tasks/:id<br>+1 | — |
| TechFinance | `recurring_plans` | /settings/recurring | — |
| Core ERP | `report_schedules` | /settings/exports | — |
| Core ERP | `rotation_rules` | /settings/rotation<br>/<br>/candidates/index<br>/companies<br>/contacts<br>/contracts/:id<br>+18 | — |
| Core ERP | `saved_views` | /communications<br>/leads<br>/notes<br>/tasks | — |
| Core ERP | `scim_tokens` | /settings/scim | — |
| TechSales | `score_contributions` | /leads/:id<br>/prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/scoring | — |
| TechSales | `score_events` | /leads/:id<br>/prospecting/index<br>/prospecting/queues/:queueId/play<br>/settings/scoring | — |
| Core ERP | `scoring_cursors` | /settings/scoring<br>/prospecting/index | — |
| Core ERP | `scoring_rules` | /settings/scoring<br>/prospecting/index | — |
| TechSales | `sdr_enrollments` | /agents/sdr<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/tickets/:id | usa verificação antiga de admin |
| TechSales | `sdr_playbooks` | /agents/sdr | usa verificação antiga de admin |
| Core ERP | `segment_members` | /settings/segments<br>/campaigns/email<br>/prospecting/campaigns/:id<br>/prospecting/campaigns/index | — |
| TechSales | `segments` | /settings/segments<br>/campaigns/email<br>/prospecting/campaigns/:id<br>/prospecting/campaigns/index | — |
| TechSales | `sequence_enrollments` | /settings/sequences | — |
| TechSales | `sequences` | /settings/sequences<br>/settings/workflows | — |
| Core ERP | `service_catalog` | /catalog/contracting-presets<br>/catalog/job-profiles<br>/catalog/line-item-migration<br>/catalog/services<br>/services/:id<br>/services/index<br>+9 | — |
| Core ERP | `services` | /services/:id<br>/services/index<br>/<br>/catalog/contracting-presets<br>/catalog/job-profiles<br>/catalog/line-item-migration<br>+12 | — |
| Integrações | `slack_event_routes` | /settings/notifications/slack | — |
| Integrações | `slack_integrations` | /settings/notifications/slack<br>/settings/marketplace/:slug<br>/settings/marketplace/index | — |
| Core ERP | `snippets` | /settings/snippets<br>/admin/bug-reports<br>/book/:slug<br>/campaigns/email<br>/communications<br>/companies/:id<br>+27 | — |
| Core ERP | `stage_entries` | /settings/sla | — |
| TechFinance | `subscription_invoices` | /settings/recurring | — |
| TechFinance | `subscription_types` | — | — |
| TechFinance | `subscriptions` | /settings/recurring | — |
| TechService | `survey_responses` | /settings/surveys<br>/survey/:token<br>/surveys | — |
| TechService | `survey_template_questions` | /companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/prospecting/queues/:queueId/play<br>/settings/workflows<br>+1 | — |
| TechService | `survey_templates` | /companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>/prospecting/queues/:queueId/play<br>/settings/workflows<br>+1 | — |
| Core ERP | `task_queue_items` | /tasks/queues<br>/tasks/queues/:queueId/play<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/leads/:id<br>+1 | — |
| Core ERP | `task_queues` | /tasks/queues<br>/tasks/queues/:queueId/play | — |
| TechService | `tickets` | /tickets<br>/tickets/:id<br>/<br>/__root<br>/analytics<br>/candidates/:id<br>+45 | — |
| Core ERP | `timeline_pins` | — | — |
| Core ERP | `usage_counters` | /settings/billing<br>/settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/status<br>/settings/teams | — |
| Core ERP | `user_file_folders` | /files<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/inbox/email<br>/leads/:id<br>+5 | usa verificação antiga de admin |
| Core ERP | `user_files` | /files<br>/companies/:id<br>/contacts/:id<br>/deals/:id<br>/inbox/email<br>/leads/:id<br>+5 | usa verificação antiga de admin |
| Plataforma / Acesso | `user_group_members` | /settings/user-groups<br>/companies/:id<br>/contacts/:id<br>/contracts/:id<br>/contracts/index<br>/deals/:id<br>+6 | — |
| Plataforma / Acesso | `user_groups` | /settings/user-groups | — |
| Plataforma / Acesso | `user_job_roles` | /settings/user-groups<br>/accept-invite/:token<br>/accept-invite/index<br>/candidates/:id<br>/companies<br>/companies/:id<br>+15 | usa verificação antiga de admin |
| Plataforma / Acesso | `user_permission_sets` | /settings/permissions<br>/settings/user-groups<br>/accept-invite/:token<br>/accept-invite/index<br>/candidates/:id<br>/companies<br>+15 | usa verificação antiga de admin |
| Core ERP | `voice_agent_settings` | /settings/prospecting-scripts<br>/settings/voice-agent<br>/prospecting/campaigns/:id<br>/prospecting/campaigns/index<br>/prospecting/index | — |
| TechSales | `wa_ad_referrals` | /api/public/meta/whatsapp-webhook | — |
| TechSales | `wa_ad_slugs` | /settings/wa-ads<br>/settings/whatsapp<br>/settings/whatsapp-catalogs<br>/settings/whatsapp-templates | — |
| TechSales | `wa_business_accounts` | /campaigns/whatsapp<br>/inbox/index<br>/inbox/whatsapp<br>/settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>+5 | — |
| TechSales | `wa_catalog_products` | /settings/whatsapp-catalogs<br>/settings/wa-ads<br>/settings/whatsapp<br>/settings/whatsapp-templates | — |
| TechSales | `wa_catalogs` | /settings/whatsapp-catalogs<br>/settings/wa-ads<br>/settings/whatsapp<br>/settings/whatsapp-templates | — |
| TechSales | `wa_phone_numbers` | /campaigns/whatsapp<br>/inbox/index<br>/inbox/whatsapp<br>/settings/wa-ads<br>/settings/whatsapp<br>/settings/whatsapp-catalogs<br>+1 | — |
| TechSales | `wa_templates` | /settings/whatsapp-templates<br>/campaigns/whatsapp<br>/inbox/index<br>/inbox/whatsapp<br>/settings/wa-ads<br>/settings/whatsapp<br>+1 | — |
| Core ERP | `webhook_deliveries` | /settings/webhooks<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>/hunting/<br>+15 | — |
| TechSales | `whatsapp_campaign_recipients` | /campaigns/whatsapp | — |
| TechSales | `whatsapp_campaigns` | /campaigns/whatsapp | usa verificação antiga de admin |
| TechSales | `whatsapp_conversations` | /campaigns/whatsapp<br>/inbox/whatsapp<br>/settings/whatsapp<br>/settings/whatsapp-catalogs<br>/settings/whatsapp-templates<br>/contacts/:id<br>+6 | usa verificação antiga de admin |
| TechSales | `whatsapp_messages` | /campaigns/whatsapp<br>/inbox/whatsapp<br>/settings/whatsapp<br>/settings/whatsapp-catalogs<br>/settings/whatsapp-templates<br>/analytics<br>+7 | usa verificação antiga de admin |
| Workflows | `workflow_action_templates` | `src/lib/workflow-action-templates.functions.ts` | — |
| Workflows | `workflow_approvals` | /settings/workflows<br>/leads/:id | usa verificação antiga de admin |
| Workflows | `workflow_events` | /settings/workflows<br>/companies<br>/contacts<br>/leads/:id<br>/onboarding/:entity<br>/prospecting/index<br>+4 | — |
| Workflows | `workflow_runs` | /settings/workflows<br>/leads/:id | — |
| Workflows | `workflow_subscriptions` | /settings/workflow-subscriptions<br>/candidates/:id<br>/candidates/index<br>/careers/:slug<br>/careers/index<br>/hunting/<br>+23 | — |
| Workflows | `workflows` | /settings/workflows<br>/leads/:id | — |
| Plataforma / Acesso | `workspace_branding` | /settings/branding<br>/__root<br>/accept-invite/:token<br>/candidates/:id<br>/companies<br>/companies/:id<br>+12 | — |
| Plataforma / Acesso | `workspace_invite_settings` | /accept-invite/:token<br>/settings/branding<br>/settings/teams<br>/candidates/:id<br>/companies<br>/companies/:id<br>+11 | — |
| Plataforma / Acesso | `workspace_invites` | /accept-invite/:token<br>/accept-invite/index<br>/candidates/:id<br>/companies<br>/companies/:id<br>/contacts<br>+14 | — |
| Plataforma / Acesso | `workspace_members` | /admin/workspaces<br>/admin/workspaces/:id<br>/workspace/modules<br>/<br>/__root<br>/[/mcp]/invoke-tool/:tool<br>+172 | — |
| Plataforma / Acesso | `workspace_modules` | /modules/index<br>/workspace/modules<br>/<br>/careers/:slug<br>/careers/index<br>/home/index<br>+3 | — |
| Plataforma / Acesso | `workspace_subscriptions` | /settings/billing<br>/settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/status<br>/settings/privacy<br>+1 | — |
| Plataforma / Acesso | `workspaces` | /admin/workspaces<br>/admin/workspaces/:id<br>/<br>/[/mcp]/invoke-tool/:tool<br>/[/mcp]/list-tools<br>/[/well-known]/oauth-protected-resource<br>+76 | — |
| Core ERP | `zapier_subscriptions` | /settings/zapier | — |

## Visão 3 — sem regra própria

| Módulo | Área | Tela / rota |
| --- | --- | --- |
| Plataforma / Acesso | `modules` | /modules/index<br>/workspace/modules<br>/settings/billing |
| Core ERP | `payment_webhook_events` | /invoices |
| Plataforma / Acesso | `permissions` | /settings/my-permissions<br>/settings/permissions<br>/<br>/candidates/index<br>/companies<br>/companies/:id<br>+38 |

## Visão 4 — outra regra

| Módulo | Área | Tela / rota | Regra |
| --- | --- | --- | --- |
| Core ERP | `app_settings` | /api/public/hooks/prospecting-dial-tick | negação total; leitura pública (anon) |
| Core ERP | `bug_report_analyses` | /admin/bug-reports | somente administrador de plataforma |
| Core ERP | `cron_run_logs` | /finance/banking<br>/finance/banking/reconciliation<br>/settings/integrations/contaazul<br>/settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>+1 | somente administrador de plataforma |
| Integrações | `email_send_log` | /lovable/email/events<br>/<br>/accept-invite/:token<br>/candidates/:id<br>/companies<br>/companies/:id<br>+14 | condição própria: `(auth.role() = 'service_role'::text)` |
| Integrações | `email_send_state` | — | condição própria: `(auth.role() = 'service_role'::text)` |
| Integrações | `email_unsubscribe_tokens` | /accept-invite/:token<br>/candidates/:id<br>/careers/:slug<br>/careers/index<br>/companies<br>/contracts/index<br>+3 | condição própria: `(auth.role() = 'service_role'::text)` |
| Plataforma / Acesso | `job_role_default_permissions` | /settings/permissions | próprio perfil |
| Integrações | `marketplace_apps` | /settings/marketplace/:slug<br>/settings/marketplace/index | somente serviço interno |
| Plataforma / Acesso | `plan_entitlements` | /settings/billing<br>/settings/teams | somente administrador de plataforma |
| Plataforma / Acesso | `plans` | /settings/billing<br>/settings/teams | somente administrador de plataforma |
| Plataforma / Acesso | `platform_admins` | /settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/security<br>/settings/platform/status<br>/<br>+138 | somente administrador de plataforma; próprio perfil |
| Plataforma / Acesso | `platform_alert_events` | /settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/status<br>/finance/banking<br>/finance/banking/reconciliation | somente administrador de plataforma |
| Plataforma / Acesso | `platform_alert_rules` | /settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/status | somente administrador de plataforma |
| Plataforma / Acesso | `platform_sandboxes` | /settings/platform/alerts<br>/settings/platform/quotas<br>/settings/platform/sandbox<br>/settings/platform/status | somente administrador de plataforma |
| Core ERP | `profiles` | /catalog/job-profiles<br>/<br>/__root<br>/accept-invite/:token<br>/accept-invite/index<br>/admin/bug-reports<br>+184 | próprio perfil |
| Core ERP | `search_pinned` | / | condição própria: `(auth.uid() = user_id)` |
| Core ERP | `search_recent` | / | condição própria: `(auth.uid() = user_id)` |
| Core ERP | `security_scan_findings` | /settings/platform/security | somente administrador de plataforma; somente serviço interno |
| Core ERP | `security_scan_runs` | /settings/platform/security | somente administrador de plataforma; somente serviço interno |
| Core ERP | `suppressed_emails` | /accept-invite/:token<br>/candidates/:id<br>/careers/:slug<br>/careers/index<br>/companies<br>/contracts/index<br>+4 | condição própria: `(auth.role() = 'service_role'::text)` |
| Integrações | `unipile_accounts` | /candidates/:id<br>/candidates/index<br>/hunting/observability<br>/hunting/search<br>/jobs/:id<br>/settings/integrations/linkedin<br>+1 | condição própria: `(auth.uid() = owner_id)` |
| Integrações | `unipile_rate_buckets` | /candidates/:id<br>/candidates/index<br>/hunting/observability<br>/hunting/search<br>/jobs/:id<br>/settings/integrations/linkedin<br>+1 | próprio perfil |
| Integrações | `unipile_request_log` | /candidates/:id<br>/candidates/index<br>/hunting/observability<br>/hunting/search<br>/jobs/:id<br>/settings/integrations/linkedin<br>+1 | próprio perfil |
| Workflows | `workflow_time_cursors` | /api/public/hooks/workflows-tick<br>/api/public/hooks/workflows-time-triggers-tick | condição própria: `(auth.uid() = owner_id)` |

## Ação recomendada por área (visões 1a e 1b)

| Módulo | Área | Visão | Ação |
| --- | --- | --- | --- |
| TechContracts | `contracts` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechSales | `deal_line_items` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechService | `kb_articles` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechService | `macros` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_allocations` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_benefits` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_documents` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_goals` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_incidents` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_one_on_ones` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechPeople | `people_reviews` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechProjects | `projects` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechContracts | `quote_line_items` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| TechService | `sla_policies` | 1a | Trocar a exigência de criador/admin por: membro do workspace E (`user_has_permission` de update/delete do módulo OU `is_workspace_admin_v2`). Manter o criador como caminho alternativo apenas onde existir permissão `.own`. |
| Plataforma / Acesso | `access_profile_permissions` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Plataforma / Acesso | `access_profile_tools` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Plataforma / Acesso | `access_profiles` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `domain_events` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `field_permission_rules` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Plataforma / Acesso | `job_role_sets` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `ml_forecast_scores` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `ml_scoring_models` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `onboarding_runs` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Integrações | `outbound_webhooks` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Plataforma / Acesso | `permission_set_items` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Core ERP | `team_members` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Integrações | `unipile_message_log` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |
| Plataforma / Acesso | `user_roles` | 1b | Adicionar caminho por permissão do workspace ao lado da regra de criador, mantendo o bloqueio entre workspaces. |

Áreas marcadas como pessoais por desenho ficam fora da correção: restringir ao próprio usuário é o comportamento esperado.

## Checagens de criador feitas no código (independem das policies)

```text
src/components/leads/create-deal-from-lead-dialog.tsx:197:          .eq("owner_id", user.id)
src/lib/access-control/access-mutations.functions.ts:374:      .eq("owner_id", userId)
src/lib/access-control/access-mutations.functions.ts:416:      .eq("owner_id", userId)
src/lib/access-control/access-mutations.functions.ts:43:    .eq("created_by", userId)
src/lib/access-control/access-mutations.functions.ts:65:    .eq("created_by", userId)
src/lib/access-control/access.functions.ts:172:          .eq("owner_id", userId),
src/lib/access-control/access.functions.ts:173:        supabase.from("user_permission_sets").select("user_id, set_id").eq("owner_id", userId),
src/lib/access-control/access.functions.ts:81:    .eq("created_by", userId)
src/lib/access-control/field-rules.functions.ts:25:    .eq("created_by", userId)
src/lib/access-control/field-rules.functions.ts:60:      wRes.data?.created_by === userId ||
src/lib/access-control/governance.functions.ts:22:    .eq("created_by", userId)
src/lib/access-control/governance.functions.ts:38:  if (w?.created_by === userId) return;
src/lib/access-control/permissions.functions.ts:25:    .eq("created_by", userId)
src/lib/access-control/rbac-diagnostics.functions.ts:157:      const isOwner = ws.createdBy === userId;
src/lib/access-control/rbac-diagnostics.functions.ts:158:      let isAdmin = isOwner;
src/lib/access-control/rbac-diagnostics.functions.ts:97:    .eq("created_by", userId)
src/lib/access-control/resource-scope.functions.ts:30:    .eq("created_by", userId)
src/lib/access-control/role-bundle.functions.ts:104:    (r) => r.permission_sets?.module === BUNDLE_MODULE && r.permission_sets?.owner_id === userId,
src/lib/access-control/role-bundle.functions.ts:126:      .eq("owner_id", userId)
src/lib/access-control/role-bundle.functions.ts:29:          .eq("created_by", userId)
src/lib/access-control/role-bundle.functions.ts:678:          r.permission_sets?.module === BUNDLE_MODULE && r.permission_sets?.owner_id === userId,
src/lib/access-control/scope.functions.ts:21:    .eq("created_by", userId)
src/lib/api-keys.functions.ts:21:      .eq("owner_id", userId)
src/lib/api-keys.functions.ts:67:      .eq("owner_id", userId);
src/lib/api-keys.functions.ts:76:    await supabase.from("api_keys").delete().eq("id", data.id).eq("owner_id", userId);
src/lib/ats/job-copilot.functions.ts:54:      (full.owner_id === userId ||
src/lib/ats/lgpd.functions.ts:111:      .eq("owner_id", userId)
src/lib/ats/lgpd.functions.ts:119:        .eq("owner_id", userId)
src/lib/ats/lgpd.functions.ts:125:        .eq("owner_id", userId)
src/lib/ats/lgpd.functions.ts:165:        .eq("owner_id", userId);
src/lib/ats/lgpd.functions.ts:197:        .eq("owner_id", userId);
src/lib/ats/lgpd.functions.ts:223:      .eq("owner_id", userId);
src/lib/ats/lgpd.functions.ts:238:      .eq("owner_id", userId)
src/lib/ats/lgpd.functions.ts:281:      .eq("owner_id", userId);
src/lib/ats/lgpd.functions.ts:301:      .eq("owner_id", userId)
src/lib/ats/lgpd.functions.ts:337:      .eq("owner_id", userId);
src/lib/ats/lgpd.functions.ts:60:      .eq("owner_id", userId)
src/lib/banking.functions.ts:1275:    if (p.created_by && p.created_by === userId) {
src/lib/deals/sales-dashboard.server.ts:114:    effectiveScope === "me" ? q.eq("owner_id", userId) : q;
src/lib/deals/sales-dashboard.server.ts:193:          .eq("owner_id", userId)
src/lib/message-drafts.functions.ts:131:      .eq("owner_id", userId)
src/lib/message-drafts.functions.ts:45:      .eq("owner_id", userId)
src/lib/message-drafts.functions.ts:60:      .eq("owner_id", userId)
src/lib/message-drafts.functions.ts:95:        .eq("owner_id", userId)
src/lib/roles.functions.ts:97:    if (data.workspace_owner_id === userId) return { role: "admin" as AppRole };
src/lib/teams.functions.ts:589:    if (data.member_user_id === userId) throw new Error("Você não pode alterar seu próprio papel.");
src/lib/teams.functions.ts:631:    const isOwner = data.member_user_id === userId;
src/lib/teams.functions.ts:631:    const isOwner = data.member_user_id === userId;
src/lib/teams.functions.ts:652:    if (!isOwner) {
src/lib/teams.functions.ts:690:    if (data.member_user_id === userId) throw new Error("Você não pode remover a si mesmo.");
src/lib/use-my-role.ts:28:        supabase.from("workspaces").select("id").eq("created_by", user.id).limit(1),
src/lib/workspace/admin-guard.server.ts:31:  return (ws as { created_by?: string | null } | null)?.created_by === userId;
src/lib/workspace/modules.functions.ts:32:    .eq("created_by", userId)
src/routes/_authenticated/leads.tsx:360:          (!user?.id || q.owner_id === user.id),
```

## Módulos com escrita em `src/lib` sem gate explícito de permissão (221)

Lista para triagem: a ausência de `assertPermission` não é erro quando a policy de workspace já cobre a operação.

```text
src/lib/ab-tests.functions.ts
src/lib/access-control/access-mutations.functions.ts
src/lib/access-control/bulk-delete-report.ts
src/lib/access-control/role-bundle.functions.ts
src/lib/access-profiles.functions.ts
src/lib/activity-reminders.server.ts
src/lib/ads-sync.functions.ts
src/lib/ai-agent/tools.functions.ts
src/lib/api-keys.functions.ts
src/lib/api-keys/auth.server.ts
src/lib/api-keys/meetings.server.ts
src/lib/ats/cv-parse-pdf.functions.ts
src/lib/ats/cv-parse.functions.ts
src/lib/ats/email-engine.server.ts
src/lib/ats/fraud.functions.ts
src/lib/ats/hunting-enrich.functions.ts
src/lib/ats/hunting.functions.ts
src/lib/ats/interview-kits.functions.ts
src/lib/ats/interviews-engine.server.ts
src/lib/ats/interviews.functions.ts
src/lib/ats/job-postings.functions.ts
src/lib/ats/lgpd.functions.ts
src/lib/ats/linkedin-applicants-sync.server.ts
src/lib/ats/linkedin-job-config.functions.ts
src/lib/ats/notetaker.functions.ts
src/lib/ats/offers.functions.ts
src/lib/ats/pipelines.functions.ts
src/lib/ats/public-offer.functions.ts
src/lib/ats/referrals.functions.ts
src/lib/ats/scheduling.functions.ts
src/lib/ats/scorecards.functions.ts
src/lib/ats/self-schedule.functions.ts
src/lib/ats/sourcing-inbox.functions.ts
src/lib/ats/sourcing-sequences-worker.server.ts
src/lib/ats/sourcing-sequences.functions.ts
src/lib/ats/stage-emails.functions.ts
src/lib/ats/talent-crm.functions.ts
src/lib/ats/unipile-hunting.functions.ts
src/lib/audit-export.functions.ts
src/lib/audit-export.server.ts
src/lib/audit-session.test.ts
src/lib/audit-session.ts
src/lib/banking.functions.ts
src/lib/banking/charges.server.ts
src/lib/banking/payments.server.ts
src/lib/banking/tick.server.ts
src/lib/booking.functions.ts
src/lib/booking/engine.server.ts
src/lib/branding.functions.ts
src/lib/bug-reports.functions.ts
src/lib/calendar.functions.ts
src/lib/calendar/engine.server.ts
src/lib/charging-templates.functions.ts
src/lib/chat.functions.ts
src/lib/chunk-reload.ts
src/lib/contract-approvals.functions.ts
src/lib/contracts/title.server.ts
src/lib/cron-observability.server.ts
src/lib/custom-objects.functions.ts
src/lib/custom-properties.functions.ts
src/lib/dashboards.functions.ts
src/lib/db/delete-guarded.ts
src/lib/deal-loss-reasons.functions.ts
src/lib/delete-guard.ts
src/lib/dialog-refresh.ts
src/lib/dunning-runner.server.ts
src/lib/dunning.functions.ts
src/lib/email-accounts.functions.ts
src/lib/email-broadcast.functions.ts
src/lib/email-broadcast/engine.server.ts
src/lib/email-oauth.server.ts
src/lib/email-send.functions.ts
src/lib/email-templates.functions.ts
src/lib/email-tracking.server.ts
src/lib/esign.functions.ts
src/lib/feature-flags.functions.ts
src/lib/files.functions.ts
src/lib/finance-recurrences.functions.ts
src/lib/finance-recurrences.server.ts
src/lib/finance.functions.ts
src/lib/forms.functions.ts
src/lib/gmail-sync.functions.ts
src/lib/gmail-sync.server.ts
src/lib/gmail.server.ts
src/lib/goals.functions.ts
src/lib/grid-preferences.functions.ts
src/lib/grid/bulk-edit.functions.ts
src/lib/hubspot-relink.functions.ts
src/lib/hubspot-twoway.functions.ts
src/lib/integration-notifier.server.ts
src/lib/integrations/apollo-phone-reveal.server.ts
src/lib/integrations/apollo-phone-webhook.server.ts
src/lib/integrations/apollo.functions.ts
src/lib/integrations/brasilapi-cnpj.functions.ts
src/lib/integrations/clickup.functions.ts
src/lib/integrations/contaazul-api.server.ts
src/lib/integrations/contaazul-oauth-diagnostics.server.ts
src/lib/integrations/contaazul-state.server.ts
src/lib/integrations/contaazul-steps.server.ts
src/lib/integrations/enrichment-engine.server.ts
src/lib/integrations/hubspot-owners.functions.ts
src/lib/integrations/hubspot-pipelines.server.ts
src/lib/integrations/hubspot-push.server.ts
src/lib/integrations/hubspot-step-compare.server.ts
src/lib/integrations/hubspot-steps-discovery.server.ts
src/lib/integrations/hubspot-steps-state.server.ts
src/lib/integrations/hubspot-steps-upsert.server.ts
src/lib/integrations/hubspot-steps.server.ts
src/lib/integrations/hubspot-tick.server.ts
src/lib/integrations/hubspot.functions.ts
src/lib/integrations/hubspot.server.ts
src/lib/integrations/lusha.functions.ts
src/lib/integrations/viacep.functions.ts
src/lib/invoices.functions.ts
src/lib/landing-pages.functions.ts
src/lib/lead-convert.ts
src/lib/lead-delete.ts
src/lib/lead-sources.ts
src/lib/leads/deal-intent.functions.ts
src/lib/leads/lead-relations.ts
src/lib/legal-entities.functions.ts
src/lib/legal-entity-groups.functions.ts
src/lib/lgpd.functions.ts
src/lib/live-chat.functions.ts
src/lib/marketplace.functions.ts
src/lib/media.functions.ts
src/lib/meetings-public.functions.ts
src/lib/meetings.functions.ts
src/lib/message-drafts.functions.ts
src/lib/modules/module-branding.functions.ts
src/lib/notifications.functions.ts
src/lib/offline-queue.ts
src/lib/onboarding/onboarding.functions.ts
src/lib/payments-settings.functions.ts
src/lib/people/allocations.functions.ts
src/lib/people/benefits.functions.ts
src/lib/people/billing.functions.ts
src/lib/people/documents.functions.ts
src/lib/people/finance-sync.functions.ts
src/lib/people/onboarding.functions.ts
src/lib/people/performance.functions.ts
src/lib/people/timesheet.functions.ts
src/lib/people/wellbeing.functions.ts
src/lib/pipelines.functions.ts
src/lib/pipelines/substatuses.ts
src/lib/platform-admin.functions.ts
src/lib/platform-observability.functions.ts
src/lib/portal.functions.ts
src/lib/project-hierarchy.functions.ts
src/lib/project-list-extras.functions.ts
src/lib/project-tasks-advanced.functions.ts
src/lib/project-timer.functions.ts
src/lib/projects/time-approval.functions.ts
src/lib/projects/time-tracking.functions.ts
src/lib/property-groups.functions.ts
src/lib/proposals.functions.ts
src/lib/prospecting-campaigns.functions.ts
src/lib/prospecting-scripts.functions.ts
src/lib/prospecting.functions.ts
src/lib/prospecting/qualification-activity.server.ts
src/lib/prospecting/qualification-enrichment.functions.ts
src/lib/prospecting/qualification-enrichment.server.ts
src/lib/prospecting/qualifications.functions.ts
src/lib/prospecting/use-linkedin-enrichment.ts
src/lib/push.functions.ts
src/lib/push.server.ts
src/lib/quote-templates.functions.ts
src/lib/quotes.functions.ts
src/lib/record-layouts.functions.ts
src/lib/recurring.functions.ts
src/lib/reports.functions.ts
src/lib/roles.functions.ts
src/lib/rotation.functions.ts
src/lib/rotation/engine.server.ts
src/lib/saved-views.ts
src/lib/scheduled-exports.functions.ts
src/lib/scheduled-exports/engine.server.ts
src/lib/scim-auth.server.ts
src/lib/scim.functions.ts
src/lib/scoring.functions.ts
src/lib/scoring/engine.server.ts
src/lib/scoring/icp.functions.ts
src/lib/scoring/icp.server.ts
src/lib/sdr-agent.functions.ts
src/lib/search/recent-pinned.functions.ts
src/lib/segments.functions.ts
src/lib/segments/engine.server.ts
src/lib/sequences.functions.ts
src/lib/sequences/engine.server.ts
src/lib/services/billing.server.ts
src/lib/services/billing.test.ts
src/lib/sla-policies.functions.ts
src/lib/sla.functions.ts
src/lib/slack.functions.ts
src/lib/snippets.functions.ts
src/lib/surveys.functions.ts
src/lib/surveys/survey-activity.functions.ts
src/lib/surveys/survey-templates.functions.ts
src/lib/task-queues.functions.ts
src/lib/teams.functions.ts
src/lib/teams/unlinked.server.ts
src/lib/timeline/activity-mutations.ts
src/lib/twilio-signature.server.ts
src/lib/unipile/accounts.functions.ts
src/lib/unipile/client.server.ts
src/lib/unipile/messaging.functions.ts
src/lib/user-groups.functions.ts
src/lib/webhooks/dispatcher.server.ts
src/lib/whatsapp-campaigns.functions.ts
src/lib/whatsapp-meta.functions.ts
src/lib/whatsapp.functions.ts
src/lib/workflow-action-templates.functions.ts
src/lib/workflow-subscriptions.functions.ts
src/lib/workflows/engine-runtime.server.ts
src/lib/workflows/engine/actions-assign.server.ts
src/lib/workflows/engine/actions-ats.server.ts
src/lib/workflows/engine/actions-fields.server.ts
src/lib/workflows/engine/actions-records.server.ts
src/lib/workspace-invites.functions.ts
src/lib/workspace/modules.functions.ts
src/lib/zapier.functions.ts
```

