# Documentação da API pública v1: Leads e Reuniões

## Situação atual (verificada)

- `POST /api/public/v1/leads` já existe (`src/routes/api/public/v1/leads.ts`), autenticado por API key (`api_keys`, hash SHA-256, prefixo `lvb_`, escopos `read`/`write`).
- **Não existe** endpoint público para reuniões. Só há agendamento por página pública de booking (`/api/public/booking/$slug`), que não permite vincular a um lead específico.
- A tabela `meetings` já tem `related_lead_id`, `related_contact_id`, `related_deal_id`, `title`, `scheduled_at`, `status`, `room_name`, `public_token`, `expires_at`.
- Ponto de atenção: `leads.workspace_id` tem um DEFAULT fixo apontando para um único workspace, e o endpoint de leads filtra/insere por `owner_id`. Isso ignora o `workspace_id` da própria API key.

## O que será feito

### 1. Endpoint de reuniões (novo)

`src/routes/api/public/v1/meetings.ts`

- `POST` (escopo `write`): agenda uma reunião. Campos: `title`, `scheduled_at` (ISO), `duration_minutes` (opcional), `lead_id` (opcional), `contact_id`, `deal_id`, `recording_consent`, `assigned_to` (opcional).
  - Valida com Zod; valida que o `lead_id` informado pertence ao workspace da API key (senão 404).
  - Gera `room_name` e `public_token`, define `status = 'scheduled'` e `expires_at`, reaproveitando os helpers já usados pela criação interna de reuniões.
  - Retorna `{ data: { id, title, scheduled_at, join_url } }`, onde `join_url` é a página pública `/meet/<token>`.
- `GET` (escopo `read`): lista reuniões do workspace, com filtros `lead_id`, `from`, `to` e `limit` (máx. 200).

### 2. Correção de escopo por workspace nos endpoints v1

- Leads (e, por consistência, o insert): passar a gravar e filtrar por `workspace_id` da API key, além de `owner_id`, para que a chave de um workspace nunca leia nem escreva em outro.

### 3. Documentação

`docs/api-publica-v1.md` (PT-BR), com:

- Como gerar a API key na aplicação e como autenticar (`Authorization: Bearer lvb_...` ou `x-api-key`), escopos e códigos de erro (`401 unauthorized`, `403 insufficient_scope`, `400 invalid_input`).
- Base URLs estáveis (produção e preview).
- **Leads**: `GET`/`POST` com tabela de campos, exemplo `curl`, exemplo de resposta e a observação de que empresa e contato são criados/vinculados automaticamente.
- **Reuniões**: `POST` para agendar em um lead (exemplo `curl` com `lead_id`), `GET` para listar, e explicação do `join_url` público.
- Seção final "Fluxo completo": criar lead → agendar reunião no lead retornado.
- Link para a nova doc no índice de `docs/architecture/server-functions.md`.

## Detalhes técnicos

- Endpoint segue o padrão dos irmãos em `api/public/v1`: `authenticateApiKey` + `requireScope`, `supabaseAdmin` importado no handler, Zod em todo body, sem retorno de PII além do próprio registro criado.
- Nenhuma alteração de RLS, schema ou lógica de negócio interna; apenas nova rota HTTP, escopo por workspace e documentação.

## Validações

`bun run typecheck`, `bun run lint`, e teste do endpoint com uma API key real (POST de lead + POST de reunião vinculada).
