# Release 11 — Agente de prospecção por telefone + A/B de scripts

Substitui o Release 11 anterior (Web Push / anexos / classificação IA). Aqueles itens voltam para o backlog.

## Visão geral

Criar um **agente de prospecção por voz** que liga para leads automaticamente usando **Vapi.ai** como orquestrador (Vapi cuida do Twilio + STT + LLM + ElevenLabs nativamente) e uma **área de campanhas de prospecção** onde o usuário monta vários scripts e roda testes A/B em grupos de leads para descobrir qual converte melhor.

Twilio Voice já está conectado no projeto (`src/lib/twilio-voice.functions.ts`, secrets `TWILIO_ACCOUNT_SID/API_KEY_SID/...`). O número Twilio será importado dentro do Vapi (uma vez, manualmente no dashboard Vapi), então o app só precisa falar com a API do Vapi.

## Entregáveis

### 1. Configuração de Voice Agent (Settings → Voice Agent)
- Tela nova `settings.voice-agent.tsx`.
- Conectar Vapi: campo para `VAPI_API_KEY` (secret) + seleção do `vapiPhoneNumberId` (lista vinda de `GET /phone-number`).
- Conectar ElevenLabs via standard connector (`ELEVENLABS_API_KEY`).
- Seleção de voz:
  - Modo "Pré-curada": dropdown com as ~10 vozes recomendadas (Sarah, Brian, George, Alice, etc.) com IDs fixos.
  - Botão "Sincronizar minhas vozes" → chama `GET https://api.elevenlabs.io/v2/voices` no servidor e popula um segundo grupo no dropdown (inclui clones).
- Configurações globais do agente: modelo LLM (gpt-4o-mini default), idioma, velocidade, estabilidade, similarity_boost, first_message default, máx. duração da chamada, horário permitido.

### 2. Scripts de prospecção (nova tabela)
- CRUD em `settings.prospecting-scripts.tsx`.
- Campos: nome, prompt do sistema, mensagem de abertura, objetivo (qualificar / agendar reunião / pesquisa), voz override (opcional), variáveis de personalização (`{{lead.name}}`, `{{lead.company}}`).
- Pré-visualização: botão "Testar voz" sintetiza a mensagem de abertura via ElevenLabs e toca no navegador.

### 3. Campanhas de prospecção (área nova /prospecting/campaigns)
- Lista de campanhas + tela de criação/edição.
- Campos: nome, fonte dos leads (segmento/saved view/seleção manual), janela de discagem, máx. tentativas por lead, intervalo entre retries.
- **Atribuição de scripts (A/B)** — dois modos por campanha:
  - **Split aleatório por peso**: adiciona N scripts, cada um com peso % (validação soma = 100). Ao discar, sorteia conforme peso e grava `script_variant_id`.
  - **Segmentos fixos**: cada script é amarrado a um segmento/saved view; o lead recebe o script do seu segmento. Conflito → primeiro match.
- Ações: Start / Pause / Stop. Start enfileira as chamadas.

### 4. Execução de chamadas
- Server fn `startCampaignCall(campaignId, leadId)`:
  - Resolve script via regra de atribuição.
  - Cria/atualiza um Vapi assistant transiente com `model`, `voice` (ElevenLabs `voice_id`), `firstMessage`, `systemPrompt` (com variáveis renderizadas).
  - `POST https://api.vapi.ai/call` com `assistantId` (ou assistant inline), `phoneNumberId`, `customer.number` (lead.phone E.164), `metadata: { campaignId, leadId, scriptId, attemptId }`.
  - Persiste `prospecting_call_attempts` (status=queued).
- Botão "Ligar agora" também disponível na ficha do lead, fora de campanha.

### 5. Webhook do Vapi
- `src/routes/api/public/hooks/vapi.ts` — recebe eventos `status-update`, `end-of-call-report`, `transcript`, `function-call`.
- Valida assinatura via header `x-vapi-secret` (compara com `VAPI_WEBHOOK_SECRET`).
- Atualiza `prospecting_call_attempts` (status, duração, custo, gravação URL, transcript, summary, success_evaluation).
- Em `end-of-call-report`: cria `activities` no lead + atualiza counters da campanha.

### 6. Dashboard de resultados A/B (/prospecting/campaigns/$id)
- Por variante (script): chamadas atendidas, taxa de atendimento, duração média, taxa de "sucesso" (success_evaluation do Vapi), próximos passos gerados, conversão para reunião agendada.
- Tabela de chamadas com filtros, link para transcript e player de gravação.
- Indicador de "vencedor estatístico" simples (intervalo de confiança 95% via fórmula de proporções) quando amostra ≥ 30 por variante.

## Detalhes técnicos

### Schema novo (1 migration)
- `prospecting_scripts` (id, workspace_id, owner_id, name, system_prompt, first_message, objective, voice_id, voice_provider, variables jsonb, created_at, updated_at).
- `prospecting_campaigns` (id, workspace_id, owner_id, name, status enum[draft|running|paused|done], assignment_mode enum[weighted|segment], dialing_window jsonb, max_attempts int, retry_interval_minutes int, source_type enum[segment|saved_view|manual], source_ref uuid, created_at, updated_at).
- `prospecting_campaign_variants` (id, campaign_id, script_id, weight int, segment_id uuid null, position int).
- `prospecting_call_attempts` (id, workspace_id, owner_id, campaign_id null, variant_id null, lead_id, script_id, vapi_call_id, status enum[queued|ringing|in_progress|completed|failed|no_answer|busy], started_at, ended_at, duration_seconds, cost_usd, recording_url, transcript text, summary text, success_evaluation text, ended_reason text, attempt_number int, created_at).
- Todos com GRANT para `authenticated`/`service_role` e RLS por workspace (padrão do projeto).
- Enum `voice_provider` (`elevenlabs`, `vapi_default`).

### Secrets necessários
- `VAPI_API_KEY` — pedir via `secrets--add_secret` (instruir o usuário a importar o número Twilio dentro do Vapi e colar o private key da org Vapi).
- `VAPI_WEBHOOK_SECRET` — pedir via `secrets--add_secret` (configurado no Vapi dashboard como server URL secret).
- `ELEVENLABS_API_KEY` — via standard connector ElevenLabs (`standard_connectors--connect`).

### Server functions / rotas novas
- `src/lib/vapi.functions.ts` — `listVapiPhoneNumbers`, `createOrUpdateAssistant`, `startCall`, `stopCall`.
- `src/lib/elevenlabs.functions.ts` — `listElevenLabsVoices`, `previewVoice` (TTS de uma frase, retorna mp3).
- `src/lib/prospecting-scripts.functions.ts` — CRUD.
- `src/lib/prospecting-campaigns.functions.ts` — CRUD + `startCampaign`, `pauseCampaign`, `dialNextBatch`.
- `src/lib/prospecting-call-attempts.functions.ts` — list/get + stats agregadas por variante.
- `src/routes/api/public/hooks/vapi.ts` — webhook (valida `x-vapi-secret`, idempotente por `vapi_call_id`).
- Cron `pg_cron` a cada 1 minuto chama `/api/public/hooks/dial-tick` para retirar até N chamadas da fila respeitando dialing_window e max_attempts (auth via `apikey` anon header, padrão do projeto).

### Rotas (UI)
- `src/routes/_authenticated/settings.voice-agent.tsx`
- `src/routes/_authenticated/settings.prospecting-scripts.tsx`
- `src/routes/_authenticated/prospecting.campaigns.tsx` (lista)
- `src/routes/_authenticated/prospecting.campaigns.$id.tsx` (detalhe + A/B dashboard)
- Item de menu novo na sidebar: **Prospecção por voz** (subitens: Campanhas, Scripts, Configuração).

### Fora de escopo (vai pra Release 12)
- Importação automática de números Twilio para Vapi via API (fica manual).
- Discador preditivo / paralelo (>1 chamada simultânea por agente humano).
- Transferência ao vivo (warm transfer) para humano.
- URA / menu DTMF.

## Plano de implementação (ordem)
1. Migration com as 4 tabelas + enums + grants + RLS.
2. Pedir secrets `VAPI_API_KEY` e `VAPI_WEBHOOK_SECRET`; conectar ElevenLabs.
3. Server fns Vapi + ElevenLabs (incluindo preview).
4. Tela Settings → Voice Agent (conexões, seleção de voz, sync).
5. CRUD de scripts + preview de voz.
6. CRUD de campanhas (incluindo UI dos dois modos de A/B).
7. Webhook Vapi + cron dial-tick.
8. Dashboard de resultados por variante com cálculo de vencedor.
9. Item de sidebar + botão "Ligar agora" na ficha do lead.
10. Atualizar `.lovable/plan.md` (Release 11 redefinido).
