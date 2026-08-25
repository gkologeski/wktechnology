# Releases 12 → 21 — Escopo Detalhado

> Complementa `docs/roadmap.md`. Cada release lista **user stories**, **critérios de aceite (CA)** e **telas necessárias**.
> Convenções: US = User Story · CA = Critério de Aceite · 🖥️ = tela / rota nova ou alterada.
> Persona padrão: **U** = usuário do CRM (vendedor/atendente), **A** = admin do workspace, **C** = cliente/contato externo.

---

## Release 12 — Vídeo & Reuniões

### User Stories

- **US-12.1** Como **U**, quero criar uma sala de vídeo com 1 clique a partir de um contato/lead/deal/ticket para falar com o cliente sem sair do CRM.
- **US-12.2** Como **C**, quero entrar na reunião por um link público (sem login) usando só meu nome.
- **US-12.3** Como **U**, quero que a reunião seja gravada (com consentimento) e fique anexada ao registro.
- **US-12.4** Como **U**, quero ler um **resumo automático** da reunião com decisões e próximos passos.
- **US-12.5** Como **U**, quero que os **action items** virem `tasks` atribuídas automaticamente.
- **US-12.6** Como **U**, quero buscar dentro das transcrições (full-text) e pular para o timestamp.

### Critérios de Aceite

- CA-12.1 Botão "Iniciar vídeo" cria sala via provider (Daily/Whereby/Jitsi) em < 3 s e abre em nova aba; gera `activities` (`type=meeting`) com `meeting_url`.
- CA-12.2 Link público `/meet/$token` funciona sem auth; valida `expires_at`; aceita só nome + opcional email.
- CA-12.3 Gravação só inicia após aceite explícito do anfitrião; arquivo armazenado no storage com URL assinada (TTL 7 dias renovável).
- CA-12.4 Resumo gerado em até 5 min após o fim da reunião; campos `summary`, `decisions[]`, `action_items[]`, `sentiment` populados em `meeting_summaries`.
- CA-12.5 Cada item de `action_items` vira `task` com `assignee_id`, `due_date` (default +3 dias), `related_to` (entity+id).
- CA-12.6 Busca full-text por workspace retorna trechos com timestamp; click no resultado abre player no ponto.

### Telas

- 🖥️ Botão "Vídeo" em `CallDialer` (contatos/leads/deals/tickets).
- 🖥️ `/meet/$token` — sala pública (nome do convidado, consentimento de gravação, controles padrão).
- 🖥️ `/meetings` — biblioteca de reuniões com busca, filtros (data, participante, entidade).
- 🖥️ Drawer "Detalhe da reunião" — player + transcrição sincronizada + resumo + action items.
- 🖥️ `/settings/video` — provider, política de gravação, retenção, modelos de transcrição.

---

## Release 13 — WhatsApp Business via Meta Cloud API ✅

> Provider: **Meta WhatsApp Business Platform — Cloud API (Graph v21+)**. Twilio fica restrito a Voz (Release 11).

### User Stories

- **US-13.1** Como **A**, quero conectar uma ou mais contas **WABA** da Meta (System User token ou Embedded Signup) sem sair do CRM.
- **US-13.2** Como **U**, quero enviar e receber mensagens (texto, mídia, documento, localização, reação) pelo número oficial da empresa.
- **US-13.3** Como **U**, quero enviar **catálogo de produtos** (`interactive.product_list`) sincronizado com o Commerce Manager.
- **US-13.4** Como **U**, quero criar/editar **templates HSM** com botões `quick_reply`, `url`, `phone_number` e `copy_code`, submetidos para aprovação da Meta.
- **US-13.5** Como **A**, quero rodar **anúncios click-to-WhatsApp (CTWA)** e capturar `referral` + `ctwa_clid` na primeira mensagem inbound para atribuição.
- **US-13.6** Como **A**, quero usar **múltiplos números** (phone_number_id) e rotear conversas por equipe/segmento, com número padrão como fallback.
- **US-13.7** Como **A**, quero respeitar a **janela de 24 h** automaticamente e ver `quality_rating` + `messaging_limit_tier` do número.

### Critérios de Aceite

- CA-13.1 `/settings/whatsapp` permite colar `waba_id` + System User token; servidor valida via `GET /{waba_id}`, registra o webhook (`POST /{waba_id}/subscribed_apps`) e sincroniza phone numbers.
- CA-13.2 Envio via `POST graph.facebook.com/v21.0/{phone_number_id}/messages`; webhook `/api/public/meta/whatsapp-webhook` valida `X-Hub-Signature-256` HMAC-SHA256 com `META_APP_SECRET` antes de processar.
- CA-13.3 `sendProductList` envia `interactive.product_list` com `catalog_id` + seções de `product_retailer_id`; resposta inbound `order` é persistida com `interactive_type=order`.
- CA-13.4 `wa_templates` espelha o estado da Meta; submissão usa `POST /{waba_id}/message_templates`; webhook `message_template_status_update` atualiza `status` e `rejection_reason` automaticamente.
- CA-13.5 Mensagens inbound com `referral` criam linha em `wa_ad_referrals` (source_type, source_id, ctwa_clid, headline, body, media_url) vinculada à mensagem; landing `/wa/$slug` continua redirecionando para `https://wa.me/...`.
- CA-13.6 `wa_phone_numbers.routing_rules` (jsonb) define segmento/equipe/round-robin; UI mostra qual número enviou cada mensagem.
- CA-13.7 UI bloqueia envio livre após 24 h do último inbound e exige template; `quality_rating` e `messaging_limit_tier` são atualizados pelo webhook `phone_number_quality_update`.
- CA-13.8 Mídia outbound: `POST /{phone_number_id}/media` (resumable) → `media_id` → envio. Mídia inbound é baixada com token e armazenada no bucket `whatsapp-media`.

### Esquema (novo)

- `wa_business_accounts` (waba_id, business_id, access_token, status, webhook_verified_at).
- `wa_phone_numbers` (waba_id FK, phone_number_id, display_phone_number, verified_name, quality_rating, messaging_limit_tier, is_default, routing_rules).
- `wa_templates` (waba_id FK, meta_template_id, name, language, category, status, components, rejection_reason).
- `wa_catalogs` + `wa_catalog_products` (cache do Commerce).
- `wa_ad_referrals` (message_id, conversation_id, source_type, source_id, ctwa_clid, headline, body, media_url).
- `whatsapp_conversations` / `whatsapp_messages` ganham `provider` (`meta` | `twilio`), `wa_phone_number_id`, `wa_message_id`, `context_message_id`, `pricing_category`, `interactive_type`, `referral_id`.

### Server functions (`src/lib/whatsapp-meta.functions.ts`)

- `connectWaba`, `listWabas`, `syncPhoneNumbers`, `listPhoneNumbers`, `updatePhoneNumberRouting`.
- `sendMessage` (texto), `sendTemplate` (HSM), `sendProductList` (catálogo).
- `listTemplates`, `syncTemplates`, `submitTemplate`.
- `listCatalogs`, `syncCatalogProducts`.

### Webhook

- Rota pública: `src/routes/api/public/meta/whatsapp-webhook.ts` (GET handshake `hub.challenge` + POST com verificação HMAC-SHA256).
- Eventos processados: `messages` (inbound + status), `message_template_status_update`, `phone_number_quality_update`.

### Secrets necessárias

- `META_APP_ID`, `META_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN` (string aleatória definida pelo admin), `META_GRAPH_API_VERSION` (default `v21.0`).
- Token por WABA é armazenado na tabela (não em secret global).

### Telas

- 🖥️ `/settings/whatsapp` — WABAs conectadas, formulário de conexão, lista de números, padrão + roteamento. ✅
- 🖥️ `/settings/whatsapp-templates` — listagem, sync com Meta, criação/submissão de templates (header/body/footer). ✅
- 🖥️ `/settings/whatsapp-catalogs` — cache de catálogos do Commerce e sincronização de produtos. ✅
- 🖥️ `/settings/wa-ads` — slugs `/wa/$slug` com UTM, contagem de cliques e ativação. ✅
- 🖥️ `/wa/$slug` (público) — incrementa cliques e redireciona para `https://wa.me/...`. ✅
- 🖥️ `WhatsAppComposer` + `/inbox/whatsapp` — herdam o provedor `meta` automaticamente quando o número estiver conectado.

### Fora de escopo

- WhatsApp Pay e Flows (forms interativos) ficam para release futura.
- Histórico antigo de mensagens Twilio é preservado com `provider='twilio'`; novas conversas usam Meta.

---

## Release 14 — Documentos & Contratos ✅ IMPLEMENTADO

### User Stories

- **US-14.1** Como **U**, quero **gerar uma proposta** a partir do deal com variáveis preenchidas automaticamente.
- **US-14.2** Como **A**, quero manter uma **biblioteca de cláusulas** padrão (LGPD, SLA, garantia) para reuso.
- **US-14.3** Como **A**, quero **aprovação interna** (rascunho → revisão → enviado) antes do envio ao cliente.
- **US-14.4** Como **U**, quero **anexar PDFs adicionais** ao envelope de assinatura.
- **US-14.5** Como **A**, quero um **selo de validade** com hash do documento para auditoria.

### Critérios de Aceite

- CA-14.1 Editor rich-text expande `{{deal.amount}}`, `{{contact.name}}`, `{{company.cnpj}}` etc.; versão é imutável após "enviado".
- CA-14.2 Cláusulas têm slug + categoria; podem ser inseridas por `/cláusula` no editor; controladas por permissão.
- CA-14.3 Status `draft → in_review → approved → sent`; reprovação volta para `draft` com comentário; apenas `approved` pode ser enviado.
- CA-14.4 Até 10 anexos por envelope, máx 25 MB total; signatário visualiza todos antes de assinar.
- CA-14.5 Hash SHA-256 do PDF final + timestamp gravados em `esign_audit`; página `/verify/$hash` confirma autenticidade publicamente.

### Telas

- 🖥️ `/proposals` — lista (status, valor, deal vinculado).
- 🖥️ Editor de proposta (rich text + sidebar de variáveis e cláusulas).
- 🖥️ `/settings/clauses` — CRUD de biblioteca.
- 🖥️ Drawer de aprovação no editor (revisor, comentários, histórico).
- 🖥️ `/verify/$hash` — página pública de verificação.

---

## Release 15 — Cobrança & Financeiro (BR) ✅

### User Stories

- **US-15.1** Como **U**, quero gerar **boleto ou Pix** a partir de uma fatura ou cotação.
- **US-15.2** Como **A**, quero que o pagamento marque a fatura como `paid` automaticamente.
- **US-15.3** Como **A**, quero uma **régua de cobrança** automática para faturas vencidas.
- **US-15.4** Como **A**, quero emitir **NFS-e** após o pagamento.

### Critérios de Aceite

- CA-15.1 Suporte a Asaas, Pagar.me e Mercado Pago (escolhido em `/settings/billing`); fatura recebe `payment_url`, `barcode`, `qr_code`.
- CA-15.2 Webhook valida assinatura do gateway; idempotente por `external_payment_id`; atualiza fatura + dispara workflow `invoice.paid`.
- CA-15.3 Régua = sequência (D+1 email amigável, D+5 WhatsApp, D+15 escalada); pausa automática ao detectar pagamento; configurável por segmento.
- CA-15.4 Integração com NFE.io: dados do tomador puxados do contato/empresa; NF gerada após `paid`; PDF + XML anexados à fatura.

### Telas

- 🖥️ `/settings/billing` — gateway, credenciais, padrão de cobrança.
- 🖥️ `/invoices` — lista global com filtros (status, vencimento, gateway).
- 🖥️ Drawer da fatura — métodos de pagamento, link, QR, histórico de webhooks.
- 🖥️ `/settings/dunning` — builder de régua (passos + canal + condições).
- 🖥️ `/settings/nfse` — credenciais do município/integrador, mapeamento de serviços.

---

## Release 16 — Marketplace & Integrações ✅

### User Stories

- **US-16.1** Como **A**, quero ver um **catálogo de integrações** e instalar com 1 clique.
- **US-16.2** Como **U**, quero receber notificações de deals/tickets no **Slack/Teams**.
- **US-16.3** Como **U**, quero usar comandos `/lovable deal "Acme"` no Slack para criar/consultar registros.
- **US-16.4** Como **A**, quero publicar minhas próprias automações via **Zapier/Make**.

### Critérios de Aceite

- CA-16.1 Marketplace lista connectors com badge "instalado"; OAuth/credenciais salvos em `standard_connectors`; teste de conexão obrigatório antes de ativar.
- CA-16.2 Eventos configuráveis (deal won, novo ticket urgente, lead atribuído); canal alvo por workspace ou por usuário.
- CA-16.3 Comandos: `/lovable deal create`, `/lovable contact find`, `/lovable ticket assign me`; resposta efêmera com link para o CRM.
- CA-16.4 Triggers (`new_lead`, `deal_won`, `ticket_created`, etc.) + actions (`create_contact`, `send_whatsapp`, `add_activity`) publicados; auth via API key existente.

### Telas

- 🖥️ `/marketplace` — grid de apps com busca/categorias.
- 🖥️ Detalhe do app — descrição, escopos, botão "Conectar", configurações.
- 🖥️ `/settings/notifications/slack` — mapeamento eventos → canais.
- 🖥️ `/settings/zapier` — API key dedicada + docs de triggers/actions.

---

## Release 17 — Mobile Nativo / PWA ✅

### User Stories

- **US-17.1** Como **U**, quero usar o CRM em um **app nativo** com login por deep-link.
- **US-17.2** Como **U**, quero receber **push notifications** nativas em iOS/Android.
- **US-17.3** Como **U**, quero **ligar pelo discador do celular** e o log entrar no CRM automaticamente.
- **US-17.4** Como **U**, quero criar notas/tasks **offline** e sincronizar depois.

### Critérios de Aceite

- CA-17.1 App React Native iOS 16+ / Android 10+; login via OTP por email ou magic link (deep-link `lovable://auth?token=`).
- CA-17.2 Push via APNs/FCM; preferências granulares por tipo (menção, atribuição, SLA, mensagem); badge count atualizado.
- CA-17.3 Call intent nativo; depois da chamada, sheet pede "Adicionar nota" e cria `activities` (`type=call`) com duração do log nativo.
- CA-17.4 IndexedDB local (WatermelonDB ou SQLite); fila de sync com resolução last-write-wins; indicador visual de "pendente".

### Telas (mobile)

- 🖥️ Login (OTP).
- 🖥️ Home: hoje, tasks pendentes, atribuídos a mim.
- 🖥️ Lista de contatos/leads/deals/tickets com busca.
- 🖥️ Detalhe com timeline + botões (ligar, WhatsApp, email, nota).
- 🖥️ Compose de nota/task (suporta offline).
- 🖥️ Configurações: push, conta, sair.

---

## Release 18 — Segurança Enterprise ✅

### User Stories

- **US-18.1** Como **A**, quero ativar **SSO SAML/OIDC** para o workspace.
- **US-18.2** Como **A**, quero **provisionar usuários via SCIM** a partir do Okta/Azure AD.
- **US-18.3** Como **A**, quero **exportar audit logs** para S3/Splunk/Datadog.
- **US-18.4** Como **A**, quero restringir acesso por **IP allow-list** e definir **timeout de sessão**.
- **US-18.5** Como **A**, quero escolher a **região dos dados** (US/EU/BR).

### Critérios de Aceite

- CA-18.1 Suporte SAML 2.0 + OIDC; metadata XML/discovery URL; JIT provisioning opcional; força SSO desativa login/senha.
- CA-18.2 SCIM 2.0 endpoints `/scim/v2/Users` e `/scim/v2/Groups`; mapeia `role` por grupo; deprovision desativa user + revoga sessões.
- CA-18.3 Export configurável (destino, frequência, formato JSON/CSV); inclui `audit_logs` + login events + admin actions; assinado com HMAC.
- CA-18.4 Allow-list por CIDR; bloqueio retorna 403 com mensagem; timeout 15min–24h; sessões inativas expulsas via `auth.signOut`.
- CA-18.5 Workspace marca `data_region`; data residency hard (BR não replica fora); UI mostra badge da região.

### Telas

- 🖥️ `/settings/sso` — wizard SAML/OIDC + teste.
- 🖥️ `/settings/scim` — endpoint URL + bearer token.
- 🖥️ `/settings/audit-export` — destino, agendamento, status.
- 🖥️ `/settings/access-policy` — IP allow-list, session timeout, MFA obrigatório.
- 🖥️ `/settings/data-residency` — escolha de região (só na criação do workspace).

---

## Release 19 — IA Avançada ✅ MVP entregue

### User Stories

- **US-19.1** Como **U**, quero um **copilot Cmd+K** para perguntar em linguagem natural sobre meus dados.
- **US-19.2** Como **A**, quero um **agente autônomo de SDR** que qualifica leads frios via WhatsApp/chamada.
- **US-19.3** Como **U**, quero um **forecast por deal** baseado em ML (não só na heurística).
- **US-19.4** Como **A**, quero **lead scoring com ML** treinado no histórico do meu workspace.
- **US-19.5** Como **A**, quero um **voice agent** para atender chamadas inbound 24/7.

### Critérios de Aceite

- CA-19.1 Cmd+K em qualquer página; respostas geradas via Lovable AI + RAG sobre activities/notes/messages do workspace (RLS respeitado); cita fontes clicáveis.
- CA-19.2 Agente segue playbook configurável (até N mensagens, horário comercial, opt-out automático em "pare"); handoff humano via flag no lead.
- CA-19.3 Modelo prevê probabilidade de win + valor esperado por deal; intervalo de confiança; explainability (top 3 features).
- CA-19.4 Treinamento mensal automático com mínimo de 100 deals ganhos+perdidos; score híbrido (rules × ML) com peso configurável.
- CA-19.5 Voice agent atende com SIP/Twilio, identifica intenção, responde FAQs, transfere para humano se solicitado; transcrição + sentiment gravados.

### Telas

- 🖥️ Cmd+K (overlay global).
- 🖥️ `/agents/sdr` — playbook, limites, leads em atendimento, métricas.
- 🖥️ Forecast embutido em `/deals` e `/analytics` (coluna "Prob. ML" + drawer com explanation).
- 🖥️ `/settings/scoring` ganha aba "ML" (status do modelo, features, peso híbrido).
- 🖥️ `/settings/voice-agent` — script, FAQs, regras de transferência, horários.

---

## Release 20 — Marketing Automation completo ✅ MVP entregue

### User Stories

- **US-20.1** Como **U**, quero criar **landing pages** drag-and-drop sem código.
- **US-20.2** Como **U**, quero rodar **A/B testing** em emails e LPs com vencedor automático.
- **US-20.3** Como **A**, quero ver **atribuição multi-touch** de receita por canal.
- **US-20.4** Como **A**, quero sincronizar segmentos com **Meta/Google Ads** e importar leads de Lead Ads.

### Critérios de Aceite

- CA-20.1 Builder com blocos (hero, features, form, depoimento, CTA); preview mobile/desktop; publica em `crm.wktechnology.com.br/lp/$slug` com SSR + meta tags.
- CA-20.2 Até 4 variantes; tráfego dividido configurável; métrica de sucesso (click, submit, deal won); promove vencedor após significância estatística (p < 0.05).
- CA-20.3 Modelos: first-touch, last-touch, linear, U-shaped; relatório por deal won mostra contribuição de cada touchpoint; receita atribuída por canal/campanha.
- CA-20.4 Sync bidirecional de Custom Audiences (Meta/Google); leads de Lead Ads chegam via webhook + atribuição automática à campanha de origem.

### Telas

- 🖥️ `/landing-pages` — lista + métricas (views, conversões, taxa).
- 🖥️ Builder de LP.
- 🖥️ `/campaigns/email` ganha aba "Variantes" para A/B.
- 🖥️ `/analytics` ganha aba "Atribuição" (modelo selecionável + gráfico Sankey).
- 🖥️ `/settings/ads-sync` — contas Meta/Google, audiências sincronizadas, formulários conectados.

---

## Release 21 — Observabilidade & Admin ✅

### User Stories

- **US-21.1** Como **A**, quero uma **status page interna** com saúde das integrações.
- **US-21.2** Como **A**, quero **alertas operacionais** quando algo crítico falhar.
- **US-21.3** Como **A**, quero ver **quotas e billing** por workspace.
- **US-21.4** Como **A**, quero um **sandbox** para testar workflows antes de promover para produção.

### Critérios de Aceite

- CA-21.1 `/admin/status` mostra health de cada cron job (último run, duração, status), Twilio, Gmail OAuth, AI Gateway, gateway de pagamento; auto-refresh 30s.
- CA-21.2 Regras: cron atrasado > 5 min, broadcast com > 10% failure, taxa de erro Twilio > 5% em 5 min; canais email + Slack.
- CA-21.3 `/admin/quotas` por workspace: chamadas/mês, emails/mês, MB de storage, API requests; barra de uso + alerta em 80%; cobrança automática via Stripe quando ultrapassar.
- CA-21.4 Sandbox = workspace espelho (mesmos dados na criação, divergem depois); workflows/sequences executados em sandbox não afetam produção; botão "Promover" copia versão final.

### Telas

- 🖥️ `/admin/status` — dashboard de saúde.
- 🖥️ `/admin/alerts` — regras de alerta, canais, histórico de disparos.
- 🖥️ `/admin/quotas` — tabela por workspace + drilldown.
- 🖥️ `/admin/sandbox` — criar/sincronizar sandbox, lista de objetos divergentes, promover seleção.

---

## Resumo de telas novas (21 releases)

| Release | Rotas / telas novas                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| 12      | `/meet/$token`, `/meetings`, `/settings/video`                                                                     |
| 13      | `/settings/wa-ads`, `/settings/whatsapp-numbers`, `/wa/$slug`                                                      |
| 14      | `/proposals`, `/settings/clauses`, `/verify/$hash`                                                                 |
| 15      | `/settings/billing`, `/invoices`, `/settings/dunning`, `/settings/nfse`                                            |
| 16      | `/marketplace`, `/settings/notifications/slack`, `/settings/zapier`                                                |
| 17      | App mobile (todas as telas nativas)                                                                                |
| 18      | `/settings/sso`, `/settings/scim`, `/settings/audit-export`, `/settings/access-policy`, `/settings/data-residency` |
| 19      | Cmd+K, `/agents/sdr`, `/settings/voice-agent`                                                                      |
| 20      | `/landing-pages`, builder LP, `/settings/ads-sync`                                                                 |
| 21      | `/admin/status`, `/admin/alerts`, `/admin/quotas`, `/admin/sandbox`                                                |
