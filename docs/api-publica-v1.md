# API pública v1 — Leads e Reuniões

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

Todas as respostas são `application/json`.

---

## 3. Leads

### 3.1 Criar lead

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

### 3.2 Listar leads

`GET /api/public/v1/leads?limit=50` — escopo `read`

| Parâmetro | Padrão | Máximo |
| --------- | ------ | ------ |
| `limit`   | 50     | 200    |

Ordenação: `created_at` decrescente.

```bash
curl "$BASE_URL/api/public/v1/leads?limit=20" -H "Authorization: Bearer $API_KEY"
```

---

## 4. Reuniões

### 4.1 Agendar reunião (em um lead)

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

### 4.2 Listar reuniões

`GET /api/public/v1/meetings` — escopo `read`

| Parâmetro | Descrição                                 |
| --------- | ----------------------------------------- |
| `lead_id` | filtra reuniões de um lead                |
| `from`    | data ISO inicial (`scheduled_at >= from`) |
| `to`      | data ISO final (`scheduled_at <= to`)     |
| `limit`   | padrão 50, máximo 200                     |

```bash
curl "$BASE_URL/api/public/v1/meetings?lead_id=$LEAD_ID" \
  -H "Authorization: Bearer $API_KEY"
```

---

## 5. Fluxo completo: criar lead e agendar reunião

```bash
BASE_URL="https://app.wktechnology.com.br"
API_KEY="lvb_xxxxxxxxxxxxxxxx"

LEAD_ID=$(curl -s -X POST "$BASE_URL/api/public/v1/leads" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Guilherme","email":"guilherme@empresa.com.br","company_name":"Empresa Exemplo LTDA","source":"site"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["id"])')

curl -s -X POST "$BASE_URL/api/public/v1/meetings" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Reunião de descoberta\",\"scheduled_at\":\"2026-08-25T14:30:00-03:00\",\"lead_id\":\"$LEAD_ID\"}"
```

## 6. Boas práticas

- Uma chave por integração, com o menor escopo necessário; revogue chaves não usadas.
- Trate `429`/`5xx` com retry exponencial; a criação de lead **não** é idempotente
  (chamadas repetidas criam registros duplicados) — controle isso do seu lado.
- Envie datas sempre com fuso (`-03:00` ou `Z`) para evitar deslocamento.
- Nunca exponha a chave em código de front-end; use-a somente em servidor.

## 7. Outros endpoints existentes

`GET /api/public/v1/contacts`, `POST /api/public/v1/contacts`,
`GET /api/public/v1/deals` e a família `api/public/v1/ats/*` (vagas,
candidaturas, contratação) seguem o mesmo modelo de autenticação por API key.
