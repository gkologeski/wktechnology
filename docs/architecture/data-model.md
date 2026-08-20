# Modelo de dados

Banco: PostgreSQL gerenciado (Supabase / Lovable Cloud). Schema `public` com
**312 tabelas base**, **1.284 políticas RLS** cobrindo **311 tabelas**.

Fonte de verdade dos tipos: `src/integrations/supabase/types.ts` (gerado, não
editar). Atalhos convenientes em `src/lib/db-types.ts`.

## 1. Colunas transversais

| Coluna | Presente em | Significado |
| --- | --- | --- |
| `workspace_id` | 267 tabelas | **Isolamento de tenant.** Base de toda política RLS de dados de negócio. |
| `assigned_to` | 65 tabelas | Responsável pelo registro. Filtro/coluna de UI — não é segurança. |
| `owner_id` | 220 tabelas | Legado em migração para `workspace_id` + `assigned_to`. Não usar como filtro novo. |
| `created_at` / `updated_at` | maioria | `updated_at` mantido por triggers `*_touch_updated_at`. |

Tabelas **sem** `workspace_id` (globais de plataforma, tabelas-ponte ou
escopadas por usuário) — não adicione `workspace_id` a elas sem análise:

`access_profiles`, `access_profile_permissions`, `access_profile_tools`,
`app_settings`, `audit_logs`, `bug_report_analyses`, `chat_conversations`,
`chat_conversation_members`, `chat_messages`, `chat_message_attachments`,
`copilot_messages`, `cron_run_logs`, `deal_contacts`, `email_send_log`,
`email_send_state`, `email_unsubscribe_tokens`, `enrichment_job_items`,
`financial_entry_allocations`, `job_role_default_permissions`, `job_role_sets`,
`marketplace_apps`, `modules`, `permissions`, `permission_set_items`, `plans`,
`plan_entitlements`, `platform_admins`, `platform_alert_rules`,
`platform_alert_events`, `platform_sandboxes`, `profiles`, `search_pinned`,
`search_recent`, `security_scan_findings`, `security_scan_runs`,
`segment_members`, `suppressed_emails`, `team_members`, `unipile_rate_buckets`,
`usage_counters`, `user_grid_preferences`, `user_group_members`, `user_roles`,
`workspaces`, `workspace_subscriptions`.

## 2. Tabelas por domínio

### 2.1 Tenant, acesso e plataforma
`workspaces`, `workspace_members`, `workspace_invites`,
`workspace_invite_settings`, `workspace_modules`, `workspace_branding`,
`workspace_subscriptions`, `modules`, `module_branding`, `plans`,
`plan_entitlements`, `profiles`, `teams`-equivalentes (`team_members`),
`user_groups`, `user_group_members`, `user_roles`, `user_job_roles`,
`user_permission_sets`, `job_roles`, `job_role_sets`,
`job_role_default_permissions`, `job_role_permission_overrides`,
`access_profiles`, `access_profile_permissions`, `access_profile_tools`,
`permissions`, `permission_sets`, `permission_set_items`,
`field_permission_rules`, `rotation_rules`, `scim_tokens`, `api_keys`,
`platform_admins`, `platform_sandboxes`, `platform_alert_rules`,
`platform_alert_events`, `feature_flags`, `usage_counters`, `credit_ledger`,
`credit_limits`, `app_settings`.

Auditoria e observabilidade: `audit_logs`, `access_audit_log`, `audit_exports`,
`audit_export_runs`, `domain_events`, `property_history`, `ip_access_log`,
`cron_run_logs`, `security_scan_runs`, `security_scan_findings`,
`bug_reports`, `bug_report_analyses`, `notifications`, `push_subscriptions`.

### 2.2 TechSales / CRM
`leads`, `lead_sources`, `contacts`, `companies`, `deals`, `deal_contacts`,
`deal_line_items`, `deal_loss_reasons`, `pipelines`, `stage_entries`,
`activities`, `activity_comments`, `activity_survey_responses`, `meetings`,
`meeting_participants`, `meeting_summaries`, `tasks` (via `task_queues`,
`task_queue_items`), `notes` (em `activities`), `products`, `service_catalog`,
`services`, `quotes`, `quote_line_items`, `quote_templates`, `proposals`,
`proposal_clauses`, `proposal_approvals`, `subscriptions`,
`subscription_invoices`, `subscription_types`, `recurring_plans`,
`custom_objects`, `custom_object_records`, `custom_properties`,
`property_groups`-equivalentes, `record_layouts`, `saved_views`, `segments`,
`segment_members`, `goals`, `icp_criteria`, `scoring_rules`,
`score_contributions`, `score_events`, `scoring_cursors`, `ml_scoring_models`,
`ml_forecast_scores`, `ab_tests`, `ab_test_events`, `attribution_touchpoints`.

Prospecção: `prospecting_campaigns`, `prospecting_campaign_variants`,
`prospecting_cadences`, `prospecting_cadence_steps`, `prospecting_enrollments`,
`prospecting_queues`, `prospecting_questionnaires`, `prospecting_questions`,
`prospecting_qualifications`, `prospecting_results`, `prospecting_scripts`,
`prospecting_searches`, `prospecting_call_attempts`, `sdr_playbooks`,
`sdr_enrollments`, `enrichment_jobs`, `enrichment_job_items`.

### 2.3 TechHire / ATS (prefixo `ats_`)
Núcleo: `ats_jobs`, `ats_job_postings`, `ats_pipelines`, `ats_candidates`,
`ats_applications`, `ats_application_events`, `ats_match_scores`.

Avaliação: `ats_scorecards`, `ats_scorecard_responses`, `ats_interview_kits`,
`ats_interviews`, `ats_interviewer_pools`, `ats_interviewer_pool_members`,
`ats_interviewer_availability`, `ats_async_video_responses`.

Sourcing/CRM de talentos: `ats_sourcing_sequences`,
`ats_sourcing_sequence_steps`, `ats_sourcing_enrollments`,
`ats_sourcing_step_log`, `ats_talent_pools`, `ats_talent_pool_members`,
`ats_referral_programs`, `ats_referrals`, `ats_hunting_captures`,
`ats_hunting_templates`.

Comunicação e oferta: `ats_stage_emails`, `ats_stage_email_log`,
`ats_candidate_email_queue`, `ats_offers`, `ats_daily_briefings`.

Compliance e risco: `ats_candidate_consents`, `ats_dsar_requests`,
`ats_candidate_flags`.

Regras conhecidas: um único pipeline default por workspace (trigger
`ats_pipelines_enforce_single_default`); `ats_set_workspace_id` preenche o
tenant; silver medalists via `ats_auto_add_silver_medalist` /
`ensure_silver_medalist_pool`; anonimização por `anonymize_ats_candidate`.

### 2.4 TechPeople
`people`, `people_allocations`, `people_benefits`, `people_documents`,
`people_events`, `people_goals`, `people_incidents`, `people_reviews`,
`people_one_on_ones`, `people_psychosocial_assessments`,
`people_onboarding_plans`, `people_onboarding_tasks`,
`people_onboarding_templates`, `job_profiles`, `onboarding_runs`,
`onboarding_templates`.

Triggers relevantes: `people_sync_workspace_id`,
`people_child_sync_workspace_id`, `people_document_derive_status`,
`people_documents_sync_status`, `people_allocations_sync_manager`,
`people_log_event`, `people_touch_updated_at`. Autorização por
`can_view_person`, `can_view_person_sensitive`, `can_manage_person`.

### 2.5 TechContracts
`contracts`, `contract_events`, `contract_approvals`, `contract_templates`,
`contract_template_services`, `contract_link_ai_suggestions`,
`contracting_presets`, `esign_documents`, `esign_signers`,
`esign_attachments`, `esign_audit`, `charging_templates`, `legal_entities`,
`legal_entity_groups`, `legal_entity_group_members`.

Enums: `contract_status`, `contract_role`, `contract_approval_stage`,
`contract_approval_status`. Verificação de integridade da assinatura:
`esign_verify_hash`, `esign_check_completion`, `ats_offers_sync_on_esign`.

### 2.6 TechService
`tickets`, `sla_policies`, `macros`, `kb_articles`, `kb_categories`,
`live_chat_sessions`, `live_chat_messages`, `playbooks`, `playbook_responses`,
`survey_templates`, `survey_template_questions`, `survey_responses`,
`message_sentiments`.

Funções: `apply_sla_to_ticket`, `find_sla_policy`, `lookup_stage_sla`,
`create_ticket_survey`.

### 2.7 TechFinance
`financial_entries`, `financial_entry_allocations`, `financial_payments`,
`financial_recurrences`, `financial_categories`, `financial_cost_centers`,
`financial_bank_accounts`, `customer_invoices`, `customer_payments`,
`nfse_invoices`, `dunning_policies`, `dunning_runs`, `bank_connections`,
`bank_connection_tokens`, `bank_connection_events`, `bank_charges`,
`bank_payments`, `bank_statement_transactions`, `payment_webhook_events`.

Enums: `financial_direction`, `financial_entry_status`,
`financial_origin_type`, `financial_category_kind`. Recalculo por
`recalc_financial_entry` e `financial_payments_after_change`.

### 2.8 TechProjects
`projects`, `project_spaces`, `project_folders`, `project_lists`,
`project_list_custom_fields`, `project_list_templates`, `project_members`,
`project_milestones`, `project_tasks`, `project_task_statuses`,
`project_task_checklists`, `project_task_dependencies`,
`project_time_entries`, `project_updates`.

Enums: `project_status`, `project_member_role`, `project_milestone_status`,
`project_task_status`, `project_task_priority`.

### 2.9 Comunicação e marketing
`email_accounts`, `email_messages`, `email_threads`, `email_templates`,
`email_snippets`, `snippets`, `email_broadcasts`,
`email_broadcast_recipients`, `email_tracking_events`, `email_unsubscribes`,
`email_unsubscribe_tokens`, `email_send_log`, `email_send_state`,
`suppressed_emails`, `message_drafts`, `timeline_pins`, `sequences`,
`sequence_enrollments`, `forms`, `form_submissions`, `landing_pages`,
`landing_page_events`, `booking_pages`, `bookings`, `calendar_accounts`,
`calendar_events`, `meet_recording_index`, `media_assets`, `user_files`,
`user_file_folders`, `chat_*`, `whatsapp_*`, `wa_*`, `unipile_*`,
`slack_integrations`, `slack_event_routes`, `voice_agent_settings`,
`live_chat_*`.

### 2.10 Automação e integrações
`workflows`, `workflow_runs`, `workflow_events`, `workflow_approvals`,
`workflow_subscriptions`, `workflow_action_templates`,
`workflow_time_cursors`, `outbound_webhooks`, `webhook_deliveries`,
`zapier_subscriptions`, `integrations`, `marketplace_apps`,
`marketplace_installations`, `hubspot_owners`, `hubspot_sync_state`,
`ads_accounts`, `ads_audiences`, `ads_lead_forms`, `dashboards`,
`dashboard_widgets`, `custom_reports`, `report_schedules`, `ai_summaries`,
`copilot_sessions`, `copilot_messages`.

## 3. Enums principais

Consulte a lista completa com `select typname, enum_range(null::typname)`.
Os mais usados: `app_role` (`admin|manager|member`), `team_role`,
`data_scope` (`own|team|workspace|custom`), `access_scope`
(`none|own|team|all`), `perm_action`
(`view|create|update|delete|export|approve|assign|manage`), `perm_scope`
(`own|team|workspace|org`), `field_mode` (`hidden|masked|readonly`),
`lead_status`, `deal_stage`, `activity_type` (inclui `survey`),
`contract_status`, `people_status`, `people_employment_type`,
`project_task_status`, `financial_entry_status`, `ticket_status`,
`ticket_priority`, `esign_doc_status`, `quote_status`, `proposal_status`,
`prospecting_*`, `service_type`, `service_cadence`, `subscription_status`.

## 4. Funções de banco relevantes

Acesso: `user_can_act`, `has_role`, `is_workspace_member`,
`is_workspace_admin`, `is_workspace_admin_of`, `is_workspace_admin_v2`,
`is_platform_admin`, `current_user_permissions`,
`current_user_permissions_json`, `current_user_workspaces`,
`default_workspace_for_user`, `can_write_owner`, `can_manage_access_scope`,
`can_access_ats_job`, `can_view_person*`, `can_manage_person`,
`get_entitlement_limit`, `has_entitlement`, `assert_entity_limit`.

Eventos/automação: `enqueue_workflow_event`, `log_audit_event`,
`log_property_changes`, `enqueue_email`, `email_queue_dispatch`,
`email_queue_wake`, `move_to_dlq`, `platform_cron_status`.

Domínio: `recalc_deal_value`, `recompute_deal_value`, `recalc_financial_entry`,
`get_entity_timeline`, `get_entity_field_catalog`, `dashboard_metrics`,
`companies_facets`, `leads_source_facets`, `link_contacts_by_email_domain`,
`contact_link_company_by_domain`, `auto_advance_lead_stage`,
`auto_advance_lead_on_inbound_email`, `purge_workspace`.

## 5. Regras para migrations

1. Ordem obrigatória: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY`
   → `CREATE POLICY`.
2. Grants padrão de tabela de usuário:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
-- GRANT SELECT ... TO anon; somente se existir política pública explícita
```

3. Toda tabela de negócio nova nasce com `workspace_id uuid not null` e
   política baseada em `is_workspace_member(workspace_id)` (leitura) +
   `user_can_act(...)` quando houver RBAC granular.
4. Nunca criar objetos nos schemas `auth`, `storage`, `realtime`,
   `supabase_functions`, `vault` (inclusive triggers).
5. Migrations devem ser compatíveis com dados existentes (aditivas; backfill
   explícito quando a coluna for `not null`).
