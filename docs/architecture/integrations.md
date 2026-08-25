# Integrações externas

## 1. Regras gerais

1. Nunca simular integração como se estivesse em produção. Sem credencial, o
   estado correto é "não configurado" — com arquitetura real pronta.
2. Sem segredo em código. Credenciais em variáveis de ambiente do servidor ou
   em `integrations.credentials_secret_ref`.
3. Padrão **adapter/provider**: contrato tipado + implementação por provedor +
   provider mock para teste interno.
4. Estados obrigatórios na UI: não configurado, configurado, conectando,
   conectado, sincronizando, falha, desativado (`integration_status`).
5. Todo efeito externo é auditado (`domain_events` / `log_audit_event` /
   `recordAtsEvent`) e, quando consome créditos, registrado em `credit_ledger`.
6. Proteger rollout com `feature_flags` (`ats.<área>.<feature>`,
   rollout 0 → 10 → 100).

Registro central: tabela `integrations`, tela `/integrations`, marketplace em
`marketplace_apps` / `marketplace_installations`.

## 2. IA (Lovable AI Gateway)

- Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`.
  Chave: `LOVABLE_API_KEY`, lida dentro do handler.
- Modelo padrão de trabalho: `google/gemini-2.5-flash`.
- Usos em produção:
  - **Copilot** (`src/lib/copilot.functions.ts`, `CopilotCmdK`, Cmd/Ctrl+K) —
    responde apenas com base no contexto recuperado por RLS, citando fontes.
  - **Agente conversacional do CRM** (`src/lib/ai-agent/`): tools de leitura
    executam direto; tools de escrita exigem aprovação do usuário em card.
    Prompt em `src/lib/ai-agent/system-prompt.ts`.
  - **Parsing de CV** e match score no ATS; briefing diário; sinais de fraude.
  - **Importação de contratos** `.docx`/`.pdf` com extração de variáveis e
    sugestão de vínculos (`contract_link_ai_suggestions`).
  - **Smart compose** e resumos (`ai_summaries`, `meeting_summaries`,
    `message_sentiments`).
- Regras: nenhuma ação irreversível sem confirmação humana; resultado
  auditável e explicável; fallback seguro em falha do provedor; IA nunca é
  decisão final em fluxo sensível.

## 3. Enriquecimento e dados de mercado

| Provedor               | Uso                                                        | Notas                                                         |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **Apollo.io**          | busca de prospects, enriquecimento de lead/empresa/contato | usado na qualificação e no hunting; jobs em `enrichment_jobs` |
| **Lusha**              | enriquecimento alternativo de contato                      | opcional                                                      |
| **BrasilAPI / ViaCEP** | CNPJ, endereço, CEP                                        | gratuito, sem credencial                                      |

Enriquecimento é assíncrono e idempotente (há proteção contra race condition na
gravação do resultado).

## 4. CRM externo — HubSpot

`hubspot_owners`, `hubspot_sync_state`, `src/components/hubspot/*`,
`/leads/import-hubspot`. Sincronização bidirecional com mapeamento de owners,
motivos de perda e tradução de valores para PT-BR. Mapa funcional em
`docs/hubspot-feature-map.md`.

## 5. Comunicação

- **E-mail**: contas conectadas (`email_accounts`), threads/mensagens, envio
  transacional com fila (`enqueue_email`, `email_queue_dispatch`,
  `email_send_state`, DLQ), rastreio de abertura/clique
  (`email_tracking_events`), descadastro (`email_unsubscribes`,
  `suppressed_emails`), broadcasts e sequências. Anexos via bucket de storage.
- **WhatsApp / LinkedIn — Unipile v2**: `unipile_*`, `wa_*`, `whatsapp_*`,
  rate limit em `unipile_rate_buckets`, callback `/unipile-connected`.
- **Voz — Twilio / ElevenLabs / Vapi**: `voice_agent_settings`,
  `prospecting_call_attempts`; webhooks validam `X-Twilio-Signature`.
- **Slack**: `slack_integrations`, `slack_event_routes`, provisionamento de app.
- **Chat ao vivo / widget**: `live_chat_sessions`, `live_chat_messages`,
  rota pública `/widget/$workspaceId`.

## 6. Calendário e reuniões

`calendar_accounts`, `calendar_events`, `booking_pages`, `bookings`,
`meet_recording_index`. Páginas públicas `/book/$slug`, `/schedule/$token`,
`/meet/$token`. Google OAuth **sempre** pelo broker Lovable
(`lovable.auth.signInWithOAuth`), com `redirect_uri` público same-origin.

## 7. Assinatura eletrônica

Nativa: `esign_documents`, `esign_signers`, `esign_attachments`, `esign_audit`,
hash verificável (`esign_verify_hash`), páginas públicas `/offer/$token`,
`/quote/$token`, `/verify/$hash`. Conclusão dispara efeitos (ex.:
`ats_offers_sync_on_esign`).

## 8. Financeiro e pagamentos

Conexões bancárias (`bank_connections`, tokens, eventos), cobranças e
pagamentos (`bank_charges`, `bank_payments`), extrato para conciliação
(`bank_statement_transactions`), NFS-e (`nfse_invoices`),
`payment_webhook_events`. Todo webhook de pagamento valida assinatura antes de
escrever.

## 9. Ads e atribuição

`ads_accounts`, `ads_audiences`, `ads_lead_forms`, `attribution_touchpoints`,
`landing_page_events`, `ab_tests` / `ab_test_events`.

## 10. ATS — adapters de mercado

Contratos em `src/lib/ats/adapters/types.ts`: `JobBoardAdapter`,
`AssessmentAdapter`, `BackgroundCheckAdapter`, `HrisAdapter`. Catálogo em
`registry.ts` (LinkedIn, Indeed, Vagas.com, HackerRank, Codility, Checkr,
BambooHR — marcados `comingSoon` com flag associada).

Regras: implementação em `adapters/<slug>/<area>.server.ts`; import sempre lazy
dentro da server fn; retorno sempre `AdapterResult<T>` (não lança para o
caller); todo efeito externo chama `recordAtsEvent`. Detalhes em
`docs/ats-platform-foundation.md`.

## 11. API pública e MCP

- REST versionada: `src/routes/api/public/v1/**`, autenticada por `api_keys`,
  com webhooks de saída (`outbound_webhooks`, `webhook_deliveries`,
  `zapier_subscriptions`).
- **MCP server** (`src/lib/mcp/index.ts`, rotas `/mcp`, `.mcp/*`,
  `.well-known/oauth-protected-resource`): nome `techerp`, OAuth 2.1 com issuer
  do backend e audiência `authenticated`. Tools: `whoami`,
  `search_companies`, `search_leads`, `list_deals`, `create_lead` — todas
  respeitam as permissões do usuário conectado.
- **Extensão de navegador** (`extension/`) para hunting: captura de perfis,
  ponte de status e pareamento com o app.
- **SCIM** (`scim_tokens`) para provisionamento de usuários.

## 12. Como adicionar uma integração nova

1. Definir contrato/adapter e registrar descritor.
2. Criar registro em `integrations` com estado e `credentials_secret_ref`.
3. Pedir o segredo ao usuário pela ferramenta de secrets (nunca em código).
4. Implementar `*.server.ts` com retry e mapeamento de erro.
5. Expor server fn fina + UI com os sete estados.
6. Auditar efeitos, contabilizar crédito quando aplicável.
7. Proteger com feature flag e documentar env vars aqui.
