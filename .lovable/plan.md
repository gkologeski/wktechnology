# Integração Unipile — LinkedIn no TechHire

Substitui o Hunter (extensão Chrome + scraping) pela API oficial da Unipile. Busca **somente LinkedIn Classic** (sem Sales Navigator / Recruiter por enquanto).

## Objetivos

1. Conectar conta LinkedIn do usuário via Unipile (Hosted Auth) e armazenar `account_id`.
2. Buscar perfis (LinkedIn Classic People Search) com os mesmos filtros da URL nativa (`keywords`, `geoUrn`, indústria, empresa, escola, conexões, etc.).
3. Extrair perfil completo (profile.fetch) e salvar como candidato em `ats_candidates` (mesmo schema atual, mantendo `hunting_runs` para auditoria).
4. Enviar mensagens, convites e sincronizar conversas (fase 2 desta integração).
5. Throttling **human-like** para proteger as contas LinkedIn conectadas.

## Escopo confirmado

- Busca: **somente LinkedIn Classic** (não Sales Navigator nem Recruiter).
- Perfis: profile.fetch via Unipile (substitui scraping).
- Mensagens: DM + convites de conexão + inbox sync.
- Credenciais: API key da Unipile (DSN + API key) como secret global do workspace; `account_id` por usuário em `/settings/integrations/linkedin`.
- Hunter atual (extensão Chrome): **depreciado** — manter código por 1 release atrás de feature flag, remover depois.

## Throttling human-like (não-fixo)

Não usar intervalo cravado. Camadas combinadas:

- **profile.fetch**: cap mínimo 4s + **jitter uniforme 1–4s** entre requisições (intervalo real ~5–8s), **máx 80/dia por account_id**.
- **profile.search**: cap mínimo 10s + **jitter 2–5s**, **máx 20/dia por account_id**.
- **Pausa de café**: a cada 8–12 requisições (aleatório), dormir **30–90s**.
- **Janela humana**: por padrão executar apenas **8h–20h no fuso do usuário**; fora disso, enfileirar para a próxima janela. Configurável por workspace.
- **Backoff exponencial** em 429/erro provider (base 30s, fator 2, teto 15min, jitter ±20%).
- Contadores persistidos em `unipile_rate_buckets` (por `account_id` + endpoint + dia UTC).

## Arquitetura

```text
Browser  ──►  TanStack server fn (auth + RLS)
                    │
                    ▼
            unipile-client.server.ts  (throttle + jitter + budget + janela humana)
                    │
                    ▼
            Unipile API (DSN)
                    │
                    ▼
            Persistência: ats_candidates / hunting_runs / unipile_message_log
```

## Schema (migrations)

- `unipile_accounts` — `id, owner_id, user_id, provider ('linkedin'), unipile_account_id, status, connected_at, last_seen_at, daily_window jsonb`.
- `unipile_rate_buckets` — `account_id, endpoint, day_utc, count, last_request_at` (UNIQUE composto).
- `unipile_request_log` — `account_id, endpoint, status, latency_ms, error, payload_hash, created_at` (observabilidade).
- `unipile_message_log` — envios de DM/convite (auditoria + idempotência).
- Reuso de `ats_candidates` (sem novas colunas) e `ats_hunting_captures` para auditoria das execuções de busca.
- GRANTs + RLS por `owner_id` em todas; service_role para o cliente server.

## Server functions / rotas

- `connectLinkedinAccount` — gera URL Hosted Auth da Unipile e retorna ao usuário.
- `/api/public/unipile/webhook` — recebe callback `account.connected` (verifica HMAC com secret Unipile) e grava `unipile_accounts`.
- `searchLinkedinPeople({ filters, cursor })` — chama `POST /api/v1/linkedin/search` com `category: "people"`, `api: "classic"`. Filtros: `keywords`, `location` (geoUrn), `industry`, `current_company`, `school`, `network` (1º/2º/3º), `language`. Paginação por cursor.
- `fetchLinkedinProfile({ public_identifier })` — chama `GET /api/v1/users/{identifier}` e mapeia para `ats_candidates` (upsert por linkedin_url).
- `bulkImportFromSearch({ search_id, limit })` — enfileira N perfis para fetch respeitando budget diário/jitter; cada um persiste direto no TechHire.
- `sendLinkedinMessage`, `sendLinkedinInvite`, `listLinkedinChats` (fase 2 desta integração).

## UI

- `/settings/integrations/linkedin` — conectar/desconectar conta, ver status, último uso, contadores do dia, janela humana configurável.
- `/hunting` — reescrita: aba **Busca** (form de filtros Classic + tabela de resultados + ação "Importar selecionados"), aba **Execuções** (histórico `hunting_runs`), aba **Conta LinkedIn**.
- Toasts e estados claros: `rate_limited`, `out_of_window`, `daily_budget_reached`, `account_disconnected`.

## Segurança

- API key Unipile via `add_secret` (`UNIPILE_API_KEY`, `UNIPILE_DSN`, `UNIPILE_WEBHOOK_SECRET`).
- Cliente `unipile.server.ts` **só** em handlers de server fn / rotas; nunca importado em `*.functions.ts` no topo.
- Webhook valida HMAC + idempotência.
- RLS por `owner_id` em todas as tabelas novas.
- Logs sem PII além do necessário; payloads grandes via hash.

## Entregas (fases)

1. **F1 — Fundamentos**: migrations, secrets, cliente server com throttle/jitter/janela humana, `/settings/integrations/linkedin` + Hosted Auth + webhook.
2. **F2 — Busca + Perfil (Classic)**: `searchLinkedinPeople`, `fetchLinkedinProfile`, nova `/hunting` (aba Busca + Importar). Hunter Chrome marcado como depreciado (feature flag).
3. **F3 — Bulk import + Observabilidade**: `bulkImportFromSearch`, painel de execuções, métricas (budget restante, sucesso/erro/latência).
4. **F4 — Mensageria**: DM, convites, sync de inbox, templates.

## Perguntas abertas (preciso da sua resposta para iniciar a F1)

1. **DSN + API key da Unipile**: você vai me passar via `add_secret` quando eu pedir, certo? (não cole no chat agora)
2. **Janela humana padrão**: 8h–20h no fuso `America/Sao_Paulo` está OK como default?
3. **Hunter Chrome**: pode marcar como depreciado já na F2 (mantém código atrás de flag) ou prefere remover só depois de validar a F2 em produção?