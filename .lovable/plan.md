# Onda 1 — Plano de finalização

Faltam 6 entregas (1.1.d, 1.1.e, 1.2, 1.3, 1.4, 1.5). É escopo grande; vou implementar em sequência, em mensagens separadas, com checkpoint após cada bloco para você validar antes do próximo.

---

## 1.1.d — Inbound Gmail (History API + pg_cron)

**Backend**
- `src/lib/gmail-sync.server.ts`: helpers para Gmail History API (`users.history.list`, `users.messages.get`), parser de MIME → `body_text/body_html/headers/attachments`, normalização de endereços.
- `src/lib/gmail-sync.functions.ts`: `syncEmailAccount({ accountId })` — usa `history_id` salvo; faz fallback para `messages.list` quando o history expira (404). Para cada mensagem nova: upsert `email_threads` (por `provider_thread_id`), insert `email_messages` (direction=inbound), tenta match com `contacts` pelo `from_email` para preencher `contact_id`. Atualiza `history_id` e `last_sync_at`.
- Endpoint cron `src/routes/api/public/hooks/email-sync-tick.ts`: itera contas com `status=connected`, chama `syncEmailAccount` em cada uma (try/catch isolado).
- pg_cron a cada 1 minuto chamando o hook (via `supabase--insert`, com `apikey` anon).
- Botão "Sincronizar agora" em `/settings/email` (dispara `syncEmailAccount` manual).

**Atividade**: cada inbound também gera registro em `activities` (`type='email'`, `email_direction='inbound'`, vínculo ao contato quando match).

## 1.1.e — UI `/inbox/email`

- Rota `src/routes/_authenticated/inbox.email.tsx` com layout 3 colunas (lista de threads → mensagens → preview), espelhando `inbox.whatsapp`.
- Server fns em `email-inbox.functions.ts`: `listEmailThreads({ q, filter })`, `getEmailThread({ threadId })`, `markThreadRead`.
- Renderização segura de HTML via `dompurify` (já permite imagens/links) com fallback para `body_text`.
- Botão **Responder** abre `SendEmailDialog` em modo reply (preenche To, Subject "Re: …", `inReplyTo`/`references`, `threadId` do Gmail).
- Indicadores de **open/click** (badges) usando `open_count`/`click_count`/`first_opened_at`.
- Item no `app-sidebar` "Email" dentro de Inbox.

## 1.2 — Templates de email + snippets

**Schema** (migration):
- `email_templates(id, owner_id, name, subject, body_html, body_text, shared bool, created_at, updated_at)`.
- `email_snippets(id, owner_id, shortcut text, body text, shared bool, ...)`.
- RLS owner + leitura quando `shared=true` para membros do mesmo workspace (via `team_members`).

**UI/UX**:
- Página `src/routes/_authenticated/settings.email-templates.tsx`: CRUD com editor (textarea HTML simples + preview).
- Render de tokens: helper `renderTokens(template, vars)` resolvendo `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{my_name}}`, `{{my_email}}`. Quando `SendEmailDialog` abre com `contact_id`, o contexto é montado automaticamente.
- `SendEmailDialog`: dropdown "Inserir template" + autocompletion de snippets digitando `;atalho`.

## 1.3 — Calling via Twilio Voice (WebRTC)

Requer pré-configuração no console Twilio: **TwiML App** + número Voice habilitado. Vou listar os passos pra você antes de implementar.

**Secrets necessários** (peço via `add_secret` quando chegarmos): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID`, `TWILIO_CALLER_ID`.

**Backend**:
- `src/lib/twilio-voice.functions.ts`: `getVoiceAccessToken()` — gera JWT (lib `twilio`) com `VoiceGrant` apontando para a TwiML App; TTL 1h.
- Rota pública `/api/public/hooks/twilio-voice-twiml.ts` — responde TwiML `<Dial callerId="…"><Number>{To}</Number></Dial>`.
- Rota pública `/api/public/hooks/twilio-voice-status.ts` — recebe status callback, persiste `activities` (`type='call'`, `duration_ms`, `recording_url`, `disposition`, `outcome`).

**Frontend**:
- `src/components/voice/call-dialer.tsx`: usa `@twilio/voice-sdk` (instalar). Botão de ligar em contatos/leads/deals usa o número formatado E.164.
- HUD global flutuante com timer, mute, hangup; ao desligar abre diálogo para `outcome` + notas (grava na atividade criada pelo status callback).

## 1.4 — Task queues ("play through")

**Schema** (migration):
- `task_queues(id, owner_id, name, description, entity, created_at)`.
- `task_queue_items(id, queue_id, owner_id, entity, entity_id, position, completed_at, skipped_at)`.
- RLS owner.

**UI**:
- `src/routes/_authenticated/tasks.queues.tsx`: lista de filas + criar fila.
- `src/routes/_authenticated/tasks.queues.$queueId.play.tsx`: modo "Play" focado — mostra 1 registro por vez (contato/lead/deal) com painel lateral de ação rápida (ligar, email, WhatsApp, próxima/pular/concluir). Atalhos teclado: `N` próxima, `S` pular, `E` email, `C` ligar, `W` WhatsApp.
- Botão "Adicionar à fila" no bulk-action-bar das telas existentes (contatos/leads).
- Server fns: `createQueue`, `addToQueue`, `nextItem`, `completeItem`, `skipItem`.

## 1.5 — Notes com @menções e anexos

**Schema** (migration):
- Estender `activities` (`type='note'`) com:
  - `mentions uuid[]` (referencia `auth.users.id`).
  - `attachments jsonb` (já existe em `email_messages`; aqui também `[{url, name, content_type, size}]`).
- Bucket público `notes-attachments` (storage) com RLS por `owner_id` no path.

**UI**:
- Refatorar `activity-timeline.tsx`: editor de nota usando textarea com listener de `@` que abre popover de membros do `team_members` (+ o próprio owner).
- Upload drag-and-drop de até 5 arquivos por nota (10 MB cada). Render dos anexos como cards com download.
- Render de menções como `<span class="mention">@nome</span>` linkando para o perfil.
- Trigger SQL: ao criar nota com `mentions`, inserir em `notifications` (se já houver tabela — caso contrário, deixar como "sugerir Onda 3.13" e seguir sem trigger).

---

## Ordem de execução

1. 1.1.d + 1.1.e (mesma feature) — entrega Email completo end-to-end.
2. 1.2 — Templates/snippets (alavanca para 1.4).
3. 1.4 — Task queues.
4. 1.5 — Notes (@menções/anexos).
5. 1.3 — Twilio Voice por último (depende de configuração externa Twilio).

Após cada bloco eu paro, atualizo o `docs/roadmap.md` e peço sua validação antes de seguir.

## Detalhes técnicos relevantes

- Toda lógica server-side via `createServerFn` + `requireSupabaseAuth` (padrão atual).
- Sincronização Gmail respeita rate-limit (250 quota units/seg por usuário) — batches de 25 mensagens por tick.
- Tracking pixel/click já implementado (1.1.c) continua válido para envios feitos via `SendEmailDialog`.
- Twilio Voice SDK (`@twilio/voice-sdk`) é Web-compatível, sem dependências Node.
- DOMPurify roda no client; sanitiza HTML do Gmail antes de renderizar.

## Riscos / pedidos que farei durante a execução

- **1.3**: precisarei dos 5 secrets Twilio + você criar a TwiML App apontando para o endpoint do step 1.3.
- **1.5**: se quiser notificações reais (email/in-app), confirmo se isso entra agora ou fica pra Onda 3.
