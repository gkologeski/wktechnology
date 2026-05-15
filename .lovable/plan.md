
# Parte 1 — Seleção múltipla nas listas

## Onde aplica
Leads, Contatos, Empresas, Negócios (visão tabela). O Kanban de Negócios continua sem checkbox; ações em lote ficam apenas na visão tabela.

## UX
- Coluna de checkbox como primeira coluna da tabela; checkbox no header marca/desmarca todos os filtrados (não a base inteira).
- Quando há ≥1 selecionado, o `PageHeader` é substituído por uma **barra de ações em lote** sticky com:
  - contador "X selecionados" + "Limpar seleção"
  - **Excluir** (confirma com diálogo, mostra quantidade)
  - **Exportar selecionados** (CSV gerado só com as linhas marcadas)
  - **Editar em massa** (abre dialog com lista de campos editáveis daquela entidade — ex: status/source para Leads, stage/owner para Negócios, industry para Empresas; só os campos preenchidos são aplicados)
  - **Ações de integração** (dropdown dinâmico — só aparecem integrações conectadas que suportam ação de lote para a entidade atual: ex. "Enriquecer com Apollo", "Enriquecer com Lusha", "Sincronizar com HubSpot", "Criar tarefa no ClickUp")
- Atalho `Shift+click` para selecionar intervalo.
- Estado de seleção é local à página (não persiste entre rotas).

## Implementação técnica
- Refatorar `src/components/entity-list.tsx`:
  - Novo prop `selectable?: boolean` (default `true`) e `bulkActions?: BulkAction<T>[]` (extensível por página).
  - Estado `selectedIds: Set<string>` com helpers `toggle/selectAll/clear/range`.
  - Render condicional da `<BulkActionBar>` no lugar do header quando `selectedIds.size > 0`.
- Novo componente `src/components/bulk-action-bar.tsx`.
- Novo componente `src/components/bulk-edit-dialog.tsx` recebendo `fields` (mesma definição usada no dialog de edição) e aplicando `update().in("id", ids)` apenas nos campos marcados como "alterar".
- Exclusão: `delete().in("id", ids)` — RLS já garante owner-only, sem risco de vazar dados de outros usuários.
- Export CSV usa `papaparse.unparse(rows.filter(r => selectedIds.has(r.id)))`.
- Ações de integração: cada conector registra seus `bulkActions` num `src/lib/integrations/registry.ts` (ver Parte 2). A `EntityList` consulta o registry filtrando por entidade + integrações conectadas.

---

# Parte 2 — Hub de Integrações

## Estrutura de navegação
- Novo item na sidebar: **Integrações** (`/integrations`).
- Rotas:
  - `/integrations` → catálogo (cards de todas as integrações; status: Disponível / Conectado / Em breve).
  - `/integrations/$slug` → tela do conector (status, configurações, ações como "Enriquecer tudo", logs recentes, botão Desconectar).
  - `/integrations/$slug/connect` → **wizard** de conexão (passos por conector).
- A tela atual `/leads/import-hubspot` é movida para `/integrations/hubspot` como uma das ações do conector. O botão "HubSpot" da tela de Leads passa a abrir essa rota (ou some, e a importação é feita via "Ações de integração" no bulk bar / dentro do conector).

## Modelo de dados (nova migration)

```text
integration_providers       -- catálogo estático em código (não em DB), só referência
integrations                -- conexão configurada por usuário
  id, owner_id, provider (text: 'hubspot'|'apollo'|...), status ('connected'|'error'|'pending'),
  config jsonb               -- credenciais não-secret, IDs de workspace, defaults
  credentials_secret_ref text -- nome da secret no Cloud (quando aplicável)
  oauth_tokens jsonb         -- access/refresh + expiração (criptografar com pgsodium futuramente)
  created_at, updated_at, last_used_at

enrichment_jobs             -- toda execução de enriquecimento/sync
  id, owner_id, integration_id, kind ('enrich'|'import'|'export'|'sync'),
  entity ('lead'|'contact'|'company'|'deal'),
  scope jsonb                -- ids selecionados OU filtros para "tudo"
  status ('queued'|'running'|'done'|'failed'|'partial'),
  total int, processed int, succeeded int, failed int,
  credits_used int default 0,
  error text,
  started_at, finished_at, created_at

enrichment_job_items        -- linha por registro processado (auditoria + retry)
  id, job_id, entity_id, status, before jsonb, after jsonb, error text

credit_ledger               -- consumo de créditos das APIs externas
  id, owner_id, integration_id, job_id?, delta int, balance_after int, reason text, created_at

credit_limits               -- limites configurados pelo usuário
  owner_id, integration_id, monthly_limit int, per_run_confirm_above int
```

Todas com RLS `owner_id = auth.uid()` (`enrichment_job_items` via subquery em `enrichment_jobs`).

## Wizard de conexão (`/integrations/$slug/connect`)
Componente genérico `<ConnectionWizard steps={...} />` que cada conector configura. Passos típicos:
1. **Visão geral** — o que a integração faz, quais entidades afeta, custo estimado.
2. **Autenticação** — varia por conector (ver tabela abaixo).
3. **Mapeamento de campos** — dropdowns para mapear campos da API externa → tabelas do CRM (com defaults sensatos).
4. **Defaults de uso** — frequência, auto-enriquecer ao criar (sim/não), entidades alvo.
5. **Confirmação** — testa a credencial chamando um endpoint leve do conector e grava `integrations.status='connected'`.

## Padrões de enriquecimento (todos os 4 disponíveis quando aplicável)
- **Tela de detalhe** — botão "Enriquecer com {provider}" no header do registro. Cria `enrichment_jobs` com 1 item e abre dialog mostrando antes/depois antes de gravar.
- **Em lote na lista** — via `BulkActionBar` (Parte 1). Confirma com contagem + créditos estimados.
- **"Enriquecer tudo"** — botão na tela do conector. Aceita filtros (ex: "leads sem telefone, criados nos últimos 30 dias"). Roda em background via server function streaming progresso, persistindo em `enrichment_jobs`.
- **Automático ao criar** — toggle por conector em `integrations.config.auto_enrich_on_create`. Implementado por server function chamada após `insert` de Lead/Contact (não trigger no DB para não bloquear inserts e não acoplar Postgres a APIs externas).

## Controle de créditos (resposta do usuário: completo)
- Tela do conector mostra: saldo restante (quando a API expõe — Apollo/Lusha expõem), consumo do mês, gráfico simples.
- `credit_limits.monthly_limit` bloqueia novos jobs quando atingido.
- `per_run_confirm_above` (default 10) força diálogo de confirmação antes de rodar.
- Cada execução grava em `credit_ledger` com link para o job.
- Tela `/integrations/$slug` tem aba "Histórico" listando jobs + créditos consumidos.

---

## Parte 2.1 — Detalhes por conector

Todos os conectores rodam **server-side** via `createServerFn` em `src/lib/integrations/{provider}.functions.ts`, com `requireSupabaseAuth`. Conectores OAuth precisam de uma server route pública para callback em `src/routes/api/public/integrations.{provider}.callback.ts`.

### HubSpot (já parcialmente implementado)
- **Autenticação**: já conectado via Lovable Connector Gateway (`HUBSPOT_API_KEY` + `LOVABLE_API_KEY`).
- **Wizard**: passo de auth resolvido pelo connector; resta mapeamento (firstname/lastname/email/phone/company/hs_lead_status → leads).
- **Endpoints usados** (gateway `https://connector-gateway.lovable.dev/hubspot`):
  - `GET /crm/v3/objects/contacts?limit&after&properties=...` — listar/importar (já existe).
  - `POST /crm/v3/objects/contacts/batch/read` — enriquecer (input por email).
  - `POST /crm/v3/objects/contacts` — push reverso (criar contato no HubSpot a partir de Lead/Contato do CRM).
- **Ações**: Importar (já existe, refatorar para `enrichment_jobs`), Sincronizar selecionados (push), "Enriquecer tudo" buscando emails dos leads na base e batendo no batch/read.

### Apollo.io (enriquecimento)
- **Autenticação**: API Key estática. Wizard pede a chave e a salva via `add_secret` (`APOLLO_API_KEY`). Header: `X-Api-Key: <key>` (também aceita `api_key` no body — usar header).
- **Endpoints** (base `https://api.apollo.io`):
  - `POST /api/v1/people/match` — People Enrichment (1 pessoa). Body aceita `email`, `first_name`+`last_name`+`organization_name`, `linkedin_url`, etc. Retorna pessoa + organização.
  - `POST /api/v1/people/bulk_match` — até 10 por chamada. Usar para lote/“tudo".
  - Waterfall: parâmetros `reveal_personal_emails=true`, `reveal_phone_number=true` (consomem créditos extras).
- **Mapeamento sugerido**: `email`, `phone_numbers[0].sanitized_number → phone`, `title → job_title`, `organization.name → company_name`/`companies.name`, `organization.website_url → companies.domain`, `linkedin_url → notes` (ou nova coluna futura).
- **Ações**: enriquecer (4 padrões), nada de import inicial (não é fonte de leads próprios do usuário).

### Lusha (enriquecimento)
- **Autenticação**: API Key estática. Wizard pede a chave (`LUSHA_API_KEY`). Header: `api_key: <key>`.
- **Endpoints** (base `https://api.lusha.com`):
  - `GET /v2/person` — single contact. Aceita `personId` OU `email` OU `linkedinUrl` OU `firstName`+`lastName`+(`companyName` OU `companyDomain`).
  - `POST /v2/person` — bulk até 100.
  - `GET /v2/company` — enriquecer empresa (`domain` ou `companyId`).
- **Mapeamento**: `emailAddresses[].email`, `phoneNumbers[].number → phone`, `jobTitle → job_title`, `companyName/companyDomain → company_name/domain`.
- **Ações**: enriquecer (4 padrões) para Contatos e Empresas. "Enriquecer tudo" usa o endpoint POST batch.

### ViaCEP (auto-preenchimento de endereço)
- **Autenticação**: nenhuma (público). Sem wizard de auth — só toggle "Ativar".
- **Endpoint**: `GET https://viacep.com.br/ws/{cep}/json/`. Resposta: `logradouro`, `bairro`, `localidade`, `uf`, `cep`. Erro: `{ "erro": true }`.
- **Uso**: hook `useCepLookup` no formulário de Empresa: ao digitar 8 dígitos no campo `address` (ou um novo campo `cep` dedicado — sugerir ao usuário criar coluna `cep`/`city`/`state`/`address_line` em migration futura), chama o endpoint **direto do navegador** (sem proxy) e preenche os campos. Também disponível como ação em lote: "Enriquecer endereço" varrendo empresas com CEP preenchido.

### Conta Azul (sync de clientes/financeiro)
- **Autenticação**: OAuth 2.0 Authorization Code. Wizard:
  1. Pede `client_id` e `client_secret` do app criado no portal Conta Azul (`add_secret` `CONTA_AZUL_CLIENT_ID`/`CONTA_AZUL_CLIENT_SECRET`).
  2. Redireciona para `https://auth.contaazul.com/oauth2/authorize?response_type=code&client_id=...&redirect_uri=https://project--{id}.lovable.app/api/public/integrations/contaazul/callback&scope=...&state=<owner_id>`.
  3. Callback troca `code` por `access_token`/`refresh_token` em `https://auth.contaazul.com/oauth2/token` e grava em `integrations.oauth_tokens`.
  4. Refresh automático via helper `getValidContaAzulToken(integration)` que renova quando expira.
- **Endpoints** (base `https://api-v2.contaazul.com` — confirmar na doc oficial após conexão; dev pode listar com `GET /v1/customers`, `POST /v1/customers`, `GET /v1/sales`).
- **Ações**: "Enviar empresa para Conta Azul como cliente" (bulk), "Importar clientes" (job batch).

### ClickUp (tarefas a partir de Atividades/Negócios)
- **Autenticação**: 2 modos no wizard:
  - **Personal Token** (mais simples): usuário cola `pk_xxx`, salvo como `CLICKUP_API_TOKEN`.
  - **OAuth 2.0** (multi-workspace): `client_id`/`client_secret` + callback `/api/public/integrations/clickup/callback`.
- Header: `Authorization: <token>` (sem `Bearer`).
- **Endpoints** (base `https://api.clickup.com/api/v2`):
  - `GET /team` — listar workspaces (passo do wizard).
  - `GET /team/{team_id}/space`, `GET /space/{space_id}/list` — escolher lista padrão para criação de tasks.
  - `POST /list/{list_id}/task` — criar task. Body: `name`, `description`, `assignees`, `due_date` (ms), `tags`.
- **Ações**: 
  - Botão "Criar task no ClickUp" no `<ActivityTimeline>` (cria a partir de uma activity).
  - Bulk "Criar tasks" em Negócios selecionados (uma task por deal, com link de volta no `description`).
  - "Sincronizar conclusão" opcional — fora deste plano (cron futuro).

---

# Estrutura de arquivos nova

```text
src/components/
  bulk-action-bar.tsx
  bulk-edit-dialog.tsx
src/lib/integrations/
  registry.ts                  # catálogo + bulkActions por entidade
  types.ts                     # tipos compartilhados
  hubspot.functions.ts         # (mover de src/lib/hubspot.functions.ts)
  apollo.functions.ts
  lusha.functions.ts
  viacep.ts                    # client-side, sem server fn
  contaazul.functions.ts
  clickup.functions.ts
  oauth-helpers.server.ts      # token refresh, encrypt
src/routes/
  _authenticated/integrations.tsx              # layout + catálogo
  _authenticated/integrations.$slug.tsx        # tela do conector
  _authenticated/integrations.$slug.connect.tsx # wizard
  api/public/integrations.contaazul.callback.ts
  api/public/integrations.clickup.callback.ts
src/components/integrations/
  connection-wizard.tsx
  provider-card.tsx
  job-history.tsx
  credit-meter.tsx
```

# Migrations
1. Criar `integrations`, `enrichment_jobs`, `enrichment_job_items`, `credit_ledger`, `credit_limits` com RLS.
2. (Opcional, perguntar antes) Adicionar colunas `cep`, `city`, `state` em `companies` para ViaCEP funcionar limpo.

# Ordem de entrega sugerida
1. Seleção múltipla + bulk bar (Excluir, Exportar, Editar em massa) — Parte 1 inteira.
2. Migration de `integrations` + catálogo `/integrations` + tela de conector + wizard genérico.
3. Migrar HubSpot para o novo hub (refatorar import existente como job).
4. ViaCEP (mais simples, valida o padrão de "ação no formulário").
5. Apollo + Lusha (enriquecimento — implementam os 4 padrões).
6. ClickUp (Personal Token primeiro, OAuth depois).
7. Conta Azul (OAuth completo).
8. Créditos: ledger + limites + UI do meter.

# Fora deste plano
- Webhooks de entrada dos provedores (HubSpot/ClickUp suportam, fica para v2).
- Workflows/automações multi-step.
- Apollo/Lusha enrichment de empresas via domínio (foco em pessoas primeiro).
- Criptografia at-rest de `oauth_tokens` com pgsodium (recomendado depois).
