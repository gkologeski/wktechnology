# Release 13 — WhatsApp Business via Meta Cloud API (substitui Twilio)

Reescreve o Release 13 para usar a **WhatsApp Business Platform Cloud API** diretamente da Meta (Graph API v21+), eliminando a dependência do Twilio para WhatsApp. Twilio segue ativo apenas para Voz (Release 11).

## 1. Escopo funcional (substitui o Release 13 original)

### User Stories
- **US-13.1** Como **A**, quero conectar uma ou mais contas **WhatsApp Business Account (WABA)** da Meta via **Embedded Signup** (OAuth do Facebook Login for Business), sem sair do CRM.
- **US-13.2** Como **U**, quero **enviar e receber** mensagens (texto, mídia, documento, localização, reação) usando o número oficial da empresa.
- **US-13.3** Como **U**, quero enviar **catálogo de produtos** (`interactive` tipo `product_list` / `product`) sincronizado com o Commerce Manager da Meta.
- **US-13.4** Como **U**, quero criar/editar **templates HSM** (utility, marketing, authentication) com botões `quick_reply`, `url`, `phone_number` e `copy_code`, submetidos para aprovação da Meta direto do CRM.
- **US-13.5** Como **A**, quero rodar **anúncios click-to-WhatsApp (CTWA)** e capturar `ctwa_clid` + `referral` na primeira mensagem inbound para atribuir o lead à campanha.
- **US-13.6** Como **A**, quero usar **múltiplos números** (phone_number_id) na mesma WABA e rotear conversas por equipe/segmento.
- **US-13.7** Como **A**, quero respeitar a **janela de 24 h** automaticamente (forçar uso de template fora dela) e ver o **status de qualidade** do número (GREEN/YELLOW/RED) + tier de mensageria.

### Critérios de Aceite
- **CA-13.1** `/settings/whatsapp/connect` abre o Embedded Signup; ao concluir, salva `waba_id`, `business_id`, `phone_number_id`, `display_phone_number`, `access_token` (System User token de longa duração) cifrado em `vault`; webhook é registrado automaticamente via `POST /{waba_id}/subscribed_apps`.
- **CA-13.2** Envio usa `POST graph.facebook.com/v21.0/{phone_number_id}/messages`; recebimento via webhook `messages` (entry → changes → value → messages); assinatura validada com `X-Hub-Signature-256` HMAC-SHA256 sobre o body cru usando `META_APP_SECRET`.
- **CA-13.3** Catálogo puxado via `GET /{catalog_id}/products`; mensagem `interactive.product_list` envia `catalog_id` + seções com `product_retailer_id`; resposta inbound `order` vincula a `products.id` e cria oportunidade opcional.
- **CA-13.4** Editor consome `GET /{waba_id}/message_templates`; submissão via `POST` com `category`, `language`, `components`; status (`APPROVED`, `PENDING`, `REJECTED`) sincronizado por webhook `message_template_status_update`; preview renderiza igual ao WhatsApp.
- **CA-13.5** Landing `/wa/$slug` redireciona para `https://wa.me/<display_phone>?text=<msg>`; primeira mensagem inbound com `referral.source_type=ad` cria/atualiza lead com `source=wa_ads`, `utm_*` e `ctwa_clid`.
- **CA-13.6** Roteador escolhe `phone_number_id` por regra (segmento/equipe/round-robin); UI mostra qual número enviou cada mensagem; cada número tem inbox separada filtrável.
- **CA-13.7** Sistema bloqueia envio de mensagem livre após 24 h do último inbound e exige template; widget mostra `quality_rating` e `messaging_limit_tier` (atualizado por webhook `phone_number_quality_update`).
- **CA-13.8** Todo upload de mídia outbound passa por `POST /{phone_number_id}/media` (resumable) para obter `media_id` antes do envio; downloads de mídia inbound usam token para baixar via URL temporária e armazenar em bucket `whatsapp-media`.

### Telas
- 🖥️ `/settings/whatsapp` — lista de WABAs conectadas, status, botão "Conectar nova conta" (Embedded Signup).
- 🖥️ `/settings/whatsapp-numbers` — números (phone_number_id), display name, qualidade, tier, regras de roteamento.
- 🖥️ `/settings/whatsapp-templates` — CRUD de templates com builder de componentes (header/body/footer/buttons), submissão e status Meta.
- 🖥️ `/settings/wa-ads` — slugs `/wa/$slug` + métricas (clicks, conversões, CTWA atribuído).
- 🖥️ `WhatsAppComposer` (drawer em contact/lead/deal/ticket) — chips de template, botão "Catálogo", indicador da janela 24 h, seletor de número.
- 🖥️ Inbox `/inbox/whatsapp` — conversas multi-número, filtro por número/agente.

## 2. Mudanças técnicas

### Banco de dados (migração nova)
- Novas tabelas:
  - `wa_business_accounts` (waba_id, business_id, app_scoped_id, token cifrado, status, webhook_verified_at).
  - `wa_phone_numbers` (phone_number_id, waba_id FK, display_phone_number, verified_name, quality_rating, messaging_limit_tier, routing_rules jsonb).
  - `wa_templates` (waba_id FK, name, language, category, status, components jsonb, rejection_reason, meta_template_id).
  - `wa_catalogs` + `wa_catalog_products` (cache do Commerce).
  - `wa_ad_referrals` (message_id FK, source_id, source_type, ctwa_clid, headline, body, media_url).
- Renomes em `whatsapp_conversations` / `whatsapp_messages`:
  - `twilio_number` → `wa_phone_number_id` (FK).
  - `twilio_sid` → `wa_message_id` (wamid).
  - Novas colunas: `context_message_id`, `pricing_category`, `conversation_origin`, `referral_id` FK.
- Migração de dados existentes: mapear `twilio_number` → novo `phone_number_id` quando conectado.

### Server functions e rotas
- Novas (`src/lib/whatsapp-meta.functions.ts`): `connectWaba`, `listWabas`, `listPhoneNumbers`, `sendMessage`, `sendTemplate`, `sendInteractive`, `uploadMedia`, `downloadMedia`, `listTemplates`, `submitTemplate`, `deleteTemplate`, `listCatalogs`, `syncProducts`.
- `src/routes/api/public/meta/whatsapp-webhook.ts`:
  - `GET` — verificação (`hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`).
  - `POST` — valida `X-Hub-Signature-256`, processa eventos `messages`, `statuses`, `message_template_status_update`, `phone_number_quality_update`, `account_update`.
- Remover/aposentar: `src/routes/api/public/twilio/whatsapp-*.ts` e código de envio WhatsApp em `twilio-*.functions.ts` (preservar voz).
- Adaptar componentes `WhatsAppComposer`, painéis e inbox para o novo schema.

### Secrets (a pedir ao usuário no momento do build)
- `META_APP_ID`, `META_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN` (string aleatória que escolhemos), `META_SYSTEM_USER_TOKEN` (fallback inicial antes do Embedded Signup), `META_GRAPH_API_VERSION` (default `v21.0`).
- Tokens por WABA obtidos via Embedded Signup são cifrados na tabela (não em secret global).

### Webhook
- URL pública estável: `https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/meta/whatsapp-webhook`.
- Configurada automaticamente em cada WABA via `POST /{waba_id}/subscribed_apps` após conexão; no app Meta, o usuário só cola a URL e o `verify_token` uma vez.

### Cron (`scheduled-exports` / novo `whatsapp-meta-tick`)
- Sync periódico de templates, quality rating e catálogo (a cada 15 min) para refletir mudanças feitas no Business Manager.

## 3. Documentação
- Atualizar `docs/releases-12-21-scope.md` (Release 13) com o novo escopo.
- Atualizar tabela final de rotas (adicionar `/settings/whatsapp`, remover referências a Twilio WhatsApp).
- Atualizar `docs/roadmap.md` se mencionar Twilio para WhatsApp.

## 4. Fora de escopo
- Manter Twilio para Voz (Release 11) intacto.
- Não migrar histórico antigo de mensagens Twilio WhatsApp (apenas marcar como `legacy_provider=twilio`); novas conversas usam Meta.
- WhatsApp Pay e Flows (forms interativos) ficam para release futura.

## 5. Pré-requisitos do usuário (informar antes do build)
1. Conta **Meta Business** verificada.
2. App Meta com produto **WhatsApp** habilitado (modo Live) e **Facebook Login for Business** configurado.
3. Número de telefone disponível (pode portar do Twilio — processo manual da Meta, ~7 dias).
4. Catálogo no Commerce Manager (opcional, para US-13.3).
