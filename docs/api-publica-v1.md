# API pública v1 — Leads, Contatos, Negócios e Reuniões

Documentação dos endpoints HTTP públicos do TechERP para integrações externas.

## 1. Base URL

| Ambiente               | URL                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| Produção               | `https://app.wktechnology.com.br`                                       |
| Produção (URL estável) | `https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app`     |
| Preview                | `https://project--68dcfa85-b6da-4030-a825-b896ca621e0c-dev.lovable.app` |

Todos os caminhos abaixo são relativos à base URL.

## 2. Autenticação

1. Na aplicação, acesse **Configurações → API / Chaves de API** e gere uma chave.
2. A chave começa com `lvb_` e é exibida **uma única vez** — guarde em local seguro.
3. Envie a chave em **um** dos cabeçalhos:

```
Authorization: Bearer lvb_xxxxxxxxxxxxxxxx
```

ou

```
x-api-key: lvb_xxxxxxxxxxxxxxxx
```

### Escopos

| Escopo  | Permite                                  |
| ------- | ---------------------------------------- |
| `read`  | métodos `GET`                            |
| `write` | métodos `POST` (também habilita leitura) |

Toda chave é vinculada a **um workspace**. Leituras e escritas ficam restritas
a esse workspace; não é possível acessar dados de outro.

### Erros padrão

| Status | Corpo                                       | Significado                                   |
| ------ | ------------------------------------------- | --------------------------------------------- |
| 401    | `{"error":"unauthorized"}`                  | chave ausente, inválida, revogada ou expirada |
| 403    | `{"error":"insufficient_scope"}`            | a chave não tem o escopo necessário           |
| 400    | `{"error":"invalid_input","details":{...}}` | payload inválido (detalhes por campo)         |
| 404    | `{"error":"lead_not_found"}`                | entidade vinculada não existe no workspace    |
| 409    | `{"error":"meeting_canceled"}`              | estado incompatível com a operação            |

Outros códigos `404` usados: `contact_not_found`, `company_not_found`,
`deal_not_found`, `pipeline_not_found`, `meeting_not_found`.

Todas as respostas são `application/json`.

---

## 3. Paginação, ordenação e filtros de data

As quatro listagens (`/leads`, `/contacts`, `/deals`, `/meetings`) aceitam os
mesmos parâmetros:

| Parâmetro | Padrão | Descrição                                                        |
| --------- | ------ | ---------------------------------------------------------------- |
| `limit`   | 50     | 1 a 200 registros por página                                     |
| `offset`  | 0      | deslocamento absoluto                                            |
| `page`    | —      | alternativa a `offset`; calcula `(page - 1) * limit`             |
| `from`    | —      | data inicial (ISO 8601 ou `YYYY-MM-DD`)                          |
| `to`      | —      | data final (com `YYYY-MM-DD` inclui o dia inteiro até 23:59:59Z) |
| `order`   | `desc` | `asc` ou `desc`                                                  |

Campo de data usado por recurso:

| Recurso     | Campo de `from`/`to` e ordenação |
| ----------- | -------------------------------- |
| `/leads`    | `created_at`                     |
| `/contacts` | `created_at`                     |
| `/deals`    | `created_at`                     |
| `/meetings` | `scheduled_at`                   |

Toda listagem devolve metadados junto dos dados:

```json
{
  "data": [{ "id": "..." }],
  "meta": { "limit": 50, "offset": 0, "total": 132, "has_more": true }
}
```

Se `offset` ultrapassar `total`, `data` volta vazio e `has_more` é `false`.

---

## 4. Leads

### 4.1 Criar lead

`POST /api/public/v1/leads` — escopo `write`

| Campo          | Tipo            | Obrigatório | Observações                                 |
| -------------- | --------------- | ----------- | ------------------------------------------- |
| `first_name`   | string (1–120)  | sim         | nome                                        |
| `last_name`    | string (≤120)   | não         | sobrenome                                   |
| `email`        | string (e-mail) | não         |                                             |
| `phone`        | string (≤40)    | não         |                                             |
| `company_name` | string (≤200)   | não         | usado para criar/vincular a empresa         |
| `source`       | string (≤80)    | não         | origem (ex.: `site`, `indicação`, `evento`) |

O lead é criado com `status = "new"`. Após a criação, o sistema garante
automaticamente a **empresa** e o **contato** correspondentes, vinculando-os ao
lead.

```bash
curl -X POST "$BASE_URL/api/public/v1/leads" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Guilherme",
    "last_name": "Souza",
    "email": "guilherme@empresa.com.br",
    "phone": "+55 51 99999-0000",
    "company_name": "Empresa Exemplo LTDA",
    "source": "site"
  }'
```

Resposta `200`:

```json
{
  "data": {
    "id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f",
    "first_name": "Guilherme",
    "last_name": "Souza",
    "email": "guilherme@empresa.com.br",
    "phone": "+55 51 99999-0000",
    "company_name": "Empresa Exemplo LTDA",
    "status": "new",
    "source": "site",
    "created_at": "2026-08-21T12:00:00.000Z"
  }
}
```

### 4.2 Listar leads

`GET /api/public/v1/leads` — escopo `read`

Além dos parâmetros da seção 3:

| Parâmetro | Descrição                      |
| --------- | ------------------------------ |
| `email`   | busca exata por e-mail (ilike) |

```bash
curl "$BASE_URL/api/public/v1/leads?limit=20&page=2&from=2026-08-01" \
  -H "Authorization: Bearer $API_KEY"
```

```json
{
  "data": [
    {
      "id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f",
      "first_name": "Guilherme",
      "last_name": "Souza",
      "email": "guilherme@empresa.com.br",
      "phone": "+55 51 99999-0000",
      "company_name": "Empresa Exemplo LTDA",
      "status": "new",
      "source": "site",
      "created_at": "2026-08-21T12:00:00.000Z"
    }
  ],
  "meta": { "limit": 20, "offset": 20, "total": 57, "has_more": true }
}
```

---

## 5. Contatos

### 5.1 Criar contato

`POST /api/public/v1/contacts` — escopo `write`

| Campo          | Tipo            | Obrigatório | Observações                                    |
| -------------- | --------------- | ----------- | ---------------------------------------------- |
| `first_name`   | string (1–120)  | sim         |                                                |
| `last_name`    | string (≤120)   | não         |                                                |
| `email`        | string (e-mail) | não         |                                                |
| `phone`        | string (≤40)    | não         |                                                |
| `job_title`    | string (≤160)   | não         | cargo                                          |
| `company_id`   | uuid            | não         | empresa existente do workspace                 |
| `company_name` | string (≤200)   | não         | reaproveita empresa de mesmo nome ou cria nova |

Se `company_id` for informado e não pertencer ao workspace da chave: `404 company_not_found`.
Se apenas `company_name` vier, o sistema busca uma empresa com o mesmo nome no
workspace e, não encontrando, cria a empresa e vincula ao contato.

```bash
curl -X POST "$BASE_URL/api/public/v1/contacts" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ana",
    "last_name": "Ribeiro",
    "email": "ana@empresa.com.br",
    "job_title": "Diretora de Operações",
    "company_name": "Empresa Exemplo LTDA"
  }'
```

Resposta `200`:

```json
{
  "data": {
    "id": "b1e8c3a2-77d4-4c11-9f3b-15a9de4c8e01",
    "first_name": "Ana",
    "last_name": "Ribeiro",
    "email": "ana@empresa.com.br",
    "phone": null,
    "job_title": "Diretora de Operações",
    "company_id": "3c4a1f2b-9e88-4d31-a0c7-6b2f5d1e9a44",
    "company_name": "Empresa Exemplo LTDA",
    "assigned_to": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "created_at": "2026-08-21T12:10:00.000Z"
  }
}
```

### 5.2 Listar contatos

`GET /api/public/v1/contacts` — escopo `read`

| Parâmetro    | Descrição                      |
| ------------ | ------------------------------ |
| `email`      | busca exata por e-mail (ilike) |
| `company_id` | filtra contatos de uma empresa |

```bash
curl "$BASE_URL/api/public/v1/contacts?company_id=$COMPANY_ID&limit=50" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 6. Negócios

### 6.1 Criar negócio

`POST /api/public/v1/deals` — escopo `write`

| Campo                 | Tipo              | Obrigatório | Observações                                                                 |
| --------------------- | ----------------- | ----------- | --------------------------------------------------------------------------- |
| `name`                | string (1–255)    | sim         | título do negócio                                                           |
| `value`               | number (≥0)       | não         | padrão `0`                                                                  |
| `currency`            | string (3 letras) | não         | padrão `BRL`                                                                |
| `stage`               | enum              | não         | `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost` (padrão `new`) |
| `stage_id`            | string (≤80)      | não         | etapa do pipeline; validada contra o pipeline informado                     |
| `pipeline_id`         | uuid              | não         | padrão: pipeline de negócios padrão do workspace                            |
| `expected_close_date` | string ISO/data   | não         | gravada como data (`YYYY-MM-DD`)                                            |
| `notes`               | string (≤5000)    | não         | observações                                                                 |
| `contact_id`          | uuid              | não         | contato principal                                                           |
| `company_id`          | uuid              | não         | empresa                                                                     |
| `lead_id`             | uuid              | não         | lead de origem                                                              |

Regras:

- `contact_id`, `company_id`, `pipeline_id` e `lead_id` precisam pertencer ao
  workspace da chave; caso contrário, `404` com o erro correspondente.
- Sem `stage_id`, o negócio entra na primeira etapa aberta do pipeline.
- Com `lead_id`: o lead recebe `converted_deal_id`/`converted_at` e, quando o
  payload não informa contato/empresa, esses vínculos são herdados do lead.
- É registrada uma atividade na timeline do lead/contato ("Negócio criado via
  API pública").

```bash
curl -X POST "$BASE_URL/api/public/v1/deals" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa Exemplo — Squad de Dados",
    "value": 48000,
    "currency": "BRL",
    "expected_close_date": "2026-09-30",
    "lead_id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f"
  }'
```

Resposta `200`:

```json
{
  "data": {
    "id": "d4f7b0a1-2c33-4e59-8b71-9ad0e6f21c88",
    "name": "Empresa Exemplo — Squad de Dados",
    "value": 48000,
    "currency": "BRL",
    "stage": "new",
    "stage_id": "novo",
    "pipeline_id": "aa11bb22-cc33-dd44-ee55-ff6677889900",
    "company_id": "3c4a1f2b-9e88-4d31-a0c7-6b2f5d1e9a44",
    "primary_contact_id": "b1e8c3a2-77d4-4c11-9f3b-15a9de4c8e01",
    "expected_close_date": "2026-09-30",
    "closed_at": null,
    "lost_at": null,
    "assigned_to": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "created_at": "2026-08-21T12:20:00.000Z"
  }
}
```

### 6.2 Listar negócios

`GET /api/public/v1/deals` — escopo `read`

| Parâmetro     | Descrição                                                     |
| ------------- | ------------------------------------------------------------- |
| `stage`       | filtra por etapa (mesmos valores do `POST`)                   |
| `pipeline_id` | filtra por pipeline                                           |
| `company_id`  | filtra por empresa                                            |
| `contact_id`  | filtra pelo contato principal                                 |
| `lead_id`     | devolve o negócio convertido a partir do lead                 |
| `closed_from` | `closed_at >= closed_from` (data real de fechamento do ganho) |
| `closed_to`   | `closed_at <= closed_to`                                      |

`closed_at` é preenchido automaticamente quando o negócio passa para `won`, e
`lost_at` quando passa para `lost` — use-os para relatórios por período.

```bash
curl "$BASE_URL/api/public/v1/deals?stage=won&closed_from=2026-01-01&closed_to=2026-06-30&limit=100" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 7. Reuniões

### 7.1 Agendar reunião (em um lead)

`POST /api/public/v1/meetings` — escopo `write`

| Campo               | Tipo            | Obrigatório | Observações                                        |
| ------------------- | --------------- | ----------- | -------------------------------------------------- |
| `title`             | string (1–255)  | não         | padrão `"Reunião"`                                 |
| `scheduled_at`      | string ISO 8601 | sim         | ex.: `2026-08-25T14:30:00-03:00`                   |
| `lead_id`           | uuid            | não         | lead do workspace ao qual a reunião será vinculada |
| `contact_id`        | uuid            | não         | vínculo alternativo com contato                    |
| `deal_id`           | uuid            | não         | vínculo alternativo com negócio                    |
| `recording_consent` | boolean         | não         | padrão `false`                                     |
| `assigned_to`       | uuid            | não         | responsável; padrão: usuário dono da chave         |

Efeitos:

- cria a reunião com `status = "scheduled"` e sala de vídeo (provider `jitsi`);
- registra automaticamente uma atividade do tipo **reunião** na timeline da
  entidade vinculada, com a data agendada;
- retorna `join_url`, o link público de acesso à sala (`/meet/<token>`), que
  pode ser enviado ao participante externo sem exigir login.

```bash
curl -X POST "$BASE_URL/api/public/v1/meetings" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Reunião de descoberta — Empresa Exemplo",
    "scheduled_at": "2026-08-25T14:30:00-03:00",
    "lead_id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f",
    "recording_consent": false
  }'
```

Resposta `200`:

```json
{
  "data": {
    "id": "c72a1d90-3f11-4a55-9d8c-2b7e5f0a1234",
    "title": "Reunião de descoberta — Empresa Exemplo",
    "status": "scheduled",
    "scheduled_at": "2026-08-25T17:30:00.000Z",
    "public_token": "9k2f7d1a8b3c5e6f0g4h2j7k9m1n",
    "room_name": "wkt-184b9435-4f7a2c9e1b8d3f6a5c0e",
    "related_lead_id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f",
    "related_contact_id": null,
    "related_deal_id": null,
    "assigned_to": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "created_at": "2026-08-21T12:00:05.000Z",
    "join_url": "https://app.wktechnology.com.br/meet/9k2f7d1a8b3c5e6f0g4h2j7k9m1n"
  }
}
```

Erros específicos: `404 lead_not_found`, `404 contact_not_found`,
`404 deal_not_found` quando o id informado não pertence ao workspace da chave;
`400 invalid_input` quando `scheduled_at` não é uma data válida.

### 7.2 Listar reuniões

`GET /api/public/v1/meetings` — escopo `read`

| Parâmetro    | Descrição                             |
| ------------ | ------------------------------------- |
| `lead_id`    | filtra reuniões de um lead            |
| `contact_id` | filtra reuniões de um contato         |
| `deal_id`    | filtra reuniões de um negócio         |
| `status`     | ex.: `scheduled`, `live`, `ended`, `cancelled` |

Além disso, `from`/`to`/`limit`/`offset`/`page`/`order` da seção 3 (aplicados a
`scheduled_at`).

```bash
curl "$BASE_URL/api/public/v1/meetings?lead_id=$LEAD_ID&status=scheduled&order=asc" \
  -H "Authorization: Bearer $API_KEY"
```

### 7.3 Cancelar reunião

`POST /api/public/v1/meetings/{id}/cancel` — escopo `write`

| Campo    | Tipo          | Obrigatório | Observações            |
| -------- | ------------- | ----------- | ---------------------- |
| `reason` | string (≤500) | não         | motivo do cancelamento |

Corpo vazio é aceito. Efeitos:

- `status` vira `cancelled` e `ended_at` é preenchido quando ainda estava vazio;
- a atividade da timeline recebe o prefixo `[Cancelada]` e o motivo no corpo;
- **idempotente**: reunião já cancelada devolve `200` com o estado atual.

```bash
curl -X POST "$BASE_URL/api/public/v1/meetings/$MEETING_ID/cancel" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Cliente pediu para remarcar mais adiante"}'
```

Resposta `200`:

```json
{
  "data": {
    "id": "c72a1d90-3f11-4a55-9d8c-2b7e5f0a1234",
    "title": "Reunião de descoberta — Empresa Exemplo",
    "status": "cancelled",
    "scheduled_at": "2026-08-25T17:30:00.000Z",
    "ended_at": "2026-08-21T13:05:00.000Z",
    "related_lead_id": "8f1c2f4e-0b52-4b0a-9f0e-6a1e2b3c4d5f"
  }
}
```

Erros: `404 meeting_not_found` quando o id não pertence ao workspace da chave.

### 7.4 Reagendar reunião

`POST /api/public/v1/meetings/{id}/reschedule` — escopo `write`

| Campo              | Tipo             | Obrigatório | Observações                    |
| ------------------ | ---------------- | ----------- | ------------------------------ |
| `scheduled_at`     | string ISO 8601  | sim         | nova data/hora                 |
| `duration_minutes` | inteiro (5–1440) | não         | recalcula `expires_at` da sala |
| `reason`           | string (≤500)    | não         | motivo registrado na timeline  |

Efeitos:

- atualiza `scheduled_at`, mantém `status = "scheduled"` e **preserva**
  `room_name` e `public_token` — o `join_url` continua válido;
- atualiza a atividade da timeline (`due_date` para a nova data, prefixo
  `[Reagendada]` e nota com data anterior → nova data).

```bash
curl -X POST "$BASE_URL/api/public/v1/meetings/$MEETING_ID/reschedule" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduled_at": "2026-08-27T10:00:00-03:00",
    "duration_minutes": 60,
    "reason": "Conflito de agenda do cliente"
  }'
```

Resposta `200`:

```json
{
  "data": {
    "id": "c72a1d90-3f11-4a55-9d8c-2b7e5f0a1234",
    "status": "scheduled",
    "scheduled_at": "2026-08-27T13:00:00.000Z",
    "expires_at": "2026-08-27T14:00:00.000Z",
    "public_token": "9k2f7d1a8b3c5e6f0g4h2j7k9m1n",
    "join_url": "https://app.wktechnology.com.br/meet/9k2f7d1a8b3c5e6f0g4h2j7k9m1n"
  }
}
```

Erros: `404 meeting_not_found`; `409 meeting_canceled` (reunião cancelada);
`409 meeting_already_ended` (reunião encerrada); `400 invalid_input` para data
inválida.

---

## 8. Fluxo completo: lead → reunião → negócio

```bash
BASE_URL="https://app.wktechnology.com.br"
API_KEY="lvb_xxxxxxxxxxxxxxxx"
JQ_ID='import sys,json; print(json.load(sys.stdin)["data"]["id"])'

LEAD_ID=$(curl -s -X POST "$BASE_URL/api/public/v1/leads" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"first_name":"Guilherme","email":"guilherme@empresa.com.br","company_name":"Empresa Exemplo LTDA","source":"site"}' \
  | python3 -c "$JQ_ID")

MEETING_ID=$(curl -s -X POST "$BASE_URL/api/public/v1/meetings" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"title\":\"Reunião de descoberta\",\"scheduled_at\":\"2026-08-25T14:30:00-03:00\",\"lead_id\":\"$LEAD_ID\"}" \
  | python3 -c "$JQ_ID")

# Reagendar
curl -s -X POST "$BASE_URL/api/public/v1/meetings/$MEETING_ID/reschedule" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"scheduled_at":"2026-08-27T10:00:00-03:00","duration_minutes":60}'

# Criar o negócio a partir do lead
curl -s -X POST "$BASE_URL/api/public/v1/deals" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"name\":\"Empresa Exemplo — Squad de Dados\",\"value\":48000,\"lead_id\":\"$LEAD_ID\"}"
```

## 9. Boas práticas

- Uma chave por integração, com o menor escopo necessário; revogue chaves não usadas.
- Trate `429`/`5xx` com retry exponencial; a criação de lead, contato e negócio
  **não** é idempotente (chamadas repetidas criam registros duplicados) —
  controle isso do seu lado. Cancelamento **é** idempotente.
- Envie datas sempre com fuso (`-03:00` ou `Z`) para evitar deslocamento.
- Para paginar coleções grandes, prefira `order=asc` com `from` fixo e avance o
  `offset`/`page`; assim novos registros não deslocam as páginas já lidas.
- Nunca exponha a chave em código de front-end; use-a somente em servidor.

## 10. Outros endpoints

A família `api/public/v1/ats/*` (vagas, candidaturas, contratação) segue o mesmo
modelo de autenticação por API key e isolamento por workspace.
