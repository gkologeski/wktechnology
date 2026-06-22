## Situação atual

- O dialog de "motivo de perdido" **já lê da nossa base** (`deal_loss_reasons`), não do HubSpot em runtime.
- Porém a tabela está **vazia** (0 motivos cadastrados) — só popula quando alguém clica em "Sincronizar HubSpot".
- Temos **1.334 negócios perdidos**, sendo **167 sem motivo registrado** localmente. Todos os 167 têm `hs_object_id`, então conseguimos buscar o motivo direto no HubSpot.
- O `hs_raw` salvo no banco não trouxe `closed_lost_reason` para esses 167 — precisamos fazer uma leitura nova via API.

## O que vou fazer

### 1. Auto-sync inicial dos motivos
Estender `syncHubspotLossReasons` (já existe) e disparar automaticamente quando:
- A tabela `deal_loss_reasons` estiver vazia para o workspace (no `getDealLossReasons`, se vier `[]` e o HubSpot estiver conectado, executa o sync e relê).
- Adicionar também um botão na tela de configurações já existente (mantém comportamento manual).

### 2. Nova server function: `backfillLostDealReasons`
- Busca todos os deals com `stage='lost'` e `closed_lost_reason` vazio que tenham `hs_object_id`.
- Chama `POST /crm/v3/objects/deals/batch/read` no gateway HubSpot em lotes de 100, pedindo a propriedade `closed_lost_reason`.
- Atualiza `deals.closed_lost_reason` para cada um que retornar valor não-vazio.
- Retorna `{ checked, updated, skipped }` para feedback.

### 3. Disparar o backfill automaticamente
- Adicionar um botão "Sincronizar motivos de perdido com HubSpot" no `LostReasonDialog` (já existe) e/ou na tela de Configurações, que executa em sequência: `syncHubspotLossReasons` → `backfillLostDealReasons`.
- Mostrar toast com o resumo (`X motivos sincronizados, Y negócios atualizados`).

### 4. Executar agora, uma vez
Após implementar, rodar o sync + backfill imediatamente para popular os 167 negócios e a tabela de motivos no workspace ativo.

## Arquivos afetados

- `src/lib/deal-loss-reasons.functions.ts` — adicionar `backfillLostDealReasons` e auto-sync no `getDealLossReasons`.
- `src/components/deals/lost-reason-dialog.tsx` — botão único que dispara sync + backfill.
- (opcional) tela de Configurações de pipelines/deals: botão equivalente.

Sem mudança de schema — a tabela `deal_loss_reasons` já existe.
