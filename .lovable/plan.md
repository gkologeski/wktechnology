# Plano — ATS + Event Bus v2 + Empacotamento ERP

Objetivo: lançar o **primeiro módulo satélite (ATS)** como MVP vendável, sobre uma fundação nova de **Event Bus + Workflows v2** que vai sustentar os próximos módulos (Projetos, Financeiro), e empacotar tudo em **planos Bronze/Prata/Ouro** por entitlements.

Premissa: o CRM atual (Leads/Contatos/Empresas/Deals/Tickets, Workflows v1, Sequences, Scoring, Rotation) **continua funcionando intacto**. Nada é substituído — o ATS escuta eventos do CRM (ex.: `deal.won`) e o Workflows v1 atual será migrado gradualmente para o v2 sem quebra.

---

## Fase 1 — Event Bus v2 (fundação)

Hoje o engine usa `workflow_events` (fila ligada a CRUD de entidades CRM) consumido por `pg_cron` no `/api/public/hooks/workflows-tick`. Não tem retries de verdade, branching, delays robustos, nem domínio cross-módulo.

Construir um **bus de eventos de domínio** desacoplado do CRUD:

- Nova tabela `domain_events` (workspace_id, event_name, entity_type, entity_id, payload jsonb, occurred_at, dedupe_key, source).
  - Eventos seguem convenção `<dominio>.<acao>`: `crm.deal.won`, `ats.candidate.hired`, `projects.project.completed`, `finance.invoice.paid`.
- Helper server-side `emitEvent(name, payload)` para todos os módulos publicarem.
- Tabela `workflow_subscriptions` (workflow_id, event_pattern com glob ex.: `crm.deal.*`, filters jsonb).
- Tabela `workflow_run_steps` para branching/delays/retries com estado (`pending|running|waiting|done|failed`), `next_run_at`, `attempt`, `error`, `parent_step_id`.
- Engine v2 (`engine.v2.server.ts`): consome `domain_events` → resolve subscriptions → cria `workflow_runs` com árvore de steps → executor processa steps por `next_run_at` (suporta `delay`, `branch if/else`, `parallel`, `wait_for_event`, `retry with backoff`).
- Cron tick a cada 1 min: `/api/public/hooks/workflows-v2-tick` (autenticado via `apikey` anon, conforme padrão `schedule-jobs-options`).
- Compatibilidade: o engine v1 atual passa a também emitir `domain_events` espelhando seus triggers, então workflows v1 seguem rodando até serem migrados.
- Builder visual atual (`/settings/workflows`) ganha aba **"v2 (beta)"** que renderiza grafo (nodes: trigger, filter, delay, branch, action) usando o mesmo padrão de actions já existentes (`set_field`, `create_activity`, `assign_to`, `webhook`, `send_notification`) + novas actions ATS.

## Fase 2 — Módulo ATS (MVP vendável)

Rota raiz: `/ats` dentro de `_authenticated`. Sub-rotas:
- `/ats/jobs` — lista + filtros (status, cliente/deal vinculado, recrutador).
- `/ats/jobs/$id` — detalhe da vaga **com pipeline kanban** drag-and-drop de candidatos por estágio configurável.
- `/ats/jobs/new` — criação manual ou a partir de Deal (botão "Abrir vaga" no detalhe do Deal).
- `/ats/candidates` — banco geral de candidatos (busca, tags, score, fonte).
- `/ats/candidates/$id` — perfil: CV parseado, histórico de aplicações, entrevistas, scorecards, anotações, anexos.
- `/ats/interviews` — agenda consolidada (lê de `calendar_events` filtrando `kind=interview`).
- `/ats/offers` — ofertas em aprovação.
- `/jobs` (público, SSR) — página de carreira do workspace (lista vagas `published`).
- `/jobs/$slug` (público) — detalhe + formulário de candidatura + botão **"Aplicar com LinkedIn"** (Easy Apply via connector LinkedIn).

### Tabelas novas (com GRANTs + RLS workspace-scoped via `owner_id`/`workspace_id`)
- `ats_jobs`: workspace_id, title, slug, description (rich), requirements, seniority, employment_type, location, remote_mode, salary_range, status (`draft|published|on_hold|filled|closed`), deal_id (fk opcional → `deals`), hiring_manager_id, recruiter_id, pipeline_id, opened_at, filled_at.
- `ats_pipelines` + `ats_pipeline_stages` (estágios customizáveis por workspace; default seed: Aplicado → Triagem → Entrevista RH → Entrevista Técnica → Teste → Proposta → Contratado / Rejeitado).
- `ats_candidates`: workspace_id, full_name, email, phone, linkedin_url, location, current_role, current_company, cv_url (Storage), cv_parsed jsonb, skills text[], tags, source (`manual|career_page|linkedin_easy_apply|referral|import`), score numeric, created_by.
- `ats_applications`: candidate_id, job_id, stage_id, status (`active|hired|rejected|withdrawn`), source, applied_at, moved_at, rejection_reason, position int (ordenação no kanban).
- `ats_interviews`: application_id, calendar_event_id, kind (`screening|technical|cultural|final`), interviewer_id, scheduled_at, status, scorecard_template_id.
- `ats_scorecards`: interview_id, interviewer_id, criteria jsonb (skills + rating 1–5 + comments), overall_rating, recommendation (`strong_hire|hire|no_hire|strong_no_hire`), submitted_at.
- `ats_scorecard_templates`: workspace_id, name, criteria jsonb.
- `ats_offers`: application_id, salary, benefits, start_date, status (`draft|pending_approval|approved|sent|accepted|rejected|expired`), approval_chain jsonb, sent_at, expires_at.
- `ats_offer_approvals`: offer_id, approver_id, status, decided_at, comment.
- `ats_career_pages`: workspace_id, slug, branding jsonb, custom_domain (futuro).

Storage: bucket `ats-cvs` privado, signed URLs.

### Funcionalidades por sprint do MVP

**Sprint A — Núcleo CRUD + Kanban:**
- Pipelines com estágios customizáveis.
- Vagas (CRUD + publicar).
- Candidatos (CRUD + upload CV).
- Aplicações + Kanban drag-drop (otimista, `position` reordenável).
- Vínculo Deal→Vaga (botão no detalhe do Deal + emite `crm.deal.linked_to_job`).

**Sprint B — Parsing IA + Página de Carreiras:**
- Server fn `parseCv` usa **Lovable AI** (`google/gemini-2.5-flash`) com structured output (Zod) → extrai nome, email, telefone, experiências, skills, formação, idiomas. Salva em `cv_parsed`.
- Auto-score do candidato vs requisitos da vaga (Lovable AI, score 0–100 + justificativa).
- Página pública `/jobs` + `/jobs/$slug` com head SEO (title/desc/og dinâmicos do loader, OG image do branding do workspace).
- Form de aplicação público (`/api/public/ats/$slug/apply`) com Zod, rate-limit, upload de CV.

**Sprint C — Entrevistas + Scorecards + Ofertas:**
- Templates de scorecard por workspace.
- Agendar entrevista a partir da application (cria `calendar_event` + convida entrevistador).
- Form de scorecard (entrevistador preenche, recomendação).
- Fluxo de oferta com cadeia de aprovação configurável (n aprovadores em série); cada aprovação emite evento.
- Quando `status='accepted'` → emite `ats.candidate.hired`.

**Sprint D — LinkedIn Easy Apply:**
- Connector LinkedIn já documentado. Botão "Aplicar com LinkedIn" usa OAuth do candidato → server fn busca perfil (`/v2/userinfo`) + experiências (escopo necessário) → cria candidate + application em 1 clique, sem CV upload.
- Limitação documentada: depende dos escopos do app LinkedIn aprovados (`r_liteprofile`, `r_emailaddress` mínimo). Casos sem escopo avançado caem no fluxo de formulário tradicional, pré-preenchido.

### Integração via Event Bus (cross-módulo)

Eventos emitidos pelo ATS:
- `ats.job.opened`, `ats.job.filled`
- `ats.application.created`, `ats.application.stage_changed`, `ats.application.rejected`
- `ats.interview.scheduled`, `ats.scorecard.submitted`
- `ats.offer.sent`, `ats.offer.accepted`
- `ats.candidate.hired`

Eventos consumidos do CRM:
- `crm.deal.won` (filtro: pipeline = "Outsourcing") → action nova `ats.create_job_from_deal` (preenche título, cliente, hiring_manager). **Substitui o workflow HubSpot legado.**

Actions novas no builder de workflows:
- `ats.create_job`, `ats.move_application`, `ats.reject_application`, `ats.schedule_interview`, `ats.send_offer`, `ats.notify_hiring_manager`.

### Permissões (RBAC)
- Reusa `user_roles` + `has_role`. Novos papéis seed: `ats_recruiter`, `ats_hiring_manager`, `ats_interviewer`.
- Policies: recrutador vê todas as vagas do workspace; hiring manager vê só vagas onde é `hiring_manager_id`; entrevistador vê só applications onde tem `ats_interviews` atribuída.

## Fase 3 — Empacotamento Bronze/Prata/Ouro

Estender `plans` + `plan_entitlements` (estrutura já existe) com novos entitlements:

| Entitlement | Bronze | Prata | Ouro |
|---|---|---|---|
| `feature_ats` | ❌ | ✅ (até 5 vagas ativas, 100 candidatos/mês) | ✅ ilimitado |
| `feature_ats_linkedin_apply` | ❌ | ❌ | ✅ |
| `feature_ats_cv_parsing` | ❌ | 50/mês | ilimitado |
| `feature_ats_offer_approvals` | ❌ | ❌ | ✅ |
| `feature_workflows_v2` | ❌ | ✅ (10 workflows) | ✅ ilimitado |
| `feature_projects` (placeholder fase 2) | ❌ | ❌ | ✅ |
| `feature_finance` (placeholder fase 3) | ❌ | ❌ | ✅ |

Mapear em `src/lib/entitlements.ts` (`ENT`). Gating client (`useEntitlement`) + server (checar em todo `createServerFn` ATS via novo middleware `requireEntitlement('feature_ats')`). Quotas mensais usam `usage_counters` (tabela já existe).

Tela `/settings/billing` já lista planos — adicionar comparativo dos novos módulos. Quando user free clica em rota ATS, redireciona para upgrade modal mostrando planos com `feature_ats`.

## Fase 4 — Roadmap dos próximos módulos (não nesta entrega)

Já desenhados no event bus para iterar depois:
- **Projects & Allocation:** projetos, sprints, timesheet, alocação. Consome `ats.candidate.hired` → cria registro de profissional + alocação. Consome `crm.deal.won` (pipeline ≠ Outsourcing) → cria projeto.
- **Finance (AP/AR/Cashflow):** contas a pagar/receber, DRE simples. Consome `projects.milestone.completed` → emite fatura. Reusa `customer_invoices` + `customer_payments` que já existem. Adiciona `accounts_payable`, `cashflow_entries`, `dre_lines`.

---

## Detalhes técnicos

- **Stack:** TanStack Start + Supabase (Lovable Cloud). Server fns em `src/lib/ats/*.functions.ts`. Rotas em `src/routes/_authenticated/ats.*.tsx` e públicas em `src/routes/jobs.*.tsx` + `src/routes/api/public/ats/*`.
- **Migrações:** sempre `CREATE TABLE` → `GRANT` (authenticated + service_role; **sem anon** exceto `ats_jobs` published para career page com policy estrita projetando só colunas safe) → `ENABLE RLS` → policies via `owner_id = auth.uid()` ou `has_role`.
- **Lovable AI:** `LOVABLE_API_KEY` (já presente) via `ai.gateway.lovable.dev/v1`. Parsing de CV com Output schema Zod. Sem custos extras de provider.
- **LinkedIn connector:** já documentado, requer `standard_connectors--connect` na primeira ativação por workspace.
- **Storage:** bucket `ats-cvs` privado, signed URLs de 1h, validação MIME (pdf/docx) e tamanho (≤ 10MB) server-side.
- **Realtime:** kanban escuta `ats_applications` filtrado por `job_id` para refletir movimentos de outros recrutadores.
- **Auditoria:** mudanças de stage e ofertas logadas em `audit_logs` (tabela já existe).
- **Testes:** Playwright e2e do fluxo "criar vaga → aplicar via career page → mover no kanban → agendar entrevista → enviar oferta → aceitar → emite `ats.candidate.hired`".
- **Segurança (atualizar `mem://security-memory`):** ATS é dado de negócio sensível (PII de candidatos) → nunca exposto a anon; career page só projeta colunas públicas das vagas; webhook de aplicação valida origin + rate-limit por IP.

## Entregáveis desta rodada

1. Migração Event Bus v2 (tabelas + engine + cron) + emissão espelhada do v1.
2. Sprint A do ATS (CRUD + Kanban + vínculo com Deal) já operável.
3. Entitlements `feature_ats`, `feature_workflows_v2` criados e gating funcional.
4. Sprints B/C/D entregues em iterações seguintes, mesma arquitetura.

Aprovar para eu iniciar pela Fase 1 + Sprint A?
