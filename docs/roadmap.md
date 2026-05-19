# Roteiro de Implementação — CRM completo

> Fonte de verdade. Não sair daqui. Quando algo não estiver previsto, **sugerir**, nunca implementar por conta própria.

---

## 🟢 Onda 0 — WhatsApp (prioridade absoluta) — **CONCLUÍDA**

- 0.1 Fundação (tabelas, enum activity_type) ✅
- 0.2 Outbound (sendWhatsAppMessage + UI Contact/Lead/Deal) ✅
- 0.3 Inbound (webhook Twilio + match contato) ✅
- 0.4 Inbox unificado (/inbox/whatsapp) ✅
- 0.5 Templates & automação básica ✅
- 0.6 HSM oficial via ContentSid — **fora do roteiro, mantido a pedido do usuário** ✅
- 0.7 Campanhas em massa com rate-limit — **fora do roteiro, mantido a pedido do usuário** ✅

---

## 🟡 Onda 1 — Engajamento & Comunicação (3–4 semanas) — **EM ANDAMENTO**

1. **Email 1:1 + tracking (G)** — Gmail OAuth por usuário, pixel de abertura, redirect de click. Aparece no mesmo inbox.
   - 1.1.a Schema + OAuth callback ✅
   - 1.1.b Envio + compose drawer ✅
   - 1.1.c Pixel + click tracking ✅
   - 1.1.d Inbound via History API + pg_cron ✅
   - 1.1.e UI /inbox/email ✅
2. **Templates de email + snippets (M)** ✅ — tokens `{{first_name}}`, snippets `/atalho`, página `/settings/email-templates`, dropdown no SendEmailDialog.
3. **Calling via Twilio Voice (G)** ✅ — discador WebRTC `CallDialer`, TwiML endpoint `/api/public/twilio/voice`, log automático em `activities` (type=`call`) com duração, outcome e `twilio_call_sid` em `external_ids`. Botão "Ligar" em contatos.
4. **Tasks queues (P)** ✅ — `task_queues` + `task_queue_items`, página `/tasks/queues`, executor `/tasks/queues/$queueId/play` com atalhos C/S.
5. **Notes com @menções e anexos (P)** ✅ — `mentions uuid[]` + `attachments jsonb`, bucket `notes-attachments`, drag-and-drop e autocomplete `@`.

---

## 🟠 Onda 2 — Automação (3–4 semanas)

6. **Workflows engine + builder visual (G)** ✅ — fila `workflow_events` alimentada por triggers em leads/contacts/companies/deals, executor server-side processado via pg_cron (`workflows-tick`), `workflow_runs` com log por passo, builder visual (Quando/Se/Então) em `/settings/workflows` com ações tipadas (`set_field`, `create_activity`, `assign_to`, `add_to_sequence`, `send_notification`, `webhook`) e tokens `{{campo}}`.
7. **Sequences executor (G)** ✅ — DSL de passos (`task` / `email` / `wait` com `wait_days`), engine server-side (`tickSequences`) processado via pg_cron (`sequences-tick`), enrollments com `current_step` + `next_run_at`, integração com workflow action `add_to_sequence`, builder visual em `/settings/sequences` com aba de inscrições (pausar / retomar / remover).
8. **Lead/Deal rotation (M)** ✅ — tabela `rotation_rules` (owner, entidade leads/deals, estratégia `round_robin` ou `weighted`, lista de `assignees` com peso, checkpoint `last_index`/`last_assigned_user_id`). Engine `applyRotation` em `src/lib/rotation/engine.server.ts` integrada como nova ação de workflow `rotate_assign` (referencia `rule_id`). UI em `/settings/rotation` com builder de membros + cópia rápida do UUID para colar no Workflow. Membros do workspace vêm de `team_members` + admin.
9. **SLA por pipeline stage (M)** ✅ — tabela `stage_entries` populada por triggers em `leads`/`deals` (abre nova entrada e fecha a anterior a cada mudança de etapa), `sla_hours` configurado dentro de `pipelines.stages`, página `/settings/sla` lista breaches em tempo real (auto-refresh 60s) + editor de SLA por estágio em cada pipeline.
10. **Scoring executor (M)** ✅ — engine `tickScoring` consome `workflow_events` (leads/contacts/companies), avalia `scoring_rules.condition` (operadores eq/neq/in/contains/gt/lt/changed_to/is_empty/is_not_empty), grava `score_events` (único por regra+registro) e soma em `entity.score`. Cursor por owner em `scoring_cursors`. Tick a cada minuto via pg_cron em `/api/public/hooks/scoring-tick`. Página `/settings/scoring` reescrita com builder visual (campo + operador + valor), log das últimas 50 aplicações e botão "Executar agora".

## 🔵 Onda 3 — Estrutura & Permissões (2–3 semanas)

11. Roles & Permissions (M) ✅ — enum `app_role` (admin/manager/member), tabela `user_roles` separada (workspace_owner + user + role, único), funções `has_role` e `is_workspace_admin` (security definer, restritas a `authenticated`), RLS limitando leitura ao próprio usuário/owner e escrita só ao owner. Server functions em `src/lib/roles.functions.ts` (`listWorkspaceRoles`, `setUserRole`, `getMyRole`). Página `/settings/roles` lista membros do workspace e permite trocar role via dropdown; owner é admin fixo.
12. Teams UI (P) ✅ — página `/settings/teams` para gerenciar membros do workspace: convidar por email (resolve `user_id` via admin client em `auth.users`), alterar papel (admin/gestor/membro) e remover. Server functions em `src/lib/teams.functions.ts` (`listTeamMembers`, `inviteTeamMember`, `updateTeamMemberRole`, `removeTeamMember`) espelham automaticamente em `user_roles` para manter as permissões consistentes.
13. Audit log (M) ✅ — tabela `audit_logs` (workspace_owner, actor_user, entity, entity_id, action, before, after, metadata) populada por triggers automáticas em `leads`/`contacts`/`companies`/`deals` (insert/update/delete). RLS limita leitura ao owner do workspace + admins (via `is_workspace_admin`); ninguém edita/exclui manualmente. Server function `listAuditLogs` resolve nomes/emails dos atores e calcula diff de campos. Página `/settings/audit-log` com filtros por entidade/ação, lista paginada (200) e drawer com diff antes/depois ou snapshot completo.
14. 2FA + session management (P) ✅ — página `/settings/security` com enrolment TOTP (QR code + chave manual + verificação de 6 dígitos via `supabase.auth.mfa.enroll/challenge/verify`), listagem de fatores ativos/pendentes com remoção, informações da sessão atual (email, provedor, último login) e botão "Encerrar sessões em todos os dispositivos" (`signOut({ scope: "global" })`).
15. Custom properties UI (G) ✅ — coluna `custom_fields` (jsonb) em `leads`/`contacts`/`companies`/`deals` para armazenar valores. Tabela `custom_properties` com definições (entity, key, label, type=text/textarea/number/date/boolean/select/multiselect/url/email/tel, options, position, required, enabled), RLS por owner. Server fns CRUD + `setCustomFieldValue` (faz merge no jsonb). Página `/settings/custom-properties` com builder por entidade. `PropertiesPanel` ganhou seção "Personalizadas" renderizando os campos definidos com input apropriado por tipo (incluindo multiselect com toggle de opções).

## 🟣 Onda 4 — Service / Tickets (2 semanas)

16. Tickets como objeto (M) ✅ — tabela `tickets` (assunto, descrição, status enum `ticket_status` new/open/waiting/resolved/closed, prioridade enum `ticket_priority` low/medium/high/urgent, fonte, contato/empresa/negócio relacionados, responsável, vencimento, resolved_at, custom_fields jsonb). RLS por owner + admins do workspace. Trigger `tickets_audit` integrada com `audit_logs`. Página `/tickets` com board kanban por status + lista com edição inline de status, busca, drawer de criação/edição com vínculos a contato/empresa/negócio. Entrada "Tickets" no grupo CRM da sidebar.
17. Macros / respostas prontas (P) ✅ — tabela `macros` (nome, atalho, categoria, corpo, enabled) com RLS por owner. Página `/settings/macros` para CRUD com toggle ativo/inativo. Dropdown "Aplicar macro" no dialog de criação/edição de tickets insere o corpo na descrição (concatena se já houver texto), expandindo tokens `{{contact_first_name}}`, `{{contact_name}}`, `{{company_name}}`, `{{ticket_subject}}`, `{{agent_name}}`. Entrada no sidebar (grupo CRM) e na aba de Configurações.
18. NPS/CSAT pós-resolução (M) ✅ — tabela `survey_responses` (kind csat/nps, token público único, score, comment, sent_at, responded_at) com RLS (owner + admins). Trigger `tickets_create_survey` cria convite automaticamente quando ticket vai para `resolved` ou `closed`. Server fns `getSurveyByToken` e `submitSurvey` (via `supabaseAdmin`, sem auth) servem a rota pública `/survey/$token` com escala 0–5 (CSAT) ou 0–10 (NPS) + comentário. Página `/settings/surveys` consolida convites, taxa de resposta, média CSAT, NPS calculado (promotores − detratores) e botão para copiar link público.
19. Portal do cliente (G) ✅ — colunas `portal_token` (único) e `portal_enabled` em `contacts`. Server fns públicas (sem auth, via `supabaseAdmin`) `getPortalSession`, `listPortalTickets`, `createPortalTicket` validam token e expõem só o contato dono. Rota pública `/portal/$token` mostra saudação, lista de tickets (status/prioridade/datas) e dialog "Nova solicitação" que cria ticket com `source=portal`. Página `/settings/portal` lista contatos, toggle de habilitar/desabilitar (gera token), copiar link, abrir em nova aba e regenerar token. Entrada na sidebar (CRM) e nas abas de Configurações.

## 🟤 Onda 5 — Quotes & Payments (3 semanas)

20. Products + Line Items (M)
21. Quotes em PDF (G)
22. Payment link Stripe (M)
23. E-signature (G)
24. Subscriptions/recurring (G)

## 🟦 Onda 6 — Relatórios & Forecast (2–3 semanas)

25. Custom reports builder (G)
26. Multiple dashboards (M)
27. Funnel + sales velocity + cohort (M cada)
28. Goals por usuário/time (M)
29. Export agendado por email (M)

## ⚪ Onda 7 — Captação & Marketing (3 semanas)

30. Forms builder + embed (G)
31. Listas dinâmicas (M)
32. Lead enrichment Apollo/Lusha refinado (M)
33. Email marketing broadcast (G)
34. Forms pop-up / exit-intent (M)

## 🔴 Onda 8 — Calendário & Booking (2 semanas)

35. Sync Google/Outlook Calendar (G)
36. Booking pages públicas (G)

## 🟨 Onda 9 — IA / Breeze (rolling)

37. Resumo automático de conversa/call (M)
38. Smart compose em WhatsApp/email (M)
39. AI properties (M)
40. Sentiment de mensagens (M)
41. Prospecting agent (G)

## ⚫ Onda 10 — Plataforma (sob demanda)

42. API pública REST + API keys (G)
43. Webhooks de saída (M)
44. Two-way sync HubSpot (G)
45. Custom Objects (G)
46. PWA mobile + push (M)
47. i18n pt/en/es (M)
48. White-label (M)
