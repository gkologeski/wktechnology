
# Modelagem de Planos — TechSales CRM

Objetivo: introduzir um sistema de **planos + entitlements** no workspace, com 4 tiers (Free, Bronze, Prata, Ouro), limites por entidade (leads/contatos/empresas/negócios) e *acesso permanente porém limitado* a recursos premium no Free. Sem integração de cobrança nesta entrega — só modelagem, enforcement e UI.

Base de mercado: tiering inspirado em HubSpot (Free / Starter / Professional / Enterprise) e Pipedrive (Essential / Advanced / Professional / Power). Quanto maior o plano, mais automação, IA, integrações e governança.

---

## 1. Distribuição de funcionalidades

Limites Free (definidos): **500 leads, 500 contatos, 500 empresas, 100 negócios, 1 usuário, 1 pipeline.**

| Área | Free (degustação) | Bronze | Prata | Ouro |
|---|---|---|---|---|
| **Leads/Contatos/Empresas** | 500 cada | 5.000 cada | 25.000 cada | Ilimitado |
| **Negócios** | 100 | 2.000 | 10.000 | Ilimitado |
| **Usuários** | 1 | 3 | 10 | Ilimitado |
| **Pipelines** | 1 | 3 | 10 | Ilimitado |
| **Custom properties** | 5 totais | 25 | 100 | Ilimitado |
| **Custom objects** | — | — | 3 | Ilimitado |
| **Tasks/Notas/Calendário** | ✓ | ✓ | ✓ | ✓ |
| **E-mail (Gmail sync + envio)** | ✓ (50 envios/mês) | ✓ (1k/mês) | ✓ (10k/mês) | Ilimitado |
| **Templates de e-mail** | 3 | 25 | Ilimitado | Ilimitado |
| **WhatsApp Inbox** | — | ✓ (1 número) | ✓ (3) | ✓ (ilimitado) |
| **Chamadas Twilio** | Trial 30 min/mês | 500 min | 2.000 min | Ilimitado |
| **E-mail Broadcasts** | 1 campanha/mês (até 100 dest.) | 5/mês | 50/mês | Ilimitado |
| **WhatsApp Campaigns** | — | — | ✓ | ✓ |
| **Sequences (cadências)** | — | 3 ativas | 25 ativas | Ilimitado |
| **Workflows (automação)** | 1 ativo (degustação) | 10 | 50 | Ilimitado |
| **Lead Scoring (regras)** | — | ✓ regras | ✓ regras + IA | ✓ |
| **Rotation / SLA / Macros / Playbooks** | — | Macros | + SLA + Rotation | + Playbooks |
| **Forms** | 1 | 5 | 25 | Ilimitado |
| **Surveys (CSAT)** | — | — | ✓ | ✓ |
| **Dashboards / Reports** | 1 dash padrão | 5 dashs custom | 25 | Ilimitado |
| **Goals** | — | ✓ | ✓ | ✓ |
| **Scheduled Exports** | — | — | ✓ | ✓ |
| **Enrichment / Prospecting** | 10 créditos (degust.) | 100/mês | 1.000/mês | 10.000/mês |
| **AI Compose** | 10 gerações/mês (degust.) | 100/mês | 1.000/mês | Ilimitado |
| **AI Summaries** | 5/mês (degust.) | 50/mês | 500/mês | Ilimitado |
| **Sentiment Analysis** | — | — | ✓ | ✓ |
| **Quotes / Recurring / eSign** | — | Quotes | + Recurring | + eSign |
| **Tickets / Portal do Cliente** | — | Tickets | + Portal | + Portal white-label |
| **Booking (agendamento)** | — | ✓ | ✓ | ✓ |
| **Integração HubSpot (import)** | One-shot import (degust.) | ✓ | ✓ | ✓ |
| **Google Calendar** | ✓ | ✓ | ✓ | ✓ |
| **Webhooks / API Keys** | — | — | ✓ (10 webhooks, 3 keys) | Ilimitado |
| **Custom Objects** | — | — | 3 | Ilimitado |
| **Branding / White-label** | — | — | Cores | White-label completo |
| **RBAC (roles)** | Default | Default | ✓ custom roles | ✓ + Access Profiles avançados |
| **Audit Log** | 7 dias | 30 dias | 1 ano | Ilimitado |
| **Suporte** | Comunidade | E-mail | E-mail prioritário | Dedicado |

> "Degustação" = aparece na UI, deixa criar até a cota, depois mostra paywall para upgrade. Isso atende o requisito de "acesso permanente limitado" no Free.

---

## 2. Modelo de dados (Supabase)

Tudo escopado por `workspace_owner_id` (padrão atual do projeto). Mudanças via migration.

```text
plans                       -- catálogo (seed: free, bronze, prata, ouro)
 ├ code            text PK  -- 'free' | 'bronze' | 'prata' | 'ouro'
 ├ name            text
 ├ tier_rank       int      -- 0..3 (para comparações ">= prata")
 ├ price_monthly   numeric  -- placeholder (0 por enquanto)
 ├ price_yearly    numeric
 └ is_active       bool

plan_entitlements           -- limites/flags por plano (chave-valor)
 ├ plan_code       text → plans.code
 ├ key             text     -- ex: 'leads.max', 'workflows.active.max',
 │                          --     'ai_compose.monthly', 'whatsapp.enabled'
 ├ limit_int       int      -- null = ilimitado
 ├ enabled         bool     -- para flags booleanas
 └ PK(plan_code, key)

workspace_subscriptions     -- plano atual de cada workspace
 ├ workspace_owner_id uuid PK
 ├ plan_code       text → plans.code  (default 'free')
 ├ status          text     -- 'active'|'trialing'|'past_due'|'canceled'
 ├ trial_ends_at   timestamptz
 ├ current_period_start/end timestamptz
 └ updated_at

usage_counters              -- consumo do mês corrente (para cotas mensais)
 ├ workspace_owner_id uuid
 ├ key             text     -- 'email.sends', 'ai_compose', 'enrichment'…
 ├ period_month    date     -- primeiro dia do mês
 ├ used            int
 └ PK(workspace, key, period_month)
```

RLS:
- `plans` / `plan_entitlements`: leitura para `authenticated`, escrita só `service_role`.
- `workspace_subscriptions` / `usage_counters`: leitura/escrita só membros do workspace (padrão `is_workspace_member`), escrita administrativa via `supabaseAdmin`.

GRANTs explícitos em todas (regra do projeto).

Função `public.has_entitlement(_workspace uuid, _key text)` e `public.get_entitlement_limit(_workspace uuid, _key text)` (security definer) — para uso em RLS / triggers de enforcement.

---

## 3. Enforcement de limites de entidades

Triggers `BEFORE INSERT` em `leads`, `contacts`, `companies`, `deals` que:
1. Lê o plano do workspace via `workspace_subscriptions`.
2. Compara `count(*) WHERE owner_id = NEW.owner_id AND deleted_at IS NULL` com `get_entitlement_limit(...,'<entidade>.max')`.
3. Se exceder, `RAISE EXCEPTION 'plan_limit_exceeded:<entidade>'` com `ERRCODE = 'P0001'`.

Função auxiliar `public.assert_entity_limit(_workspace, _entity)` reutilizável.

Cotas mensais (envios de e-mail, AI, enrichment): incrementadas nos server functions correspondentes (`email-send`, `ai-compose`, `enrichment`) via `supabaseAdmin` antes de executar a ação; bloqueio quando `used >= limit_int`.

---

## 4. Camada de aplicação

**Server functions** (`src/lib/billing.functions.ts`):
- `getMyPlan()` → retorna `{ plan, entitlements: Record<string, {limit, enabled, used}>, isTrialing }`.
- `checkEntitlement({ key })` → util para gates server-side.
- `setWorkspacePlan({ workspaceId, planCode })` (apenas `is_platform_admin`).

**Hook React** `useEntitlements()`:
- Carrega via TanStack Query (queryKey `['entitlements', workspaceId]`).
- Expõe `can(key)`, `limitOf(key)`, `usageOf(key)`, `remaining(key)`.

**Componentes de gate**:
- `<FeatureGate feature="whatsapp.enabled" fallback={<UpgradeCard tier="prata" />}>…</FeatureGate>`
- `<LimitBadge entity="leads" />` (mostra "423 / 500 — fazer upgrade").
- `<UpgradeDialog />` aberto quando server retorna `plan_limit_exceeded:*`.

Interceptor no fetcher de mutations: traduz erros `plan_limit_exceeded:<x>` para abrir o `UpgradeDialog` apontando para o tier mínimo necessário.

---

## 5. UI / navegação

- **`/settings/billing`** (nova rota `_authenticated/settings.billing.tsx`):
  - Card do plano atual + barra de uso por entidade e por cota mensal.
  - Tabela comparativa dos 4 planos (renderizada a partir de `plans` + `plan_entitlements`).
  - Botão "Fazer upgrade" → por enquanto chama `setWorkspacePlan` (mock) e mostra toast "Pagamento em breve". Pronto para plugar Stripe/Paddle depois.
- **Sidebar**: badge do plano ao lado do nome do workspace.
- **Admin de plataforma** (`/admin/workspaces`): coluna "Plano" + ação para alterar manualmente (útil para conceder cortesias).
- **Itens premium no menu**: continuam visíveis com ícone de cadeado quando bloqueados (efeito "degustação"); clique abre `UpgradeDialog`.

---

## 6. Seed inicial

Migration insere:
- 4 linhas em `plans`.
- ~40 linhas em `plan_entitlements` (uma por (plano, key) da tabela da seção 1).
- Backfill: para cada `workspace_owner_id` existente, insere `workspace_subscriptions` com `plan_code = 'ouro'` e `status = 'active'` (cortesia para usuários atuais — evita quebrar bases existentes). Workspaces novos entram como `free`.

---

## 7. Detalhes técnicos

- Reset mensal de `usage_counters`: feito on-the-fly (a chave inclui `period_month`, então um novo mês começa do zero sem cron).
- Soft-deletes (`deleted_at`) já existem em leads/contacts/companies — contados corretamente.
- `platform_admin` ignora todos os limites (já há helper `is_platform_admin`).
- Nada de Stripe/Paddle agora; a estrutura `workspace_subscriptions` já tem campos compatíveis com webhook futuro (status, períodos).
- Memória de segurança: revisar policies novas; nenhum dado de negócio fica `anon`.

---

## 8. Entregáveis (ordem de implementação)

1. Migration: tabelas `plans`, `plan_entitlements`, `workspace_subscriptions`, `usage_counters` + RLS + GRANTs + funções helper + triggers de enforcement + seed dos 4 planos + backfill Ouro.
2. `src/lib/billing.functions.ts` (server fns) + `src/lib/entitlements.ts` (constantes de keys).
3. `useEntitlements()` hook + componentes `FeatureGate`, `LimitBadge`, `UpgradeDialog`, `UpgradeCard`.
4. Wiring de cotas mensais nos server fns: `email-send`, `ai-compose`, `ai-summaries`, `enrichment`, `email-broadcast`, `whatsapp-campaigns`.
5. Rota `/settings/billing` + entrada na sidebar/dropdown.
6. Admin: coluna "Plano" + ação de troca em `/admin/workspaces` (ou nova `/admin/billing`).
7. Aplicar `<FeatureGate>` nas rotas/itens de menu premium (WhatsApp, Sequences, Workflows, Custom Objects, Webhooks, eSign, Portal, White-label, Sentiment, Scheduled Exports, etc.).

Após aprovação, implemento na ordem acima. A parte de cobrança real (Stripe seamless ou Paddle) fica para uma próxima conversa — basta plugar webhook que atualiza `workspace_subscriptions`.
