# Teste ponta a ponta da API pública v1 com chave real

Validar em execução real os endpoints de leads, contatos, negócios e reuniões
(agendar, reagendar, cancelar), conferindo status HTTP, corpo das respostas e
códigos de erro documentados em `docs/api-publica-v1.md`.

## Estado atual verificado

- Existe apenas **uma** chave de API no banco: `site` (prefixo `lvb_263642`,
  escopos `read` + `write`, workspace `184b9435…`, sem expiração, não revogada).
  A tabela guarda somente `key_hash` (SHA-256), então o valor bruto dessa chave
  **não pode ser recuperado** — não é possível reutilizá-la sem o segredo original.
- Rotas existentes: `leads.ts`, `contacts.ts`, `deals.ts`, `meetings.ts`,
  `meetings.$id.cancel.ts`, `meetings.$id.reschedule.ts` (+ `ats/`).
- Autenticação exige header `Authorization: Bearer lvb_…` (ou `x-api-key`) e
  escopo `read`/`write`; isolamento por `workspace_id` da chave.

## Como a chave real será obtida

Duas opções — escolho a (A) se você não informar a chave:

- **(A) Chave de teste temporária**: gerar um segredo `lvb_…` no sandbox, gravar
  apenas o hash em `api_keys` (workspace de teste, escopos `read`+`write`, nome
  `qa-api-v1`), usar nos testes e **revogar no final** (`revoked_at`), validando
  que a chave revogada passa a retornar `401 unauthorized`.
- **(B) Você me envia a chave `site`** já existente — nesse caso nada é criado.

## Bateria de testes (contra o preview em execução, via `curl`)

### Autenticação e escopo
| Caso | Esperado |
| --- | --- |
| Sem header | `401 { "error": "unauthorized" }` |
| Chave inválida / prefixo errado | `401 unauthorized` |
| Chave revogada (após revogar no fim) | `401 unauthorized` |
| Chave somente `read` em `POST` | `403 insufficient_scope` |

### Leads e contatos
- `POST /api/public/v1/leads` com payload válido → `200`, lead criado com
  `workspace_id` da chave; confere criação automática de empresa/contato.
- `POST /leads` sem `first_name` → `400 invalid_input` + `details`.
- `GET /leads?limit=2&page=2&order=asc&from=…&to=…` → `meta` com
  `limit/offset/total/has_more` coerentes.
- `POST /contacts` com `company_name` já existente → reaproveita a empresa
  (sem duplicar); com `company_id` inexistente → `404 company_not_found`.

### Negócios
- `POST /deals` com `lead_id` do lead criado → `200`, negócio vinculado, lead com
  `converted_deal_id`, atividade na timeline.
- `POST /deals` com `contact_id`/`company_id`/`pipeline_id` de outro workspace →
  `404` correspondente.
- `GET /deals` → confere colunas reais (`value`, `stage`, `closed_at`, `lost_at`)
  e paginação.

### Reuniões
- `POST /meetings` com `lead_id` → `200` com `join_url`; `lead_id` inexistente →
  `404 lead_not_found`; `scheduled_at` inválido → `400 invalid_input`.
- `POST /meetings/{id}/reschedule` → `200`, nova `scheduled_at`, `public_token` e
  `room_name` preservados, atividade da timeline com `due_date` atualizado.
- `reschedule` com data inválida → `400`; com id de outro workspace →
  `404 meeting_not_found`.
- `POST /meetings/{id}/cancel` → `200` com `status = "canceled"` e `ended_at`;
  chamada repetida → `200` idempotente; `reschedule` depois do cancelamento →
  `409 meeting_canceled`.
- `GET /meetings?lead_id=…&status=canceled` → retorna a reunião cancelada.

## Limpeza

Ao final: remover os registros de teste criados (lead, contato, empresa, negócio,
reunião e atividades vinculadas) e revogar a chave `qa-api-v1` — o workspace de
teste volta ao estado anterior. Nenhum dado de produção é alterado.

## Detalhes técnicos

- Testes executados por script `bash`/`curl` em `/tmp`, contra o servidor de
  desenvolvimento (`http://localhost:8080`), sem tocar em código de aplicação.
- A chave bruta nunca é exibida em logs, respostas ou no relatório final.
- Se algum caso divergir da documentação, o relatório aponta a divergência e a
  correção mínima sugerida (código ou doc) — sem aplicar sem sua aprovação, exceto
  ajustes triviais de documentação, se você autorizar.
