---
name: Security memory
description: RLS policies, accepted security postures, webhooks authentication (cron, Twilio), public routes details, and recurring security scans.
type: feature
---
# Security posture

## Workspace data
- Tudo workspace-escopado via `workspace_id` + `current_user_workspaces()` (RLS `ws_*`). Não criar policies legadas comparando `owner_id` com `workspace UUID`.
- Toda `CREATE TABLE public.*` na mesma migration: `GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated`, `GRANT ALL TO service_role`.
- Nenhuma leitura `anon` em tabelas de negócio.

## Tabelas com segredos de integração
- `slack_integrations`: SELECT/INSERT/UPDATE/DELETE apenas para `is_workspace_admin_v2`. Não recriar policy ALL permissiva.
- `wa_business_accounts`: SELECT/INSERT/UPDATE/DELETE apenas para `is_workspace_admin_v2`. Membros comuns não podem criar/sobrescrever `access_token`.
- `integrations`: owner-scoped (`owner_id = auth.uid()`) por design — admin do workspace gerencia via server function com service_role.

## Webhooks & cron
- `/api/public/hooks/*-tick` exigem `Authorization: Bearer ${CRON_SECRET}` via `requireCronAuth`.
- Twilio webhooks: validar `X-Twilio-Signature` com `TWILIO_AUTH_TOKEN`.
- Meta/WhatsApp: validar assinatura com `META_WHATSAPP_APP_SECRET`.
- Stripe: validar com `STRIPE_WEBHOOK_SECRET`.
- `payment_webhook_events`: sem policies de INSERT/UPDATE/DELETE autenticadas (apenas service_role). Default-deny é proposital.

## Rotas públicas
- `/quote/$token`, `/sign/$token`, `/portal/$token`, `/book/$slug`, `/wa/$slug`, `/lp/$slug`, `/kb`, `/sales`, `/terms`, `/privacy`, `/dpa`, `/refund` são públicas por design.
- `/api/public/forms/*`, `/api/public/widget/*`, `/api/public/booking/*` aceitam input não-autenticado mas validam com Zod e rate-limit no handler.

## Varreduras automáticas (Release pós-6)
- Cron `security-scan-tick` (diário 03:00 UTC) chama `/api/public/hooks/security-scan-tick`.
- Coletor SQL `public.security_scan_collect()` (SECURITY DEFINER, search_path fixo, EXECUTE apenas service_role) checa: tabelas em `public` sem RLS, RLS sem policies, GRANTs para `anon`, funções SECURITY DEFINER sem `search_path`.
- Route handler também checa presença de `CRON_SECRET`, `TWILIO_AUTH_TOKEN`, `META_WHATSAPP_APP_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- Resultados em `security_scan_runs` / `security_scan_findings` (visíveis apenas para platform_admins).
- Findings ≥ warning geram `notifications` para todos os `platform_admins`.
- UI: `/admin/security-scans` com botão "Rodar agora".
