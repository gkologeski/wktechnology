
# Cobertura completa de propriedades HubSpot nas tabelas locais

## Diagnóstico

Hoje, nas etapas de import (`hubspot-steps.server.ts`) pedimos só um subconjunto curto de propriedades. Exemplos:

- **Companies**: pedimos 10 props (`name, domain, industry, numberofemployees, phone, city, state, zip, address, website`). HubSpot tem **~80 props default** + custom (annualrevenue, lifecyclestage, hs_lead_status, description, founded_year, timezone, hubspot_owner_id, hs_object_id, createdate, lastmodifieddate, hs_analytics_source, type, …).
- **Contacts**: pedimos 6 (`firstname, lastname, email, phone, jobtitle, lifecyclestage`). HubSpot tem **~100 props default** (mobilephone, country, state, city, zip, address, company, website, lifecyclestage, hs_lead_status, hs_email_domain, hs_analytics_source, hubspot_owner_id, createdate, lastmodifieddate, hs_object_id, …).
- **Deals**: pedimos 5 (`dealname, amount, dealstage, closedate, pipeline`). HubSpot tem **~50 props default** (dealtype, description, hubspot_owner_id, hs_priority, hs_deal_stage_probability, num_associated_contacts, createdate, hs_lastmodifieddate, …).
- **Activities (notes/calls/meetings/tasks/emails)**: 2–4 props cada. Faltam disposition, duration, owner, status, recording_url, html body completo, attachments meta, etc.
- **Leads**: 7 props. Faltam owner, score, source-detail, etc.

Mesmo se eu listar 200 propriedades hoje, novas custom properties criadas no HubSpot pelo cliente continuariam sem ser importadas. A solução tem que cobrir **default + custom + futuras**.

## Estratégia proposta — 2 camadas

### Camada A: `hs_raw jsonb` lossless em cada tabela importada

Adiciono uma coluna `hs_raw jsonb` em `companies`, `contacts`, `deals`, `leads`, `activities` (e novas `products`, `line_items`, `quotes`, `tickets` quando criadas). Lá grava-se o objeto HubSpot inteiro retornado (já normalizado: `{ id, properties: {...}, createdAt, updatedAt, archived }`). Vantagens:

- Zero perda de informação, hoje e no futuro.
- Custom properties do cliente entram sem migration.
- Permite reprocessamento (re-mapear pra colunas nativas depois) sem refazer chamada à API.
- Permite UI "ver no HubSpot" mostrar todos campos crus.

### Camada B: descoberta dinâmica de propriedades + colunas nativas curadas

Em vez de hardcodar a lista de `?properties=`:

1. No início de cada step, chamo `/crm/v3/properties/{objectType}` (Properties API) UMA vez por job e cacheio em `enrichment_jobs.scope.hs_property_cache` (ou tabela leve `hubspot_properties_cache` por `owner_id`). Filtro propriedades `hidden=false` e `calculated=false` para reduzir ruído (ainda dá ~60–120 por objeto, dentro do limite de `batch/read`).
2. Faço o `batch/read` pedindo essa lista completa → salvo tudo em `hs_raw`.
3. Mapeio um **conjunto curado de campos nativos** (abaixo) para colunas tipadas — usados em filtros, listas, scoring, exibição. Para o resto, a UI lê de `hs_raw`.

#### Colunas nativas novas (por tabela)

`companies`: `annualrevenue numeric`, `lifecyclestage text`, `hs_lead_status text`, `description text`, `country text`, `timezone text`, `hubspot_owner_id text`, `hs_object_id text`, `hs_createdate timestamptz`, `hs_lastmodifieddate timestamptz`, `type text`, `linkedin_company_page text`, `twitterhandle text`, `facebook_company_page text`.

`contacts`: `mobile_phone text`, `country text`, `address text`, `cep text`, `website text`, `company_name text` (texto livre vindo do HS, distinto do FK), `lifecyclestage text`, `hs_lead_status text`, `hubspot_owner_id text`, `hs_object_id text`, `hs_createdate timestamptz`, `hs_lastmodifieddate timestamptz`, `linkedin_url text`, `twitter_handle text`.

`deals`: `description text`, `dealtype text`, `hs_priority text`, `hs_deal_stage_probability numeric`, `hubspot_owner_id text`, `hs_object_id text`, `hs_createdate timestamptz`, `hs_lastmodifieddate timestamptz`, `closed_lost_reason text`, `closed_won_reason text`, `num_associated_contacts integer`.

`leads`: `hubspot_owner_id text`, `hs_object_id text`, `hs_createdate timestamptz`, `hs_lastmodifieddate timestamptz`, `hs_lead_source_detail text`.

`activities`: `duration_ms integer`, `disposition text`, `recording_url text`, `meeting_outcome text`, `meeting_location text`, `task_status text`, `task_priority text`, `email_direction text`, `email_status text`, `hubspot_owner_id text`, `hs_object_id text`, `hs_createdate timestamptz`, `hs_lastmodifieddate timestamptz`.

(Tudo nullable, sem default — não quebra dados existentes.)

## Mudanças por arquivo

### 1. Migration (1 arquivo)

- `ALTER TABLE` em `companies, contacts, deals, leads, activities` adicionando `hs_raw jsonb` + as colunas nativas listadas acima.
- Índice GIN em `hs_raw` por tabela (`CREATE INDEX ... USING GIN (hs_raw)`).
- Índices btree em `hs_object_id` e `hubspot_owner_id` onde adicionados.
- RLS: já existe `owner_id` policy — nada novo.
- Sem alteração em colunas existentes → seguro pra dados atuais.

### 2. `src/lib/integrations/hubspot-steps.server.ts`

- Novo helper `loadHsProperties(objectType)` que chama `/crm/v3/properties/{objectType}`, filtra `hidden=false && calculated=false`, e devolve `string[]` com nomes. Cacheado em memória por job (Map por objectType).
- `batchRead` passa a aceitar `properties: string[]` longa (já chunked por 100 ids; cap de props ~250 está dentro do limite HubSpot).
- Em cada step de inserção:
  - Substituir o `properties` curto pelo retorno de `loadHsProperties(...)`.
  - Mapear o subconjunto curado para colunas nativas (helpers `mapCompany(p)`, `mapContact(p)`, `mapDeal(p)`, `mapLead(p)`, `mapActivity(kind, p)`).
  - Sempre setar `hs_raw: { id, properties: p, createdAt, updatedAt }` no insert.
- Parsing seguro: datas com `parseHsDate(p.createdate)` (HubSpot devolve ISO string ou epoch ms), números com `parseHsNumber`.

### 3. `src/lib/integrations/hubspot-count.ts`

Sem mudança funcional, mas adicionar contagem de `properties_total` no preview opcional (campo "X propriedades default + Y custom serão importadas") — pode ficar pra v2.

### 4. UI (`import-wizard.tsx`)

- Adicionar um item na tabela de pré-visualização: linha "Propriedades" mostrando "todas (default + custom)" em vez de número (ou somar `default+custom` da Properties API).
- Tooltip explicando: "Importamos todos os campos padrão e personalizados do HubSpot. Os principais ficam em colunas dedicadas; os demais ficam disponíveis na visualização avançada do registro."

### 5. (Opcional, v2) UI de registro

Em `companies/$id`, `contacts/$id`, `deals/$id`: aba "Mais campos (HubSpot)" que renderiza `hs_raw.properties` filtrando os que já têm coluna nativa. Não precisa entrar agora — fica pra outro PR.

## O que NÃO faço neste PR

- **Não** crio coluna nativa pra cada custom property do cliente (seria infinito). Custom properties ficam em `hs_raw` e são acessíveis via JSONB.
- **Não** mexo em objetos ainda não implementados (products, line_items, quotes, tickets, owners) — esses entram na trilha completa que você pediu antes; este PR só completa cobertura dos 5 objetos já importados.
- **Não** faço backfill dos registros já importados sem `hs_raw`. Eles continuarão sem o campo (ou rodam um novo import). Posso adicionar um botão "refazer mapeamento" depois.

## Perguntas

1. **Escopo deste PR**: você quer só os 5 objetos atuais (companies, contacts, deals, leads, activities), ou já incluir products/line items/quotes/tickets aqui (combinando com o plano anterior)?
2. **Custom properties**: ok deixá-las **só** em `hs_raw` (acessíveis via JSONB e UI futura), ou prefere que eu já crie uma UI de "mapear custom property X → coluna virtual" agora?
3. **Backfill**: deixo registros antigos sem `hs_raw` (precisa novo import) ou crio um job "atualizar registros existentes" lendo de novo a API por `hs_object_id`?
