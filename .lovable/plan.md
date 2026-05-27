## Objetivo

Em `Settings › Sync HubSpot`, novo card **"Verificar novidades no HubSpot"** que faz uma reconciliação completa entre HubSpot e sistema local para todos os objetos:

- **CRM**: `contacts`, `companies`, `deals`, `leads`
- **Atividades**: `notes`, `tasks`, `calls`, `meetings`, `emails`

Detecta três situações por tipo:

1. **Faltando** — existem no HubSpot, não existem localmente → importar.
2. **Desatualizados** — existem em ambos, mas `hs_lastmodifieddate` no HubSpot é mais novo que `updated_at` local → atualizar.
3. **Deletados** — existem localmente com `external_ids->>hubspot`, mas o HubSpot retorna 404 / não aparece mais → marcar como deletados localmente.

Reaproveita o motor `enrichment_jobs` + `hubspot-steps.server.ts` para os passos de import/update.

## Como vai funcionar para o usuário

1. Em `/settings/hubspot-sync`, novo card **"Verificar novidades no HubSpot"**.
2. Usuário clica em **Verificar agora**. Para cada tipo, exibe:
   ```text
   Grupo        Tipo        HubSpot   Local   Faltando   Desatual.   Deletados   Ações
   CRM          contacts    10.000    9.870     130          45           12      [Aplicar mudanças]
   CRM          companies    2.500    2.500       0           0            3      [Aplicar mudanças]
   CRM          deals        1.200    1.180      20           8            0      [Aplicar mudanças]
   CRM          leads          800      790      10           5            0      [Aplicar mudanças]
   Atividades   notes       10.000    9.500     500          120          37      [Aplicar mudanças]
   …
   ```
3. Por linha, ao clicar **Aplicar mudanças**, o sistema:
   - Importa os faltantes (insert).
   - Atualiza os desatualizados (upsert por `hsId`).
   - Trata as deleções conforme a estratégia escolhida (ver abaixo).
4. Botão geral **Aplicar todas as mudanças**.

### Estratégia de deleção (decisão do usuário, default seguro)

Toggle no card: **"Como tratar deleções no HubSpot?"**
- **Soft delete** (default): adiciona coluna `deleted_at` quando ausente; marca `deleted_at = now()`. UI filtra por `deleted_at IS NULL` por padrão. Reversível.
- **Hard delete**: `DELETE` físico. Irreversível. Exige confirmação textual ("excluir") no diálogo.

Em ambos os casos, antes de aplicar, mostra um **diálogo de confirmação** com a lista (ou amostra) de registros que serão deletados.

## Escopo / limites

- **Janela de verificação**: campo numérico **Verificar últimos N** (default 10.000, max 50.000) por tipo, ordenado por `hs_lastmodifieddate desc`. Cobre o caso "mudanças recentes". Reconciliação histórica total continua sendo via wizard.
- **Detecção de deleções** roda em duas fases:
  - Fase A (cheap): para os IDs locais que **caíram dentro da janela do HubSpot mas não apareceram lá**, são candidatos a deletados — confirmado fazendo `GET /crm/v3/objects/{obj}/{id}` em batch; 404 = deletado.
  - Fase B (opcional, toggle "Verificação profunda de deleções"): para cada ID local que tem `external_ids->>hubspot`, faz `batchRead` no HubSpot e marca como deletado o que vier 404. Mais lento, cobre 100% dos registros locais — não só os "recentes".
- **Push para HubSpot**: continua fora deste card (já existe "Sincronizar agora" para contatos).
- **Mapeamento de campos**: usa o mesmo `mapActivity`/mappers que o importer já usa (`hubspot-steps.server.ts`), garantindo paridade.

## Detalhes técnicos

### Server functions novas em `src/lib/hubspot-sync.functions.ts`

#### `checkHubspotReconciliation`
- Input: `{ types?: HsType[]; perTypeLimit?: number; deepDeletionCheck?: boolean }`.
- Por tipo, em paralelo:
  - **Lista HubSpot recente**: pagina `POST /crm/v3/objects/{obj}/search` com `sorts: [hs_lastmodifieddate DESC]`, `properties: ["hs_lastmodifieddate"]` (precisamos do timestamp). Acumula até `perTypeLimit`. Para `leads`: filtro `lifecyclestage = lead`.
  - **Lista local**: `select id, external_ids->>hubspot as hs_id, updated_at from <table> where owner_id = $userId and external_ids->>hubspot is not null`. (Para `leads`: aplica regra do importer.) (Para `activities`: filtra por `type`.)
  - Calcula:
    - `missing = hubspotIds - localHsIds` (limitado à janela).
    - `outdated = { hsId | hubspot[hsId].lastModified > local[hsId].updated_at }`.
    - `deletedCandidates = localHsIds - hubspotIds` (apenas IDs cujo `updated_at` está dentro da janela coberta pelo `perTypeLimit` mais recente — evita falsos positivos para itens antigos).
  - **Confirmação de deletion** (Fase A): `batchRead` dos `deletedCandidates` no HubSpot; os que vierem como `archived: true` ou ausentes da resposta vão para `deletedConfirmed`.
  - Se `deepDeletionCheck = true`: ignora janela e confirma deletion para **todos** os locais sem hit em HubSpot (mais lento — paginação adicional via `batchRead`).
- Retorna por tipo: `{ checked, present, missing, outdated, deleted, missingIdsSample, outdatedIdsSample, deletedIdsSample }`.

#### `applyHubspotReconciliation`
- Input: `{ types: HsType[]; perTypeLimit?: number; deepDeletionCheck?: boolean; deletionStrategy: "soft" | "hard" }`.
- Recalcula `missing/outdated/deleted` (fonte da verdade = HubSpot no clique).
- Cria um `enrichment_job` com `scope` derivado dos `types` e `mode: "delta"`.
- Para cada `enrichment_job_items` correspondente, injeta `before.target_ids = [...missingIds, ...outdatedIds]` e `before.discovery_complete = true`. O step já é idempotente — `upsertByHsId` cuida do insert vs update (mesma rotina).
- Após o job terminar, processa deleções (em série, fora do motor):
  - `soft`: `update <table> set deleted_at = now() where owner_id = $userId and external_ids->>hubspot in (...)` em batches de 500.
  - `hard`: `delete from <table> where ...` em batches de 500. Loga em `audit_logs`.
- Retorna `{ jobId, deletionsScheduled: number }`. UI acompanha pelo job + toast de deleções aplicadas.

### Adaptações em `hubspot-steps.server.ts`

- Nos steps `companies`/`contacts`/`deals`/`leads`, verificar `resume.target_ids` antes do `searchPage` (atalho que já existe para atividades, linhas 1584-1611). Quando presente + `discovery_complete`, pula o search e vai direto para `batchRead` em chunks. Sem mudar comportamento dos jobs do wizard (que entram sem `target_ids`).

### Migração de schema

Para suportar **soft delete**, adicionar coluna `deleted_at timestamptz null` nas tabelas que ainda não têm:
- `contacts`, `companies`, `deals`, `activities` (verificar quais já têm).
- Index parcial `where deleted_at is null` para manter queries rápidas.
- Atualizar as queries de listagem dessas tabelas para filtrar `deleted_at is null` por padrão (regra do app, não RLS). Adicionar toggle "Mostrar excluídos" nas listagens — fora do escopo deste card mas necessário para visibilidade dos soft deletes.

> Se preferir não tocar nas listagens neste momento, podemos deixar a estratégia default = `hard` e o `soft` como opção avançada. Me avisa.

### UI

`src/routes/_authenticated/settings.hubspot-sync.tsx`, novo card com:
- Campo numérico **Verificar últimos** (default 10.000, max 50.000).
- Toggle **Verificação profunda de deleções** (off por default).
- Select **Estratégia de deleção**: Soft (default) / Hard.
- Botão **Verificar agora** (spinner).
- Tabela com 9 linhas (4 CRM + 5 atividades), agrupadas, com colunas: HubSpot · Local · Faltando · Desatual. · Deletados · botão **Aplicar mudanças**.
- Botão geral **Aplicar todas as mudanças**.
- Diálogo de confirmação antes de qualquer deleção, mostrando amostra de IDs/títulos. Hard delete exige digitar "excluir".
- Toast pós-aplicação + link "Acompanhar importação" para a página do job.

### Sem secrets novos
- Continua `LOVABLE_API_KEY` + `HUBSPOT_API_KEY`.

## Riscos / atenção

- **Falsos positivos de deleção** se a janela for pequena: mitigado restringindo `deletedCandidates` aos IDs locais cujo `updated_at` está na janela coberta pelo HubSpot. Verificação profunda dá certeza total mas é mais cara.
- **Custos de API HubSpot**: deep check faz `batchRead` em todos os locais — em bases grandes, dezenas de milhares de chamadas. Mostrar aviso na UI ao habilitar.
- **Soft delete exige adaptação nas listagens** para não vazar registros excluídos.

## Fora do escopo

- Reconciliação histórica completa acima do `perTypeLimit` (sem deep check) — usar wizard.
- Push de novidades/edições locais para HubSpot (já tem botão dedicado).
- Restaurar registros soft-deletados (UI separada).
