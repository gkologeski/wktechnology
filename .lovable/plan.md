# Publicação de vagas no LinkedIn via Unipile

Confirmado na documentação Unipile: endpoint `POST /api/v1/linkedin/jobs` cria Job Postings nativos no LinkedIn (aparece em `/jobs`, com filtros oficiais), usando a mesma conta já conectada via Unipile. Isso substitui o adapter atual em modo mock.

## Escopo

Trocar o `LinkedInJobBoardAdapter` (hoje mock com URL fake) por integração real via Unipile, mantendo o fluxo do `JobPostingsPanel` (Publicar/Despublicar) sem mudar UX.

## Requisitos por vaga (LinkedIn exige)

- `company.id` — ID numérico da Company Page (ex: `10108877`). O usuário precisa administrar essa página.
- `location` — geo ID do LinkedIn (ex: `105157835` = Brasil). Não é texto livre.
- `workplace` — `REMOTE` | `HYBRID` | `ON_SITE`.
- `employment_status` — `FULL_TIME` | `PART_TIME` | `CONTRACT` | `INTERNSHIP` | `TEMPORARY` | `VOLUNTEER` | `OTHER`.
- `apply_method` — `{ type: "linkedin", notification_email }` (candidatura no próprio LinkedIn) ou `{ type: "external", url }` (redireciona para site da empresa).
- `description` — texto/HTML da vaga.

Como esses IDs não são triviais, precisamos capturá-los na configuração da vaga (não inventar).

## Implementação

### 1. Cliente Unipile — novos helpers em `src/lib/unipile/client.server.ts`
- `createLinkedinJob(ctx, payload)` → `POST /api/v1/linkedin/jobs`, retorna `{ provider_id, url }`.
- `closeLinkedinJob(ctx, providerId)` → `DELETE /api/v1/linkedin/jobs/{id}` (ou `PATCH` status closed — confirmar no retorno da criação).
- `searchLinkedinLocations(ctx, query)` → helper para geo ID (usar `/linkedin/search/parameters` com `type=LOCATION`).
- `searchLinkedinCompanies(ctx, query)` → helper para company ID (mesmo endpoint com `type=COMPANY`).
- Novo `UnipileEndpoint` `"job.publish"` com budget conservador (5/dia, min interval 30s) — LinkedIn é rigoroso com jobs.

### 2. Schema
Migration adicionando a `ats_jobs` (nullable, só preenchidos quando a vaga vai ao LinkedIn):
- `linkedin_company_id text`
- `linkedin_location_id text`
- `linkedin_workplace text check (in REMOTE/HYBRID/ON_SITE)`
- `linkedin_employment_status text`
- `linkedin_apply_type text default 'linkedin'`
- `linkedin_apply_url text`
- `linkedin_notification_email text`

`ats_job_postings` já tem `external_id`/`external_url` — reaproveitar.

### 3. Adapter — reescrever `src/lib/ats/adapters/linkedin/job-board.ts`
- `isLive()` passa a checar se o workspace tem `unipile_accounts` ativa (não mais env vars).
- `postJob` monta payload a partir de `JobPostPayload` + campos LinkedIn da vaga, chama `createLinkedinJob`, retorna `{ externalId, url }` reais.
- Fallback para mock só quando faltarem campos LinkedIn obrigatórios (com erro claro, não silencioso).
- `closeJob` chama `closeLinkedinJob`.

### 4. Payload extendido
`JobPostPayload` em `src/lib/ats/adapters/types.ts` ganha `providerConfig?: Record<string, unknown>` opcional. `publishJobToProvider` (em `src/lib/ats/job-postings.functions.ts`) monta o `providerConfig` com os campos LinkedIn quando `provider === "linkedin"`.

### 5. UI — configuração LinkedIn na vaga
Novo bloco no formulário da vaga (`src/routes/_authenticated/(ats)/jobs_.$id.edit.tsx` ou drawer equivalente):
- Combobox de Company Page (busca via Unipile companies).
- Combobox de Location (busca via Unipile locations).
- Select workplace / employment_status.
- Radio "Candidatura via LinkedIn" (com email) ou "URL externa".

Sem esses campos preenchidos, o botão **Publicar** no LinkedIn dentro do `JobPostingsPanel` mostra tooltip "Configure dados do LinkedIn na vaga" e fica desabilitado (em vez de cair em mock silencioso).

### 6. Observabilidade
Toda chamada já passa por `unipile_request_log` e `unipile_message_log`. Adicionar `entity_type='job'` para diferenciar de outreach.

## Fora de escopo

- Update de vaga já publicada (LinkedIn não permite editar todos campos; deixar como "despublicar e republicar").
- Multi-company (uma Company Page por vaga por enquanto).
- Sincronização de candidaturas do LinkedIn de volta para `ats_applications` — planejar em onda separada (precisa webhook `EASY_APPLY` do Unipile).

## Riscos

- LinkedIn cobra créditos de Job Slot da conta. Deixar aviso claro na UI antes do primeiro publish.
- Endpoint pode exigir Recruiter/Premium — validar no primeiro teste real; se falhar, capturar erro e mostrar mensagem exata do Unipile ao usuário.
- Rate limit: máximo 5 jobs/dia por conta (configurável).

## Como validar manualmente

1. Configurar Company Page ID em uma vaga teste.
2. Clicar Publicar → LinkedIn dentro do JobPostingsPanel.
3. Conferir vaga no LinkedIn `/jobs/view/{id}` e log em `unipile_request_log`.
4. Despublicar e conferir status.
