---
name: Security memory
description: RLS policies, accepted security postures, webhooks authentication (cron, Twilio), public routes details, and recurring security scans.
type: feature
---

# Security posture

## Workspace data

- Tudo workspace-escopado via `workspace_id` + `current_user_workspaces()` (RLS `ws_*`). Não criar policies legadas comparando `owner_id` com `workspace UUID`.
- Tabelas core de CRM (activities, companies, contacts, deals, leads, pipelines, products, proposals, quotes, tickets, workflows) usam APENAS o conjunto canônico `ws_*`. Não recriar policies `*_admin_*`/`*_team_*` — foram removidas por consolidarem união permissiva com o conjunto novo.
- Toda `CREATE TABLE public.*` na mesma migration: `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated`, `GRANT ALL TO service_role`.
- Nenhuma leitura `anon` em tabelas de negócio.
- Consolidação de writes (jul/2026) em `calendar_events`, `meetings`, `email_threads`, `email_messages`, `email_broadcasts`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_campaigns`, `quote_line_items`, `quote_templates`: **uma única** policy `*_write_update` + `*_write_delete` = `is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid())`. SELECT/INSERT permanecem `ws_*` (workspace inteiro). Não recriar `ws_update_*`/`ws_delete_*`/`*_admin_update`/`*_team_update` para essas tabelas.
- Limpeza de legado (ago/2026): `custom_reports`, `dashboards`, `dashboard_widgets`, `email_templates`, `email_snippets`, `macros`, `sequences`, `sequence_enrollments`, `forms`, `form_submissions`, `custom_objects`, `custom_object_records`, `webhook_deliveries`, `workflow_runs`, `saved_views` usam APENAS o conjunto canônico `ws_*` (SELECT/INSERT/UPDATE/DELETE). Não recriar `*_admin_*`/`*_team_*` nessas tabelas.
- `landing_pages`, `sla_policies` e `outbound_webhooks` ainda usam o conjunto legado `*_admin_*`/`*_team_*` como fonte única de enforcement (não existe `ws_*` para elas). Não remover essas policies sem antes criar o conjunto canônico equivalente — removê-las derrubaria todo o acesso.
- Todas as policies de tabelas de negócio devem declarar `TO authenticated` (nunca o role `public`), mesmo quando a expressão já depende de `auth.uid()`.

## Tabelas de controle de acesso (owner-scoped)

- `job_roles`, `permission_sets`, `user_permission_sets`, `field_permission_rules`, `user_job_roles` usam a coluna `owner_id` (auth.uid do dono do workspace). Não renomear de volta para `workspace_id` e não comparar `owner_id` com `workspaces.id`. Policies: `*_read` (is_system OR owner_id = auth.uid() OR shares_workspace_with(owner_id)); `*_write` FOR ALL restrita a `owner_id = auth.uid()`.

## Tabelas com segredos de integração

- `slack_integrations`: SELECT/INSERT/UPDATE/DELETE apenas para `is_workspace_admin_v2`. Não recriar policy ALL permissiva.
- `wa_business_accounts`: SELECT/INSERT/UPDATE/DELETE apenas para `is_workspace_admin_v2`. Membros comuns não podem criar/sobrescrever `access_token`.
- `integrations`: owner-scoped (`owner_id = auth.uid()`) por design — admin do workspace gerencia via server function com service_role.
- `audit_export_runs`: SELECT apenas para admins; INSERT/UPDATE/DELETE somente via service_role (cron `audit-export-tick`). Default-deny para `authenticated` é intencional.
- `esign_audit` e `esign_signers`: INSERT exige `owner_id = auth.uid()`, admin do workspace, ou ownership/admin no `esign_documents` pai. Não recriar INSERT amplo `workspace_id IN current_user_workspaces()`.
- `customer_invoices`: INSERT exige `workspace_id IN current_user_workspaces()` **e** `owner_id = auth.uid()`. Não voltar para policy só de membership.
- `customer_payments` e `nfse_invoices`: INSERT restrito a `is_workspace_admin_v2(workspace_id, auth.uid())`. Webhooks/emissão de NFS-e por serviços usam service_role (bypass RLS). Não recriar policy ampla de membership.
- `whatsapp-media` (storage): `media_url` em `whatsapp_messages` guarda APENAS o path do objeto; as policies `whatsapp_media_workspace_read/update/delete` exigem `EXISTS (whatsapp_messages wm WHERE wm.media_url = objects.name AND wm.workspace_id IN current_user_workspaces())`. Não voltar para join `workspace_members` ↔ uploader nem usar URL completa.
- `profiles.phone`: `SELECT` na coluna revogado para `anon`/`authenticated`. Leitura própria via `get_my_phone()`; listas de equipe/admin via service_role em server functions. Não conceder `SELECT (phone)` de volta.
- `meetings`: `ws_insert_meetings` exige `owner_id = auth.uid()` em todos os ramos (inclusive `workspace_id IS NULL`). Não reintroduzir ramo de admin criando para outro owner.
- `kb_articles`: sem policy `anon` e `SELECT` revogado de `anon` (policy `kb_anon_read_published` removida). A KB pública (`/kb`, `/kb/$slug`) é servida pelos server functions `listKbPublic`/`getKbArticlePublic` com service_role e projeção mínima. Não recriar leitura anon.
- `people_incidents`: enforcement único via checagens por pessoa (`can_view_person_sensitive` / `can_manage_person`, com fallback `is_workspace_admin_v2(owner_id)` quando `person_id IS NULL`). As policies `people_incidents_perm_select/insert/update` foram removidas por ampliarem visibilidade de casos confidenciais — não recriar.
- `media_assets`: SELECT restrito a `owner_user_id = auth.uid()`, `assigned_to = auth.uid()` ou `is_workspace_admin` (policy `media_assets_scoped_select`). A biblioteca de mídia da UI lê via server functions com service_role. Não recriar `media_assets_workspace_select` (workspace-wide).
- Storage `whatsapp-media`: conjunto único por operação (`whatsapp_media_insert/read/update/delete`) = pasta do próprio uid (necessária para upload + signed URL) OR join verificado em `whatsapp_messages` com workspace do usuário. Não recriar os conjuntos separados `whatsapp_media_owner_*` / `whatsapp_media_workspace_*`.
- `sla_policies`: conjunto canônico `sla_policies_ws_*` (membership) + gate RESTRICTIVE `sla_perm_*` (admin do workspace ou `techservice.sla.*`). Policies legadas `sla_policies_admin_*`, `sla_policies_team_*`, `sla_policies_select/insert/update/delete` foram removidas — não recriar.
- ATS sourcing/talent pools (`ats_talent_pools`, `ats_referral_programs`, `ats_interviewer_pools`, `ats_sourcing_sequences`, `ats_applications`): um conjunto por operação baseado em `owner_id` / `can_write_owner` / `is_workspace_admin_of` (+ `can_access_ats_job` em candidaturas), com gates RESTRICTIVE de RBAC TechHire. Policies de membership puro (`*_workspace_*`, `seq_workspace_*`, `ref_prog_*`, `pools owner all`, `ats_applications_owner_all`) foram removidas — não recriar.
- Storage `media`: `media_storage_update` restrito ao uploader (`owner = auth.uid()` ou pasta do próprio uid) ou admin do workspace, igual ao delete. Leitura por qualquer membro do workspace é intencional (biblioteca de mídia compartilhada); não reportar como vulnerabilidade.
- `ats_talent_pool_members`: escrita (INSERT/UPDATE/DELETE) apenas via `owner_id = auth.uid()`, `can_write_owner(owner_id, auth.uid())` ou `is_workspace_admin_of`. As policies `*_workspace_insert/update/delete` (membership pura) foram removidas — não recriar. SELECT workspace-wide é intencional.
- TechHire RBAC: policies usam `techhire_rbac_gate(auth.uid(), owner_id, '<perm>')`, que resolve o workspace do próprio registro e chama `user_has_permission(user, workspace_id, perm)`. Não usar a variante de 2 argumentos (`user_has_permission(user, perm)`) em policies ligadas a linhas — ela agrega permissões de todos os workspaces do usuário.
- `app_settings`: policy RESTRICTIVE `app_settings_deny_all` (false/false) para `anon`/`authenticated` é intencional (fail-closed). Toda leitura/escrita é feita por service_role em rotas de cron (`prospecting-dial-tick`) e server functions, que fazem bypass de RLS. Não reportar como vulnerabilidade nem adicionar policies para clientes.
- `ats_stage_emails`: conjunto único por operação (`ats_stage_emails_select/insert/update/delete`) = `owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid())`. Policies duplicadas `own ats_stage_emails select/write` e `*_admin_*`/`*_team_*` foram removidas — não recriar.
- `financial_entries`: `ws_financial_entries_select` = membership do workspace **e** (admin `is_workspace_admin_v2` OR `finance.read` OR (`owner_id`/`assigned_to` = auth.uid() **e** `techfinance.entries.create.own` ainda vigente)). Criador sem permissão financeira ativa não lê mais lançamentos antigos — não voltar para `owner_id = auth.uid()` puro.
- `ats_hunting_captures`: policies explícitas por operação, estritamente por usuário (`owner_id = auth.uid()`; INSERT exige também `captured_by IS NULL OR captured_by = auth.uid()`). `owner_id` é sempre um `auth.users.id` (nunca `workspaces.id`), então não há exposição cross-user do `raw_payload`. Não criar leitura workspace-wide nessa tabela.

## Webhooks & cron

- `/api/public/hooks/*-tick` exigem `Authorization: Bearer ${CRON_SECRET}` via `requireCronAuth`.
- Twilio webhooks: validar `X-Twilio-Signature` com `TWILIO_AUTH_TOKEN`.
- Meta/WhatsApp: validar assinatura com `META_WHATSAPP_APP_SECRET`.
- Stripe: validar com `STRIPE_WEBHOOK_SECRET`.
- `payment_webhook_events`: sem policies de INSERT/UPDATE/DELETE autenticadas (apenas service_role). Default-deny é proposital.

## Rotas públicas

- `/quote/$token`, `/sign/$token`, `/portal/$token`, `/book/$slug`, `/wa/$slug`, `/lp/$slug`, `/kb`, `/sales`, `/terms`, `/privacy`, `/dpa`, `/refund` são públicas por design.
- `/api/public/forms/*`, `/api/public/widget/*`, `/api/public/booking/*` aceitam input não-autenticado mas validam com Zod e rate-limit no handler.
- `live_chat_sessions`: sem policy INSERT por autenticados — sessões são criadas exclusivamente via `/api/public/widget/session` com service_role. Aceitável e intencional; não adicionar policy INSERT cliente.
- `landing_page_events`: sem policy `INSERT` para `anon`/`authenticated`. Toda ingestão passa pelo server function `trackLpEvent` (supabaseAdmin + Zod com limites de keys/tamanho em `utm` e `metadata`). Não recriar `lpe_anon_insert`.
- `landing_pages`: sem leitura `anon` (policy `lp_public_read` removida e `SELECT` revogado de `anon`). `/lp/$slug` renderiza via server function `getPublishedBySlug` (service_role) com projeção mínima `id,title,description,blocks,theme,seo,slug` — sem `owner_id`, `assigned_to` ou contadores de views/conversões. Não recriar policy anon nem ampliar a projeção.
- `booking_pages`: ausência de policy `anon` é intencional e correta. `/book/$slug` lê via `/api/public/booking/$slug` → `getBookingPageBySlug` (service_role) devolvendo apenas campos de apresentação. Não reportar falta de leitura anon nessa tabela como vulnerabilidade.

## Varreduras automáticas (Release pós-6)

- Cron `security-scan-tick` (diário 03:00 UTC) chama `/api/public/hooks/security-scan-tick`.
- Coletor SQL `public.security_scan_collect()` (SECURITY DEFINER, search_path fixo, EXECUTE apenas service_role) checa: tabelas em `public` sem RLS, RLS sem policies, GRANTs para `anon`, funções SECURITY DEFINER sem `search_path`.
- Route handler também checa presença de `CRON_SECRET`, `TWILIO_AUTH_TOKEN`, `META_WHATSAPP_APP_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- Resultados em `security_scan_runs` / `security_scan_findings` (visíveis apenas para platform_admins).
- Findings ≥ warning geram `notifications` para todos os `platform_admins`.
- UI: `/admin/security-scans` com botão "Rodar agora".
