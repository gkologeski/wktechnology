# Importação espelhando estrutura do HubSpot

## Objetivo
Em vez de jogar todos os registros importados em valores genéricos (ex: deals no estágio "new" de um pipeline padrão), replicar fielmente a estrutura do HubSpot no sistema: pipelines, estágios, tipos de atividade, owners e — quando aplicável — propriedades customizadas. Se a estrutura não existir localmente, criar antes de importar os registros.

## Escopo por objeto

### 1. Pipelines e estágios (Deals)
- Antes de importar deals, chamar `GET /crm/v3/pipelines/deals` no HubSpot.
- Para cada pipeline retornado:
  - Procurar em `pipelines` (entity='deal') por um registro com `external_ids->>'hubspot' = <pipelineId>`.
  - Se não existir, criar com `name`, `stages` (array com `{id, label, displayOrder, probability, hubspot_id}`), `is_default` conforme HubSpot.
  - Se existir, atualizar `stages` para refletir mudanças.
- Manter um mapa `hubspotPipelineId → localPipelineId` e `hubspotStageId → {pipelineId, stageId}` no estado da importação.
- Ao importar cada deal:
  - Resolver `pipeline_id` via mapa.
  - Resolver `stage` (campo enum atual `deal_stage`) — **ver "Mudança de schema" abaixo**.

### 2. Pipelines de Leads
- HubSpot tem pipelines de "tickets" e estágios de lead status. Replicar o mesmo padrão para `pipelines` (entity='lead') usando os lifecycle stages / lead status do HubSpot.

### 3. Tipos de atividade
- `activity_type` hoje é enum fixo (`note|call|email|meeting|task`). HubSpot já bate com isso, manter sem mudança estrutural.
- Outcomes de call (`hs_call_disposition`) — preservar como texto em `outcome`, sem normalizar.

### 4. Owners (responsáveis)
- HubSpot tem `hubspot_owner_id` em quase todo objeto. Hoje gravamos tudo com `owner_id = usuário que disparou a importação`.
- **Decisão:** manter `owner_id` = dono do workspace (RLS depende disso). Salvar o owner original do HubSpot em `external_ids.hubspot_owner_id` para referência futura.

### 5. Propriedades customizadas
- **Fora do escopo desta entrega.** Estrutura de custom fields exigiria nova tabela (`custom_properties`) e UI nova. Vou apenas guardar o JSON bruto das propriedades customizadas em `external_ids.raw_properties` para não perder dado, e abrir como tarefa separada se você quiser.

## Mudança de schema necessária

O campo `deals.stage` hoje é um enum (`deal_stage`) com valores fixos. Isso impede armazenar estágios arbitrários do HubSpot. Proposta:

- Adicionar coluna `stage_id text` em `deals` (id do estágio dentro do `stages` jsonb do pipeline).
- Manter `stage` enum por compatibilidade, mapeando o estágio HubSpot mais próximo (`new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`) por heurística sobre `label` / `probability`.
- Mesma lógica para `leads.status` (manter enum + adicionar `stage_id`).

## Fluxo da importação atualizado

```text
[Descobrir pipelines] → [Criar/atualizar pipelines locais]
        ↓
[Companies] → [Contacts] → [Deals (usa pipelineMap+stageMap)] → [Leads] → [Activities]
```

A descoberta de pipelines vira uma nova etapa **antes** de Companies no `STEP_DEPS` em `hubspot-steps.server.ts`, chamada `pipelines`.

## Arquivos afetados

- `src/lib/integrations/hubspot-steps.server.ts` — adicionar step `pipelines`, função `syncPipelines()`, expor `pipelineMap`/`stageMap` no estado, ajustar `runStepDeals` e `runStepLeads`.
- `src/lib/integrations/hubspot.functions.ts` — incluir `pipelines` em `STEPS` e na contagem inicial (total = nº de pipelines descobertos).
- `src/components/hubspot/live-counter.tsx` / `import-timeline.tsx` — adicionar card "Pipelines" no grid.
- Migração: `ALTER TABLE deals ADD COLUMN stage_id text; ALTER TABLE leads ADD COLUMN stage_id text;` (+ índices).

## Confirmação necessária

1. OK criar a migração adicionando `stage_id` em `deals` e `leads`?
2. OK manter custom properties como JSON bruto por enquanto (sem UI), ou prefere que eu já modele uma tabela `custom_properties`?
3. OK manter `owner_id` local = dono do workspace e guardar `hubspot_owner_id` como referência?
