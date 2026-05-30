## Objetivo

Trazer os 12 usuários (owners) do HubSpot para dentro do sistema, preservando o status (ativo/arquivado), **sem disparar convite por email**. Cada lead/contato/empresa/negócio/atividade vai passar a exibir como proprietário o owner original do HubSpot — hoje todos estão atribuídos a `guilherme@wktechnology.com.br`.

## Situação atual (já mapeada)

- A tabela `public.hubspot_owners` já existe e tem **12 owners cacheados** (Aline, Andressa, Carla, Eduarda, Emerson, Financeiro, Grasiele, Guilherme, Marketing, RH, Técnica, Thobias).
- As tabelas `leads`, `contacts`, `companies`, `deals` e `activities` **já possuem a coluna `hubspot_owner_id text`** preenchida na importação — só não é usada na UI.
- O campo `assigned_user_id uuid` (proprietário interno) referencia `auth.users`, então owners do HubSpot que ainda não são usuários reais do sistema não podem ser colocados ali diretamente.

## O que vai ser feito

### 1. Migração — transformar `hubspot_owners` em diretório de "membros pendentes"

Adicionar à tabela `public.hubspot_owners`:
- `workspace_id uuid` — preencher com o workspace do Guilherme.
- `mapped_user_id uuid` — null = ainda não vinculado a um usuário real; preenchido quando a pessoa for, no futuro, convidada/criada.
- `status text` — `active` ou `archived`, espelhando o `archived` do HubSpot.
- Adicionar GRANTs + RLS para `authenticated` (somente membros do mesmo workspace leem; só workspace owner edita).
- Auto-mapear o owner `193058059` (Guilherme) para o `auth.uid()` dele.

### 2. Server function `syncHubspotOwners`

`src/lib/integrations/hubspot-owners.functions.ts` — chama `GET /crm/v3/owners?limit=100&archived=true` e `?archived=false` via gateway e dá upsert em `hubspot_owners` (id, email, first_name, last_name, archived → status). **Não cria registros em `auth.users` e não dispara emails.**

### 3. UI — nova aba em Configurações

Rota `/settings/hubspot-users` (link no menu de Configurações):
- Tabela: Nome, Email, Status (Ativo/Arquivado), "Vinculado a" (usuário real do workspace ou — vazio), "Nº de registros" (leads + contatos + empresas + negócios atribuídos).
- Botão "Sincronizar do HubSpot" → chama `syncHubspotOwners`.
- Para cada linha, dropdown "Vincular a usuário do workspace" (opcional, manual e futuro).
- **Não há botão de convite** — somente cadastro local.

### 4. Exibição do proprietário nos registros

Sempre que `assigned_user_id` for null e `hubspot_owner_id` estiver preenchido, mostrar o owner do HubSpot (nome + email + badge "HubSpot") em:
- Grid de Leads (coluna Proprietário).
- Painel "Sobre" do detalhe do Lead.
- Mesma lógica em Contatos, Empresas e Negócios.

Implementação: hook `useHubspotOwnersMap()` que carrega `hubspot_owners` uma vez (12 linhas) e resolve `hubspot_owner_id → { name, email, status }`.

### 5. Backfill (one-shot via migração)

- Atualizar `leads/contacts/companies/deals/activities` com `hubspot_owner_id = '193058059'` para `assigned_user_id = <uuid do Guilherme>` (mapeia o admin atual).
- Para os demais owners (ainda não vinculados a usuários reais), manter `assigned_user_id` null e exibir o nome do owner do HubSpot via fallback do passo 4.

## Aspectos técnicos

- Endpoint HubSpot: `GET https://connector-gateway.lovable.dev/hubspot/crm/v3/owners` — já temos `HUBSPOT_API_KEY` + `LOVABLE_API_KEY`.
- RLS de `hubspot_owners`: SELECT para `authenticated` se `workspace_id IN (current_user_workspaces())`; INSERT/UPDATE/DELETE apenas para `workspace_owner_id = auth.uid()`.
- Nenhum trigger de email é tocado; nenhuma linha é criada em `auth.users`.
- Filtros e ordenação por proprietário continuam usando `assigned_user_id`; o fallback "via HubSpot" é apenas display. Quando um owner for vinculado (`mapped_user_id` preenchido), um job opcional pode propagar para `assigned_user_id`.

## Fora de escopo

- Envio de convites por email (explicitamente pedido para **não** fazer).
- Criação automática de contas no `auth.users` para owners do HubSpot.
- Sincronização contínua bidirecional de owners (será manual, via botão).
