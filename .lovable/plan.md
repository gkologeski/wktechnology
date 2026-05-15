# Importação HubSpot com Árvore de Dependências

Substituir o import simples atual (`leads.import-hubspot.tsx` → só contatos) por um fluxo completo que respeita dependências entre objetos do HubSpot e mostra ao usuário, em tempo real, o que está acontecendo em cada etapa.

## 1. Árvore de dependências do HubSpot

Mapeamento dos objetos do HubSpot para o nosso schema, na ordem em que devem ser importados (pais antes dos filhos):

```text
1. Owners (HubSpot users)         → team_members         [opcional, base p/ atribuição]
2. Companies                      → companies            [raiz - sem dependências]
3. Contacts                       → contacts             [depende de companies]
4. Deals                          → deals                [depende de companies + contacts]
   └─ deal ↔ contact              → deal_contacts        [associação]
5. Leads (lifecyclestage=lead)    → leads                [independente, mas usa company_name]
6. Engagements (notes/calls/      → activities           [depende de contacts/companies/deals]
   meetings/tasks/emails)
```

Regra: nunca importar um filho cujo pai ainda não foi resolvido. Quando o pai existir no HubSpot mas estiver fora do escopo selecionado, o filho é importado **sem** o vínculo (com warning no log) — nunca falha silenciosamente.

## 2. Tela de planejamento (`/integrations/hubspot`)

Substitui o card simples de hoje. Três etapas:

**Etapa A — Escopo**: checkboxes por objeto (Companies, Contacts, Deals, Leads, Activities, Owners), com contagem prévia (`count` da API HubSpot) ao lado de cada item. Selecionar um filho marca automaticamente os pais necessários (e mostra o porquê). Limite máximo configurável por objeto.

**Etapa B — Pré-visualização da árvore**: mostra a ordem de execução final como uma timeline vertical, com setas indicando dependências. Botão "Iniciar importação".

**Etapa C — Execução**: timeline em tempo real (ver §4).

## 3. Backend — Job orquestrador

Novo server fn `startHubspotImport` (em `src/lib/integrations/hubspot.functions.ts`):

- Cria 1 `enrichment_job` "pai" (`kind=import`, `provider=hubspot`, `scope` = JSON com seleção do usuário).
- Cria N `enrichment_job_items` — um por **etapa** da árvore (companies, contacts, deals, deal_contacts, leads, activities), em `status=pending`, com a posição na ordem armazenada em `before` (ex.: `{ step: 2, kind: "contacts", depends_on: ["companies"] }`).
- O handler executa as etapas **sequencialmente**. Para cada etapa:
  1. Marca o item como `running`, grava `started_at` em `after`.
  2. Pagina a API HubSpot (`limit=100`, `after` cursor), faz upsert na tabela destino.
  3. Mantém um `id_map` em memória (`hubspotId → localId`) para resolver FKs nas etapas filhas. Persiste o mapa em `enrichment_job_items.after` ao final da etapa para retomada.
  4. Atualiza counters (`processed/succeeded/failed`) no job pai a cada página.
  5. Em erro fatal de etapa: marca item `failed`, decide via política (default: "parar") se aborta o job ou continua etapas independentes.
- Etapas suportam **upsert por chave natural** (`hubspot_id` armazenado em coluna nova `external_ids jsonb` em cada tabela) para permitir re-execução idempotente.

### Migração necessária

- Adicionar coluna `external_ids jsonb default '{}'` em `companies`, `contacts`, `deals`, `leads`, `activities` (índice GIN).
- Adicionar coluna `step_logs jsonb default '[]'` em `enrichment_jobs` para guardar a timeline (cada entry: `{ ts, level, step, message, count? }`).

## 4. Timeline em tempo real

- Habilitar Realtime nas tabelas `enrichment_jobs` e `enrichment_job_items`:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_jobs, public.enrichment_job_items;
  ```
- Frontend assina mudanças do job pai e dos itens; renderiza:
  - Barra de progresso global (succeeded/total).
  - Lista vertical de etapas com ícone de status (pending/running/done/failed), counters (`123/500 contatos`), tempo decorrido.
  - Painel de log abaixo: stream das últimas N entries de `step_logs` (mensagens curtas: "Importando página 3/5 de Companies", "Resolvendo 87 vínculos contact↔company", "Empresa XYZ não encontrada — contato importado sem vínculo").
- O server fn faz `update` em `step_logs` via `array_append`-like (jsonb concat) a cada evento relevante; o realtime entrega ao cliente.

## 5. Substituir tela atual

- `leads.import-hubspot.tsx` vira um redirect/atalho para `/integrations/hubspot` (ou é removida — a importação fica exclusivamente em integrations).
- `integrations.$slug.tsx`: quando `slug=hubspot`, renderiza o novo wizard de import (etapas A/B/C).

## 6. Detalhes técnicos

- Endpoints HubSpot usados: `/crm/v3/objects/{companies,contacts,deals}` + `?associations=companies,contacts` para deals; `/crm/v3/objects/{notes,calls,meetings,tasks,emails}` para activities; `/crm/v3/owners` para owners.
- Rate limit: respeitar 100 req/10s do HubSpot — wrapper com fila simples + `await sleep(120ms)` entre páginas.
- Server fn executa em request único (serverless). Para volumes grandes (>2k registros), abortar com mensagem orientando dividir o escopo, ou — como follow-up — migrar para um worker chamado por cron (`/api/public/hubspot-import-tick`) que processa 1 etapa por invocação.
- Rollback: cada etapa registra os IDs criados em `enrichment_job_items.after.created_ids` para permitir um botão "Desfazer importação" futuramente (fora do escopo desta entrega).

## 7. Entregáveis

1. Migração: `external_ids` nas 5 tabelas + `step_logs` em `enrichment_jobs` + realtime nas 2 tabelas.
2. `src/lib/integrations/hubspot.functions.ts`: novos fns `previewHubspotCounts`, `startHubspotImport`, helpers de paginação/upsert/id-map.
3. `src/components/hubspot/import-wizard.tsx` (etapas A+B+C) e `src/components/hubspot/import-timeline.tsx` (realtime).
4. Integração em `integrations.$slug.tsx` (slug = hubspot).
5. Remover/redirecionar `leads.import-hubspot.tsx`.

## Fora de escopo

- Importação reversa (push para HubSpot).
- Sync contínuo / webhooks (apenas import on-demand).
- Mapeamento customizado de campos pelo usuário (usaremos mapeamento fixo; configurável depois).
- Botão "Desfazer importação" (estrutura preparada, UI fica para depois).
