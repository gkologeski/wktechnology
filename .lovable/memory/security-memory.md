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
- `whatsapp-media` (storage): `media_url` em `whatsapp_messages` guarda APENAS o path do objeto; a policy `whatsapp_media_workspace_read` junta `wm.media_url = objects.name` + `is_workspace_member`. Não trocar para URL completa.

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

## Varreduras automáticas (Release pós-6)
- Cron `security-scan-tick` (diário 03:00 UTC) chama `/api/public/hooks/security-scan-tick`.
- Coletor SQL `public.security_scan_collect()` (SECURITY DEFINER, search_path fixo, EXECUTE apenas service_role) checa: tabelas em `public` sem RLS, RLS sem policies, GRANTs para `anon`, funções SECURITY DEFINER sem `search_path`.
- Route handler também checa presença de `CRON_SECRET`, `TWILIO_AUTH_TOKEN`, `META_WHATSAPP_APP_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- Resultados em `security_scan_runs` / `security_scan_findings` (visíveis apenas para platform_admins).
- Findings ≥ warning geram `notifications` para todos os `platform_admins`.
- UI: `/admin/security-scans` com botão "Rodar agora".
