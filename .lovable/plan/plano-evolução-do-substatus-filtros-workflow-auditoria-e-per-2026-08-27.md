# Plano: evolução do Substatus (filtros, workflow, auditoria e performance)

## Objetivo
Expandir a funcionalidade de Substatus vinculada a Pipeline → Etapa para:
1. filtrar leads e negócios por substatus nas listas e no Kanban;
2. usar substatus como condição e ação no motor de automações;
3. exibir histórico de alterações de substatus nos detalhes de Lead e Negócio;
4. otimizar a reordenação de substatus na configuração de pipelines.

A implementação será incremental, reaproveitando a tabela `pipeline_stage_substatuses` e as colunas `stage_substatus_id` já existentes em `leads` e `deals`.

---

## Fase 1 — Filtros por Substatus

### Leads (grid)
- Adicionar `substatusIds: string[]` ao tipo `Filters` em `src/lib/leads/constants.ts`.
- Incluir `stage_substatus_id` em `BASE_LEAD_KEYS` para que a projeção do grid a carregue.
- Aplicar filtro em `applyFilters` de `src/routes/_authenticated/leads.tsx` (`q.in("stage_substatus_id", ...)` quando houver seleção).
- Adicionar seção "Substatus" em `src/components/leads/leads-filters-sidebar.tsx`, carregando os substatus do pipeline ativo e permitindo seleção múltipla.
- Atualizar `hasActiveFilters` para considerar `substatusIds`.

### Negócios (grid)
- Adicionar `substatusIds: string[]` ao tipo `DealFilters` em `src/components/deals/deals-toolbar.tsx`.
- Aplicar filtro na query de `src/routes/_authenticated/deals.tsx`.
- Adicionar controle de substatus no `DealsToolbar` (multi-select ou checkboxes).

### Kanban de Negócios
- Adicionar filtro por substatus na toolbar do Kanban (`DealsBoard`).
- Filtrar os cards de cada coluna de acordo com os substatus selecionados, mantendo a contagem da coluna refletindo os cards visíveis.

---

## Fase 2 — Workflow: condição e ação

### Condição
- Incluir `stage_substatus_id` como campo selecionável nas condições do workflow.
- Em `src/lib/workflows/types.ts` já existe `WorkflowFilter.field`; basta expor o campo no catálogo de opções.
- Em `src/components/workflows/builder/use-entity-field-options.ts` (ou equivalente), adicionar `stage_substatus_id` com label "Substatus" para as entidades `leads` e `deals`.
- Garantir que o operador `changed_to` funcione: o motor já compara `before`/`after`, então a condição detectará mudanças de substatus automaticamente.

### Ação
- Adicionar novo tipo de ação `set_substatus` em `WorkflowAction`:
  ```ts
  { type: "set_substatus"; substatus_id: string }
  ```
- Implementar execução em `src/lib/workflows/engine.server.ts`:
  - validar que o substatus existe e pertence à etapa atual do registro;
  - atualizar `stage_substatus_id` na tabela do gatilho (`leads` ou `deals`);
  - registrar log de execução.
- Adicionar ação no painel de ações do builder (`src/components/workflows/builder/action-library-panel.tsx`) e no `defaultActionOfType`.
- Criar formulário de configuração no `StepConfigPanel` para escolher o substatus (carregar opções por pipeline/etapa do contexto quando possível; fallback por ID com validação no motor).

---

## Fase 3 — Auditoria de Substatus nos detalhes

- O banco já registra alterações de `stage_substatus_id` em `property_history` via trigger `log_property_changes`.
- Criar componente `SubstatusHistoryCard` reutilizável em `src/components/pipelines/substatus-history-card.tsx`.
- O componente deve:
  - buscar entradas de `property_history` onde `property = 'stage_substatus_id'`;
  - resolver nomes de substatus a partir dos IDs (usando `fetchPipelineSubstatuses`);
  - resolver nome do usuário que alterou (`changed_by` → `profiles`);
  - exibir: substatus anterior → novo, usuário, data/hora.
- Incluir o card nas páginas `src/routes/_authenticated/leads.$id.tsx` e `src/routes/_authenticated/deals.$id.tsx`.
- Melhorar `PropertyHistoryDrawer` para exibir `changed_by` como nome de usuário (não UUID) e traduzir `stage_substatus_id` para "Substatus".

---

## Fase 4 — Otimização da reordenação

- O método `reorderSubstatuses` em `src/lib/pipelines/substatuses.ts` faz uma chamada de update por item, o que é lento para muitas opções.
- Substituir por uma única chamada RPC ou bulk update:
  - Opção A: criar função SQL `reorder_substatuses(ids uuid[])` que atualiza `position` em lote com `unnest`.
  - Opção B: usar `supabase.rpc` com array de IDs e posições.
- Escolha recomendada: RPC SQL `reorder_substatuses` (mais rápida e atômica).
- Migration necessária para criar a função e ajustar permissões (`GRANT EXECUTE` para `authenticated`).
- Atualizar `StageSubstatusesEditor` para chamar a nova função e exibir estado de carregamento durante a operação.

---

## Fase 5 — Validações e ajustes finais

- Garantir que, ao trocar de pipeline/etapa, os filtros de substatus sejam limpos se os substatus selecionados não existirem na nova etapa.
- Verificar que a ação `set_substatus` no workflow respeita a validação do banco (substatus deve pertencer à etapa atual; se não, logar erro e continuar).
- Adicionar testes unitários para:
  - filtro de substatus no grid de leads;
  - execução da ação `set_substatus` no motor de workflow;
  - função SQL de reordenação em lote.
- Rodar `bun run typecheck`, `bun run lint` e `bun run test`.

---

## Arquivos previstos

### Criados
- `src/components/pipelines/substatus-history-card.tsx`
- `src/components/pipelines/substatus-filter.tsx` (controle reutilizável de filtro)
- Migration para `reorder_substatuses(uuid[])`

### Alterados
- `src/lib/leads/constants.ts`
- `src/routes/_authenticated/leads.tsx`
- `src/components/leads/leads-filters-sidebar.tsx`
- `src/components/deals/deals-toolbar.tsx`
- `src/routes/_authenticated/deals.tsx`
- `src/components/deals/deals-board.tsx`
- `src/lib/workflows/types.ts`
- `src/lib/workflows/engine.server.ts`
- `src/components/workflows/builder/use-entity-field-options.ts`
- `src/components/workflows/builder/action-library-panel.tsx`
- `src/components/workflows/builder/step-config-panel.tsx`
- `src/components/workflows/builder/step-tree.ts` (`defaultActionOfType`)
- `src/routes/_authenticated/leads.$id.tsx`
- `src/routes/_authenticated/deals.$id.tsx`
- `src/components/property-history-drawer.tsx`
- `src/lib/pipelines/substatuses.ts`
- `src/components/pipelines/stage-substatuses-editor.tsx`

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Filtro de substatus ficar vazio quando o pipeline ainda não foi carregado | Só renderizar o controle quando `pipelineId` estiver disponível |
| Ação `set_substatus` falhar silenciosamente | Validar substatus no motor e retornar log de erro detalhado |
| Reordenação em lote falhar por RLS | Função SQL roda como `SECURITY DEFINER` com `search_path = public` |
| Mudanças de workflow quebrarem workflows existentes | Adicionar tipo novo sem alterar tipos antigos; manter compatibilidade |

---

## Próximo passo após aprovação

Iniciar a Fase 1 implementando os filtros de substatus no grid de Leads e Negócios.