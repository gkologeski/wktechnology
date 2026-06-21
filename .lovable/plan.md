
# Suíte de Casos de Teste de QA — TechSales CRM

## Objetivo
Entregar uma base completa para que um Analista de QA execute regressão de ponta a ponta do sistema, cobrindo:
- App autenticado (`/_authenticated/*`)
- Admin de plataforma (`/admin/*`)
- Integrações externas (HubSpot, Twilio Voz/WhatsApp, Stripe/Pagamentos BR, Google Calendar, Meta WhatsApp, Slack, Zapier, SCIM, Vapi)

Formato: padrão (ID, Módulo, Título, Pré-condições, Passos, Resultado esperado, Prioridade, Tipo). Profundidade exaustiva (~420 casos).

## Entregáveis
1. `docs/qa/test-cases.md` — versionado, navegável por módulo, com índice clicável.
2. `/mnt/documents/qa-test-cases.xlsx` — planilha pronta para importar em Jira/Zephyr/TestRail/Excel/Sheets.
3. `docs/qa/README.md` — guia rápido (ambientes, dados de teste, prioridades, fluxo de execução, contas seed).

## Estrutura de cada caso
| Campo | Descrição |
|---|---|
| ID | `QA-<MOD>-<NNN>` (ex.: `QA-LEAD-012`) |
| Módulo | Área funcional |
| Sub-módulo | Tela/fluxo específico |
| Título | Resumo do cenário |
| Pré-condições | Estado/dados/role/plano necessários |
| Passos | Lista numerada |
| Resultado esperado | Critério de aceite verificável |
| Prioridade | P0 (bloqueante) / P1 (alta) / P2 (média) / P3 (baixa) |
| Tipo | Funcional / UI / Segurança / Permissão / Integração / Performance / Acessibilidade |

## Cobertura por módulo (estimativa de casos)

### 1. Autenticação e Onboarding (~25)
Login, signup, reset password, accept-invite, verificação `/verify/$hash`, logout, sessão expirada, OAuth Google, RLS de workspace, multi-workspace switch.

### 2. CRM Core — Leads / Contatos / Empresas / Negócios (~70)
CRUD, conversão lead→contato/empresa/deal, duplicados, propriedades customizadas, histórico (property_history), saved views, filtros, paginação, importação CSV, exportação, isolamento por workspace.

### 3. Pipelines & Deals (~25)
Kanban drag-drop, stage entries, line items, pipelines múltiplos, rotation rules, goals, forecast/ML.

### 4. Tarefas, Atividades & Filas (~20)
CRUD, queues, play mode, atribuição, lembretes, conclusão, vinculação a entidades.

### 5. Inbox Unificada (~30)
Email (`inbox.email`), WhatsApp (`inbox.whatsapp`), Chat (`inbox.chat`), composer, anexos, threads, realtime, marcar lido, encaminhar.

### 6. Campanhas (~30)
Email broadcasts (criar, segmento, agendar, pausar, métricas open/click/unsub, supressão), WhatsApp campaigns (criar/editar, templates, mídia, status), prospecting campaigns (variants, scripts, dial).

### 7. Comunicação & Telefonia (~20)
Twilio voice click-to-call, gravação, transcrição, status callback, WhatsApp send/receive, mídia, status webhook, voice agent (Vapi).

### 8. Reuniões / Calendário / Booking (~25)
Google Calendar OAuth e sync, eventos, gravações, summaries IA, booking pages públicas (`/book/$slug`), submit, fuso horário, link `/meet/$token`.

### 9. Marketing & Captação (~25)
Forms (builder, embed JS, submit público, anti-spam), landing pages, surveys (`/survey/$token`), widget de chat público, WhatsApp ads referrals.

### 10. Vendas Avançadas (~25)
Quotes/Propostas (templates, cláusulas, aprovação, link `/quote/$token`), e-sign (`/sign/$token`, áudit, signers), payments BR (PIX/cartão, webhook), recurring, dunning, NFS-e, customer invoices/payments.

### 11. Atendimento (~15)
Tickets, macros, SLA, playbooks, sentimento, surveys CSAT, KB pública (`/kb`).

### 12. Knowledge Base & Portal (~10)
KB CRUD, categorias, artigo público; portal do cliente (`/portal/$token`), branding/white-label.

### 13. Automação (~25)
Workflows (builder, runs, eventos), Sequences (cadências, enrollments), Scoring (regras + IA, score_events), AI summaries, prospecting scripts, SDR agents/playbooks.

### 14. Integrações & Marketplace (~25)
HubSpot (OAuth, owners, sync state, import), Slack (event routes), Zapier (subscribe/triggers/unsubscribe), SCIM (Users/Groups), Webhooks outbound/inbound, API Keys, Marketplace install/uninstall.

### 15. Settings (~50)
Cobre cada rota `settings.*`: pipelines, custom-properties, custom-objects, lead-sources, products, email-templates, whatsapp-templates/catalogs, forms, calendars, booking, roles (matrix + editor), teams, user-groups, access-policy, audit-log/export, security, sso (removida — verificar ausência), privacy, language, branding, billing, payments, recurring, dunning, nfse, esign, clauses, quote-templates, kb, macros, sla, playbooks, surveys, goals, scoring, sequences, workflows, webhooks, api-keys, zapier, hubspot-sync/users, ads-sync, wa-ads, voice-agent, mobile, portal, widget, prospecting/scripts, segments, rotation, record-layouts, property-groups, notifications.slack, data-residency, exports, import-csv, enrichment, scim, workspace-team, media.

### 16. Billing & Entitlements (~20)
Plano atual, comparativo, upgrade/downgrade Free↔Bronze↔Prata↔Ouro, gates de feature (FeatureGate), limites (LimitBadge), bloqueio ao exceder cota (leads, e-mails, IA, Twilio), banner upgrade.

### 17. Admin de Plataforma (~25)
`/admin/workspaces` (list/detail, set plan), `/admin/quotas`, `/admin/bug-reports` (analyze hook), `/admin/security-scans` (run, findings, manage), `/admin/alerts` (rules/events), `/admin/sandbox`, `/admin/status`. Inclui guard de role platform_admin.

### 18. Bug Reports (~5)
`/my-bug-reports` criação/listagem usuário; admin triagem e IA analyze.

### 19. Rotas Públicas / Webhooks (~25)
`/api/public/forms/$slug` (GET embed/submit), `/api/public/booking/$slug` (GET/submit), unsubscribe, email pixel/click, payments webhooks (Stripe + br-webhook), Twilio voice/whatsapp/status, Meta WhatsApp webhook (verify + receive), Google OAuth callback, widget script/session/messages, sitemap.xml, robots.txt, SCIM v2, Zapier triggers.

### 20. Cron / Hooks Agendados (~15)
Validação de `CRON_SECRET` em cada `hooks/*-tick.ts` (email-broadcast, sequences, workflows, sla, scoring, segments, hubspot, calendar, calendar-recordings, prospecting-dial, audit-export, scheduled-exports, sentiment, security-scan, platform-alerts, ai-summary, webhook, whatsapp-campaign, bug-report-analyze, email-sync).

### 21. Segurança & Compliance (~25)
RLS multi-workspace (leitura/escrita cruzada bloqueada), service_role nunca exposta, headers de webhook (assinatura Twilio, Stripe, Meta), rate limit, IP access log, audit log gerado em ações sensíveis, privacy (LGPD export/delete), data residency, sessão, CSRF de forms públicos, XSS em campos de texto rico (KB, emails), CSP, robots/sitemap, role escalation via `has_role`.

### 22. UX Transversal / Acessibilidade (~15)
Responsividade mobile/desktop, dark mode (se aplicável), navegação por teclado, leitura de erros toasts, loading states/skeletons, empty states, atalhos `Cmd+K`, paginação, ordenação, filtros persistentes (user_grid_preferences), i18n.

### 23. Performance & Resiliência (~10)
Carga inicial < 3s, virtualização de grids grandes, reconexão de realtime, retry de mutations, comportamento offline (sw.js), cache TanStack Query, invalidate após mutation.

## Convenções da suíte
- Cada caso é independente; pré-condições explicitam dados/role/plano.
- Roles cobertas: `owner`, `admin`, `manager`, `sales`, `support`, `viewer`, `platform_admin`.
- Planos cobertos nos gates: `free`, `bronze`, `prata`, `ouro`.
- Dados de teste sugeridos em `docs/qa/README.md` (workspace seed, contatos, deals, contas Twilio sandbox, Stripe test keys, etc.).
- Marcadores `@smoke` (subset P0/P1 ~ 50 casos) destacados para regressão rápida.

## Geração técnica
1. Script Python único em `/tmp/build_qa_cases.py` produz simultaneamente:
   - `docs/qa/test-cases.md` (index + seções por módulo)
   - `/mnt/documents/qa-test-cases.xlsx` (uma aba por módulo + aba `Index` + aba `Smoke`) usando `openpyxl` com cabeçalho fixo, autofiltro, larguras de coluna e cor por prioridade.
2. `docs/qa/README.md` escrito manualmente.
3. Validação: rodar `recalculate_formulas.py` (mesmo sem fórmulas, valida estrutura) e abrir 2 abas para inspeção visual via conversão para imagem.
4. Emitir `<presentation-artifact>` para a planilha.

## Fora de escopo
- Não cria testes Playwright (usuário não pediu automação).
- Não modifica código de aplicação.
- Não cria dados seed no banco — apenas documenta os necessários.
