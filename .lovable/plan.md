# API pública v1: contatos, negócios, reuniões e correção do histórico de ganhos

Seis entregas: completar os endpoints públicos de contatos e negócios, permitir cancelar e
reagendar reuniões, padronizar paginação/filtros nas listagens e corrigir a data real de
fechamento dos negócios ganhos.

## Estado atual verificado

- `src/routes/api/public/v1/contacts.ts` já existe, mas filtra e cria por `owner_id` — não por
  `workspace_id`. Isso quebra o isolamento prometido na documentação (a chave é de um workspace).
- `src/routes/api/public/v1/deals.ts` só tem `GET`, filtra por `owner_id` e seleciona a coluna
  `amount`, que **não existe** na tabela `deals` (o campo real é `value`). A listagem hoje falha.
- `leads.ts` (GET) aceita apenas `limit`, sem filtros nem paginação. `meetings.ts` (GET) já tem
  `lead_id`, `from` e `to`, mas sem paginação nem total.
- Não existe endpoint de cancelamento nem de reagendamento de reuniões.
- Negócios ganhos: 428 registros, sendo **422 com o mesmo `closed_at` sintético** (timestamp do
  backfill anterior). A data real está em `hs_raw -> properties -> closedate`, disponível em
  **421 dos 428**, distribuída de jun/2025 a abr/2026. Os 7 restantes não têm dado de origem.

## O que será feito

### 1. Contatos (`/api/public/v1/contacts`)

- Trocar o isolamento de `owner_id` para `workspace_id` na leitura e na escrita (gravando também
  `owner_id`/`assigned_to` com o dono da chave, igual ao `/leads`).
- `GET`: paginação e filtros (abaixo) + busca opcional por `email`.
- `POST`: vínculo automático de empresa por `company_name`, reaproveitando empresa existente do
  workspace antes de criar (mesma regra já usada no fluxo de leads).

### 2. Negócios (`/api/public/v1/deals`)

- Corrigir a projeção para as colunas reais (`value`, `currency`, `stage`, `stage_id`,
  `company_id`, `primary_contact_id`, `expected_close_date`, `closed_at`, `lost_at`).
- Isolamento por `workspace_id`.
- Novo `POST` com: `name` (obrigatório), `value`, `currency`, `stage`, `pipeline_id`,
  `expected_close_date`, `contact_id`, `company_id`, `lead_id`.
  - `contact_id`, `company_id`, `pipeline_id` e `lead_id` são validados como pertencentes ao
    workspace da chave; caso contrário retorna 404 com o erro correspondente.
  - Quando vem `lead_id`: o negócio é criado e o lead recebe `converted_deal_id`/`converted_at`;
    se o lead tiver contato/empresa e o payload não informar, herda esses vínculos.
  - Sem `stage_id` informado, usa a primeira etapa do pipeline padrão do workspace.
  - Registra atividade na timeline do lead/contato ("Negócio criado via API pública").

### 3. Cancelar reunião

`POST /api/public/v1/meetings/{id}/cancel` — escopo `write`.

- Carrega a reunião pelo id **e** pelo workspace da chave; 404 se não pertencer.
- Marca `status = "canceled"`, grava `ended_at` quando ainda não existir e aceita `reason` opcional.
- Atualiza a atividade de timeline vinculada (a que guarda `external_ids.meeting_id`): assunto
  prefixado com "Cancelada" e motivo no corpo.
- Idempotente: reunião já cancelada retorna 200 com o estado atual.

### 4. Reagendar reunião

`POST /api/public/v1/meetings/{id}/reschedule` — escopo `write`.

- Corpo: `scheduled_at` (ISO 8601, obrigatório), `duration_minutes` opcional, `reason` opcional.
- Mesma validação de workspace; rejeita data inválida (400) e reunião cancelada/encerrada (409).
- Atualiza `scheduled_at` e, quando `duration_minutes` vier, `expires_at`; mantém
  `status = "scheduled"`, `room_name` e `public_token` (o link público continua válido).
- Sincroniza a atividade vinculada: `due_date` para a nova data e nota do reagendamento no corpo.
- Retorna a reunião atualizada com `join_url`.

### 5. Paginação e filtros padronizados

Aplicados em `GET /leads`, `GET /meetings`, `GET /contacts` e `GET /deals`:

| Parâmetro | Efeito |
| --- | --- |
| `limit` | 1–200, padrão 50 |
| `offset` ou `page` | deslocamento (`page` calcula a partir do `limit`) |
| `from` / `to` | intervalo de datas |
| `order` | `asc` \| `desc` (padrão `desc`) |
| `lead_id` | filtra por lead vinculado (reuniões e negócios) |
| `status` | filtra por status (leads e reuniões) |

- Campo de data por recurso: leads e contatos por `created_at`; reuniões por `scheduled_at`;
  negócios por `created_at` (com `closed_from`/`closed_to` para data real de fechamento).
- Resposta ganha metadados sem quebrar o formato atual:
  `{ "data": [...], "meta": { "limit", "offset", "total", "has_more" } }`.
- A lógica fica em um helper compartilhado (`src/lib/api-keys/list-params.server.ts`) para as
  quatro rotas usarem as mesmas regras.

### 6. Corrigir `closed_at` dos negócios ganhos

- Migration de dados: para `stage = 'won'`, define
  `closed_at = (hs_raw->'properties'->>'closedate')::timestamptz` quando esse valor existir
  (421 registros), preservando os negócios ganhos dentro do próprio sistema (sem `hs_raw`).
- Os 7 sem data de origem permanecem com o valor atual — não haverá data inventada; isso será
  informado no relatório.
- Efeito: o gráfico "Fechamentos por mês" passa a distribuir os ganhos pelos meses reais em vez de
  concentrar 422 em ago/2026.

## Detalhes técnicos

- Novas rotas: `src/routes/api/public/v1/meetings.$id.cancel.ts` e
  `meetings.$id.reschedule.ts`, seguindo o padrão `createFileRoute` + `server.handlers`.
- Autenticação reaproveita `authenticateApiKey` / `requireScope` / `unauthorized` de
  `src/lib/api-keys/auth.server.ts` — sem alterações no modelo de chaves nem em RLS.
- Validação de payload com `zod`; erros mantêm o contrato `invalid_input` + `details`.
- Toda a escrita continua via `supabaseAdmin` dentro do handler, sempre com o `workspace_id` da
  chave aplicado explicitamente em cada consulta.
- `docs/api-publica-v1.md` será atualizado: contatos, negócios, cancelar/reagendar, tabela de
  paginação/filtros e exemplos `curl`.
- Validações: `tsgo --noEmit`, `eslint` nos arquivos alterados e teste real dos endpoints com uma
  chave de API do workspace de teste (criar contato, criar negócio a partir de lead, agendar →
  reagendar → cancelar reunião, listar com paginação).
