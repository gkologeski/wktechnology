## Contexto

O negócio `a3f7fed6-7677-45e2-bea2-21248e83d71a` tem `pipeline_id = NULL` e `stage_id = "1017586011"` (id herdado do HubSpot). Como não está vinculado a nenhum pipeline atual, o drawer não consegue resolver os estágios e o usuário fica sem edição.

No arquivo `src/components/deals/deal-detail-drawer.tsx` (linha 274), o seletor de **Funil** só é renderizado quando `isNew`. Para negócios existentes, o pipeline aparece só implicitamente pelo prop `pipeline` recebido da tela pai.

## Escopo

Alterar apenas a UI/edição do drawer de negócios. Sem mudanças em schema, RLS, workflows, cotações ou timeline.

### Mudanças

1. **`src/components/deals/deal-detail-drawer.tsx`**
   - Renderizar o seletor "Funil" também quando o negócio já existe (`!isNew`), acima do seletor "Estágio", usando o mesmo padrão do fluxo de criação.
   - Ao trocar de pipeline, resetar `stage_id`/`stage` para o primeiro estágio do pipeline escolhido (mesma lógica já existente no branch `isNew`).
   - Ajustar `activePipeline` para derivar de `v.pipeline_id` também no fluxo de edição, e não somente de `pipeline` recebido por prop, para que a mudança fique refletida em tela antes do save.
   - No `persist`, continuar salvando `pipeline_id: activePipeline?.id ?? null` (já faz isso — apenas confirmar).
   - Quando o pipeline atual do negócio for `null` ou não estiver na lista carregada (caso do a3f7fed6), pré-selecionar automaticamente o primeiro pipeline disponível no `useEffect` inicial, sinalizando via placeholder "Selecione um funil" no `SelectTrigger`, sem salvar automaticamente — o usuário precisa confirmar clicando em "Salvar".

2. **Sem migração de dados em massa.** O usuário poderá corrigir o deal problemático abrindo o drawer, escolhendo o funil "Serviços" (ou o desejado), o estágio adequado e salvando.

## Detalhes técnicos

- `activePipeline` passa a ser: `pipelines.find(p => p.id === v.pipeline_id) ?? pipeline ?? null`.
- O `Select` do funil compartilha o mesmo `onValueChange` do branch `isNew`; extrair para uma função local `changePipeline(val)` para evitar duplicação.
- Preservar o comportamento de `stage_id` legado (`stageKey` no `persist`) para deals HubSpot.

## Validação manual

1. Abrir o negócio `a3f7fed6-...` em `/deals`.
2. Selecionar o funil "Serviços" (ou outro), escolher um estágio e salvar.
3. Confirmar que o deal aparece no board/kanban do funil escolhido.
4. Repetir com um deal já vinculado a um pipeline para garantir que trocar de funil re-mapeia o estágio para o primeiro do novo funil e não quebra a listagem.

## Fora de escopo

- Backfill automático dos negócios sem `pipeline_id`.
- Mudanças na criação rápida (`QuickCreateDealDialog`) — já foi ajustada em turno anterior.
- Alterações no kanban/lista.
