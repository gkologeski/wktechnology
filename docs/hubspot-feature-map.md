# Mapa de Funcionalidades HubSpot × Nosso CRM

> **Como usar:** marque `[x]` ao lado do que quiser incorporar. Depois me envie o arquivo (ou só a lista marcada) que eu abro tarefas de implementação.
>
> **Legenda de status:**
>
> - ✅ pronto — já existe e funciona razoavelmente
> - 🟡 parcial — existe esqueleto, falta polimento / features
> - ❌ não existe
>
> **Esforço:** P ≤ 1 dia · M 1–3 dias · G > 3 dias (subsistema novo / integração externa)

---

## Sumário por módulo

| #   | Módulo                   | ✅  | 🟡  | ❌  |
| --- | ------------------------ | --- | --- | --- |
| 1   | Objetos CRM              | 6   | 1   | 5   |
| 2   | Engajamento / Activities | 6   | 1   | 8   |
| 3   | Pipelines & Automação    | 7   | 0   | 6   |
| 4   | Inbox & Conversations    | 0   | 0   | 7   |
| 5   | Relatórios & Dashboards  | 2   | 0   | 8   |
| 6   | Importação & Sync        | 3   | 2   | 4   |
| 7   | Listas & Segmentação     | 3   | 1   | 2   |
| 8   | Propriedades             | 4   | 1   | 4   |
| 9   | Permissões & Times       | 1   | 1   | 6   |
| 10  | Email outbound           | 1   | 0   | 9   |
| 11  | Calling                  | 0   | 0   | 6   |
| 12  | Meetings & Calendário    | 0   | 0   | 6   |
| 13  | Marketing core           | 0   | 0   | 7   |
| 14  | Service / Tickets        | 0   | 0   | 6   |
| 15  | Payments & Quotes        | 0   | 0   | 7   |
| 16  | AI / Breeze              | 1   | 1   | 7   |
| 17  | Integrações & API        | 1   | 1   | 5   |
| 18  | Mobile                   | 0   | 0   | 4   |
| 19  | Customização             | 1   | 2   | 5   |

> **Release 4 (2026-06-05) — fechada.** Os 8 parciais da auditoria anterior foram endereçados. Itens entregues nesta release:
>
> 1. ✅ Companies — schema parent/child + UI de árvore (`company-hierarchy.tsx`)
> 2. ✅ Card layout por pipeline — `card_fields` em `pipelines.config` + editor em settings
> 3. ✅ Custom properties — render dinâmico no `properties-panel`
> 4. ✅ Apollo / Lusha — bulk enrich com preview, dry-run e link de histórico
> 5. ✅ Activities — `recording_url` + player de áudio e badges de email (direction/status) no timeline
> 6. ✅ AI summary — botão "Resumo IA" no timeline abrindo `AiSummaryPanel` em sheet
>
> Itens 🟡 que **permanecem** (fora do escopo de R4): filter builder OR aninhado real (`src/lib/filters.ts`), record sidebar layout (UI), CSV wizard com dedupe, teams UI, grupos de propriedades configuráveis.

---

## 1. Objetos CRM

- [ ] **Contacts** — pessoa física ligada a empresa, com propriedades, atividades, deals. — ✅ — P (refinamento) — tabela `contacts` + página `/contacts`.
- [x] **Companies** — empresa com hierarquia (parent/child), domínio, indústria. — ✅ — — `companies.parent_company_id` + `company-hierarchy.tsx` na página da company.
- [ ] **Deals** — negócios com pipelines, stages, value, close date. — ✅ — — pipelines + board + lista + forecast prontos.
- [ ] **Tickets** — chamados de suporte com pipeline próprio, SLA, prioridade. — ❌ — G — tabela + UI + automações.
- [ ] **Leads** (objeto HubSpot novo, distinto de Contact) — fila de prospecção antes de virar Contact qualificado. — ✅ — — tabela `leads` + página `/leads`.
- [ ] **Products** — catálogo de produtos com SKU, preço, recorrência. — ❌ — M.
- [ ] **Line Items** — produtos associados a um deal/quote com qty e desconto. — ❌ — M (depende de Products).
- [ ] **Quotes** — propostas comerciais imprimíveis ligadas ao deal. — ❌ — G (PDF + assinatura).
- [ ] **Custom Objects** — objetos definidos pelo usuário com schema próprio. — ❌ — G (subsistema inteiro: schema, UI dinâmica, RLS dinâmico).
- [ ] **Tasks** (objeto dedicado) — tarefas com status, prioridade, due date, queue. — ✅ — — `/tasks` com kanban.
- [x] **Activities / Engagements** (Notes, Calls, Emails, Meetings) — registros de interação. — ✅ — — cobre os 4 tipos; calls com `recording_url` + player no timeline; emails mostram direction/status como badges.
- [ ] **Feed** (timeline global de tudo que acontece) — stream de eventos cross-objeto. — ❌ — M.

## 2. Engajamento / Activities

- [ ] **Notes** — anotações livres com menções (@) e anexos. — ✅ — — menções via `workspace_members` e upload para bucket `notes-attachments` no `activity-timeline`.
- [ ] **Tasks** — listagem, kanban, queues (filas de execução sequencial). — ✅ — — kanban + `/tasks/queues` + play através da fila com atalhos C/S.
- [ ] **Calls — log manual** — registrar uma chamada com outcome, duração, notas. — ✅ — — disponível em communications.
- [ ] **Calls — discador VOIP nativo** — clicar no telefone e discar pelo navegador. — ❌ — G (Twilio/Aircall).
- [ ] **Calls — gravação + transcrição** — gravar e transcrever automaticamente. — ❌ — G.
- [ ] **Calls — coaching / análise** — keywords, sentiment, talk-ratio. — ❌ — G.
- [ ] **Emails — log manual** — copiar/colar conteúdo ou BCC para registrar. — ✅ — — communications.
- [ ] **Emails — envio 1:1 do CRM** — compor e enviar email pelo registro. — ❌ — G (SMTP/Gmail/Outlook + tracking).
- [ ] **Emails — tracking de abertura/click** — pixel + redirect de links. — ❌ — G.
- [ ] **Emails — templates com tokens** — modelos com `{{first_name}}`. — ❌ — M.
- [ ] **Emails — snippets** — atalhos de texto curtos com `#snippet`. — ❌ — P.
- [ ] **Meetings — log manual** — registrar reunião realizada. — ✅ — — communications.
- [ ] **Meetings — booking pages** — link público para prospect agendar com você. — ❌ — G.
- [ ] **Meetings — round-robin** — distribui agendamentos entre time. — ❌ — G.
- [ ] **WhatsApp / SMS** — integração de mensagens. — ❌ — G.
- [ ] **LinkedIn Sales Navigator** — sincronização de InMails. — ❌ — G.
- [ ] **Postal mail / Direct mail** — registro de envios físicos. — ❌ — P (só log).

## 3. Pipelines & Automação

- [ ] **Múltiplos pipelines de deals** — vendas + pós-venda + renovação. — ✅ — — tabela `pipelines`.
- [ ] **Stages com probabilidade** — % de fechamento por stage para forecast. — ✅ — — `DealsForecast` calcula coluna "Ponderado" = value × probability.
- [ ] **Pipelines de tickets** — pipeline próprio para suporte. — ❌ — M (depende de Tickets).
- [ ] **Lead scoring manual (rules)** — somar pontos por critérios. — ✅ — — UI em `/settings/scoring` (304 linhas) + executor `scoring-tick`.
- [ ] **Lead scoring preditivo (AI)** — modelo treinado nos seus deals. — ❌ — G.
- [ ] **Lead rotation / round-robin** — distribuir leads novos entre vendedores. — ❌ — M.
- [ ] **Deal rotation** — distribuir deals automaticamente. — ❌ — M.
- [ ] **Workflows — if/then visual builder** — automações com triggers, ações, branches, delays. — ✅ — — `workflow-builder.tsx` (Sheet com trigger + filtros + ações) + engine via `workflow-events` trigger DB + handler `workflows-tick`.
- [ ] **Sequences** — cadência de emails + tasks programados. — ✅ — — `SequenceBuilder` com steps reordenáveis + executor em `sequences-tick`.
- [ ] **Playbooks** — roteiros de discovery/qualificação. — ✅ — P — pronto, falta UI de execução durante uma call.
- [ ] **SLA por pipeline** — alerta se ficar parado em um stage X dias. — ❌ — M.
- [ ] **Approval workflows** — exigir aprovação para descontos / quotes. — ❌ — G.
- [ ] **Conditional properties** — propriedades que aparecem dependendo de outras. — ❌ — M.

## 4. Inbox & Conversations

- [ ] **Caixa de entrada compartilhada** — emails recebidos do time num único inbox. — ❌ — G.
- [ ] **Live chat widget** — chat no site do cliente. — ❌ — G.
- [ ] **Chatbot builder** — bot com fluxo para qualificação. — ❌ — G.
- [ ] **Formulários** — forms para captação que viram contacts/leads. — ❌ — M.
- [ ] **Roteamento de conversas** — atribuir conversa ao dono certo. — ❌ — M.
- [ ] **Canned snippets em conversas** — respostas prontas. — ❌ — P.
- [ ] **Sentiment / qualidade da resposta** — métrica de cada agente. — ❌ — G.

## 5. Relatórios & Dashboards

- [ ] **Dashboard de KPIs** — cards de leads, deals, ganhos. — ✅ — — `/dashboard`.
- [ ] **Forecast de receita** — previsão por stage × probabilidade × close date. — ✅ — — `DealsForecast` mostra ponderado + meta editável.
- [ ] **Custom reports** — builder de relatório com dimensão/métrica/filtro. — ❌ — G.
- [ ] **Multiple dashboards** — dashboards salvos por equipe/objetivo. — ❌ — M.
- [ ] **Goals** — metas de receita/atividade por usuário/time. — ❌ — M.
- [ ] **Attribution report** — qual fonte/touchpoint trouxe receita. — ❌ — G.
- [ ] **Funnel report** — taxa de conversão entre stages. — ❌ — M.
- [ ] **Cohort report** — comportamento por coorte de criação. — ❌ — M.
- [ ] **Activity leaderboard** — ranking de atividades por vendedor. — ❌ — P.
- [ ] **Sales velocity** — tempo médio por stage. — ❌ — M.
- [ ] **Export agendado** — relatório por email semanal. — ❌ — M.

## 6. Importação & Sincronização

- [ ] **Wizard de importação CSV** — mapeamento de colunas, preview, dedupe. — 🟡 — M — existe via `entity-list`; falta dedupe e mapeamento avançado.
- [ ] **Importação HubSpot** — wizard one-click por objeto. — ✅ — — `/integrations/hubspot` com checkbox importar/limpar.
- [ ] **Two-way sync com HubSpot** — manter atualizado bidirecional. — ❌ — G.
- [ ] **Sync com Google Contacts** — contatos do Gmail. — ❌ — M.
- [ ] **Sync com Outlook / Exchange** — contatos e calendário. — ❌ — M.
- [ ] **Enrichment de contacts (clearbit/apollo)** — preencher dados faltantes. — 🟡 — M — `integrations/apollo.functions.ts` existe, refinar UX.
- [ ] **Enrichment de companies (domínio → dados)** — buscar por website. — 🟡 — M — base existe.
- [ ] **Dedupe automático** — detectar duplicatas e mesclar. — ❌ — M.
- [ ] **Histórico de importações** — log auditável de cada job. — ✅ — — `enrichment_jobs` cobre.

## 7. Listas & Segmentação

- [ ] **Listas estáticas** — snapshot manual. — ✅ — — `segments` kind=static.
- [ ] **Listas dinâmicas (smart)** — recalculam por filtros. — ✅ — — engine em `src/lib/segments/engine.server.ts` chamada pelo cron `segments-tick`.
- [ ] **Filter builder com AND/OR aninhado** — UI tipo HubSpot. — 🟡 — P — `FilterGroup` é recursivo no modelo, mas `applyFilters` em `src/lib/filters.ts:42` flatten OR de 1 nível.
- [ ] **Lista de membership cross-objeto** — "contatos cujo deal está em Negociação". — ❌ — G.
- [ ] **Suppression lists** — listas que excluem de envios. — ❌ — P.
- [ ] **Compartilhamento de listas com time** — permissões granulares. — ❌ — P.

## 8. Propriedades

- [ ] **Propriedades padrão por objeto** — campos do schema. — ✅ — — colunas das tabelas.
- [ ] **Histórico de propriedade** — quem mudou, quando, de quê para quê. — ✅ — — tabela `property_history`.
- [x] **Propriedades customizadas pelo usuário** — adicionar campo via UI sem migration. — ✅ — — CRUD em `/settings/custom-properties` + armazenamento JSONB + render dinâmico no `properties-panel`.
- [ ] **Grupos de propriedades** — agrupar campos no record sidebar. — 🟡 — P — `properties-panel` existe, falta agrupamento configurável e drag-and-drop.
- [ ] **Propriedades calculadas** — `valor * qty`. — ❌ — M.
- [ ] **Propriedades dependentes / condicionais** — mostrar B se A=X. — ❌ — M.
- [ ] **Validação de propriedade (regex, range)** — regras no save. — ❌ — P.
- [ ] **Propriedades multi-currency** — converter automaticamente. — ❌ — M.
- [ ] **Score property** — campo derivado de scoring rules. — ❌ — P (depende de scoring).

## 9. Permissões & Times

- [ ] **Users + convite por email** — auth básica. — ✅ — — Supabase auth.
- [ ] **Teams / agrupamento de usuários** — `team_members` table existe. — 🟡 — P — falta UI.
- [ ] **Roles (Super Admin, Sales, Marketing, etc.)** — perfis pré-definidos. — ❌ — M.
- [ ] **Permissões granulares por objeto** — read/write/delete por role. — ❌ — G.
- [ ] **Data partitioning** — vendedor só vê suas oportunidades. — ❌ — M (RLS por owner_id já cobre parcial).
- [ ] **SSO / SAML** — login corporativo. — ❌ — M.
- [ ] **2FA obrigatório** — segurança. — ❌ — P (Supabase já suporta).
- [ ] **Audit log** — quem fez o quê. — ❌ — M.
- [ ] **Session management** — listar/forçar logout. — ❌ — P.

## 10. Email Outbound (1:many e marketing)

- [ ] **Editor de email drag-and-drop** — blocos visuais. — ❌ — G.
- [ ] **Email marketing (broadcast para lista)** — campanha única. — ❌ — G.
- [ ] **A/B testing de assunto** — split test. — ❌ — M.
- [ ] **Throttling / send window** — espalhar envio. — ❌ — M.
- [ ] **Unsubscribe link automático** — compliance. — ❌ — P.
- [ ] **Subscription types** — múltiplos opt-ins. — ✅ — — CRUD em `/settings/subscriptions` + tabela `contact_subscriptions`.
- [ ] **Bounce / spam handling** — atualizar status automático. — ❌ — M.
- [ ] **DKIM / SPF setup wizard** — autenticação de domínio. — ❌ — M.
- [ ] **Send time optimization** — IA escolhe melhor horário. — ❌ — G.
- [ ] **Preview por device** — mobile/desktop/Outlook. — ❌ — P.

## 11. Calling

- [ ] **Discador WebRTC nativo** — sem app externo. — ❌ — G.
- [ ] **Integração Twilio/Aircall** — passar por provider. — ❌ — G.
- [ ] **Caller ID local** — número aparece como local. — ❌ — M (provider).
- [ ] **Gravação automática** — armazenar áudio. — ❌ — G.
- [ ] **Transcrição via Whisper/Gemini** — texto + busca. — ❌ — G.
- [ ] **Coaching whisper** — manager ouve sem ser ouvido. — ❌ — G.

## 12. Meetings & Calendário

- [ ] **Booking page pública** — `/meet/seu-nome`. — ❌ — G.
- [ ] **Sync Google Calendar** — eventos bidirecionais. — ❌ — G.
- [ ] **Sync Outlook Calendar** — idem. — ❌ — G.
- [ ] **Buffer / lead time** — folga entre slots. — ❌ — P.
- [ ] **Group meeting** — múltiplos donos numa sala. — ❌ — M.
- [ ] **Round-robin de agendamento** — distribui entre time. — ❌ — M.

## 13. Marketing Core (recorte)

- [ ] **Forms builder** — formulário hospedado. — ❌ — G.
- [ ] **Form embed code** — script para colar no site cliente. — ❌ — P (depende do form).
- [ ] **Pop-up forms** — exit-intent, scroll. — ❌ — M.
- [ ] **Landing pages drag-and-drop** — editor de página. — ❌ — G.
- [ ] **CTAs trackáveis** — botão que registra click. — ❌ — M.
- [ ] **Blog / CMS básico** — posts no domínio do cliente. — ❌ — G.
- [ ] **Ads integration (Google/Meta)** — sync de audiências. — ❌ — G.

## 14. Service / Tickets

- [ ] **Pipeline de tickets** — Novo → Em andamento → Resolvido → Fechado. — ❌ — M.
- [ ] **SLA por prioridade** — tempo máximo de resposta/resolução. — ❌ — M.
- [ ] **Knowledge base pública** — artigos buscáveis. — ❌ — G.
- [ ] **Portal do cliente** — login do cliente ver seus tickets. — ❌ — G.
- [ ] **Pesquisa NPS / CSAT** — disparar pós-resolução. — ❌ — M.
- [ ] **Macros / respostas prontas** — atalhos no ticket. — ❌ — P.

## 15. Payments & Quotes

- [ ] **Quotes (PDF de proposta)** — gerado do deal com line items. — ❌ — G.
- [ ] **E-signature** — DocuSign ou nativo. — ❌ — G.
- [ ] **Payment link** — link Stripe que vira deal ganho. — ❌ — M.
- [ ] **Subscriptions / recurring** — cobrança recorrente. — ❌ — G.
- [ ] **Invoices** — emitir nota. — ❌ — G (depende NFe BR).
- [ ] **Templates de quote** — branding customizável. — ❌ — M.
- [ ] **Aprovação de desconto** — workflow se desconto > X%. — ❌ — M (depende workflows).

## 16. AI / Breeze (camada de IA)

- [ ] **Assistente conversacional no record** — "resuma este contato". — ❌ — M (Lovable AI).
- [x] **Resumo automático de call/email** — TL;DR no timeline. — ✅ — — `ai_summaries` + `ai-summaries.functions.ts` + botão "Resumo IA" no `activity-timeline` abrindo `AiSummaryPanel` em sheet (geração on-demand por entidade).
- [ ] **AI properties (campos preenchidos por IA)** — "indústria provável", "intenção". — ❌ — M.
- [ ] **Prospecting agent** — IA sugere próximos passos. — ❌ — G.
- [ ] **Content agent (gera email)** — rascunho de outbound. — ❌ — M.
- [ ] **Smart compose (autocomplete)** — sugere fim da frase. — ❌ — M.
- [ ] **Sentiment de email/call** — positivo/neutro/negativo. — ❌ — M.
- [ ] **Forecast assistido por IA** — ajusta probabilidade. — ❌ — G.
- [ ] **Lead enrichment AI** — buscar dados públicos. — ❌ — M.

## 17. Integrações & API

- [ ] **App marketplace / catálogo de integrações** — UI para conectar serviços. — ✅ — — `/integrations` com cards.
- [ ] **HubSpot connector** — importar dados. — ✅ — — pronto.
- [x] **Apollo connector** — enrichment. — ✅ — — bulk enrich dialog com preview + dry-run + histórico em `/settings/enrichment`.
- [x] **Lusha, Clearbit, ZoomInfo** — outros enrichers. — ✅ (Lusha) — — Lusha integrada no bulk enrich; Clearbit/ZoomInfo não implementados.
- [ ] **Zapier-style automation externa** — webhooks de saída. — ❌ — M.
- [ ] **API pública REST para clientes** — chaves + escopo. — ❌ — G.
- [ ] **Webhooks de entrada** — receber evento externo. — ❌ — M.
- [ ] **Custom code actions em workflows** — JS arbitrário. — ❌ — G.

## 18. Mobile

- [ ] **App iOS** — nativo. — ❌ — G.
- [ ] **App Android** — nativo. — ❌ — G.
- [ ] **PWA mobile-friendly** — instalar do navegador. — ❌ — M.
- [ ] **Push notifications** — alertas de novo lead. — ❌ — M.

## 19. Customização

- [ ] **Saved views por usuário** — filtros + colunas salvos. — ✅ — — `saved_views`.
- [ ] **Editor de colunas inline** — mostrar/esconder/reordenar. — ✅ — — `column-editor-dialog`.
- [ ] **Record sidebar layout configurável** — quais painéis aparecem. — 🟡 — M — `record_layouts` table existe, falta UI.
- [x] **Card layout por pipeline** — quais campos no kanban card. — ✅ — — `card_fields` em `pipelines.config` + editor em `/settings/pipelines`, lido por `deals-board-card`.
- [ ] **Custom tabs no record** — adicionar aba "Cobrança". — ❌ — M.
- [ ] **Branding white-label** — logo, cores, domínio próprio. — ❌ — M.
- [ ] **Idiomas (i18n)** — pt-BR / en / es. — ❌ — M.
- [ ] **Temas (dark/light)** — toggle de tema. — ❌ — P.
- [ ] **Atalhos de teclado globais** — produtividade. — ❌ — P.

---

## O que falta para zerar os parciais (🟡 → ✅)

Após Release 4, restam estes parciais (todos pequenos/médios):

| #   | Item                            | Esforço | Onde mexer                                                                                              |
| --- | ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Filter builder OR aninhado real | P       | `src/lib/filters.ts` — recursão verdadeira em `or()` (ou mover para PostgREST `.or(...)` com subgrupos) |
| 2   | Record sidebar layout (UI)      | M       | UI sobre `record_layouts` em `/settings/properties` para arrastar campos em grupos                      |
| 3   | CSV wizard com dedupe           | M       | passo "match by email/phone" no wizard de import                                                        |
| 4   | Grupos de propriedades          | P       | usar `record_layouts.groups` no `properties-panel`                                                      |
| 5   | Teams UI                        | P       | tela CRUD sobre `team_members`                                                                          |

## Próximos grandes (❌ → ✅) por prioridade de negócio

1. Tickets com pipeline próprio (M) — abre o módulo Service inteiro.
2. Email envio 1:1 + tracking (G) — fecha o loop de comunicação.
3. Forms builder + embed (G) — entrada de leads.
4. Quotes + payment link Stripe (G) — fecha venda dentro do CRM.
5. Custom reports builder (G) — relatórios ad-hoc.
6. Roles & permissões granulares (M) — necessário antes de escalar usuários.
7. Two-way sync HubSpot (G) — migração suave.
