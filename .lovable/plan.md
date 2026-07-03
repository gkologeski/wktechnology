# Condições dinâmicas no gatilho do Workflow

## Problema
No painel de gatilho do Workflow Builder, o dropdown de "Condições" mostra apenas uma lista curta e hardcoded (`ENTITY_FIELDS` em `src/lib/workflows/types.ts`) e não cobre todas as propriedades da entidade — incluindo campos customizados, colunas de ATS e tickets. Também não fica claro que as condições são opcionais.

## Solução

### 1. Estender `getEntityFieldCatalog` para todas as entidades de workflow
`src/lib/entity-fields.functions.ts` hoje aceita só `leads | contacts | companies | deals`. Ampliar o enum para incluir `tickets`, `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`. A RPC `get_entity_field_catalog(p_table, p_owner_id)` já lê `information_schema` da tabela informada — basta permitir mais nomes.

Verificar (via `supabase--read_query`) se a função SQL filtra por `owner_id` de forma compatível com todas essas tabelas; se alguma não tiver `owner_id`, adaptar a chamada para não filtrar (a listagem de colunas independe do dono; só os `distinct_values` seriam impactados).

Manter os overrides existentes (stage/pipeline). Adicionar override análogo para `stage_value` das entidades ATS (buscar em `pipelines` com `entity = 'ats_job'` ou similar, seguindo o padrão atual).

### 2. Consumir o catálogo no Workflow Builder
`src/components/workflows/workflow-builder.tsx`:
- Ao abrir o painel do gatilho (ou ao trocar a entidade), chamar `getEntityFieldCatalog({ entity })` via `useServerFn` e cachear localmente por entidade.
- Substituir o uso de `ENTITY_FIELDS[state.entity]` pelas `fields` retornadas (nome + label amigável + tipo).
- No dropdown de campo da condição, mostrar o label amigável em vez do snake_case; agrupar visualmente por tipo (select, data, texto) mantendo a ordenação já retornada pelo backend.
- Quando `field.options` estiver preenchido, renderizar `Select` de valores; quando `type = 'date'`, usar input `date`; `boolean` vira Sim/Não; caso contrário, input de texto (comportamento já parcialmente presente para filtros do FilterBuilder).
- Fazer o mesmo dentro de `branch_if` (usa o mesmo componente de filtros).

### 3. Reforçar que "Condições" é opcional
- Ao lado do título "Condições", exibir badge/label "opcional".
- Texto de apoio: "Sem condições, todos os registros que dispararem o evento entram no workflow."
- Nenhuma mudança na validação Zod (`filters` já é `.default([])` em `src/lib/workflows.functions.ts`) — apenas garantir que o botão "Salvar" não bloqueie por ausência de condição.

### 4. Manter `ENTITY_FIELDS` como fallback
Deixar a constante como fallback caso a chamada ao catálogo falhe (ex.: sem rede), mas priorizar sempre o catálogo dinâmico.

## Arquivos alterados
- `src/lib/entity-fields.functions.ts` — ampliar enum + override de stage ATS.
- `src/components/workflows/workflow-builder.tsx` — carregar catálogo, renderizar campos e valores, marcar Condições como opcional.

## Fora do escopo
- Editar a RPC SQL `get_entity_field_catalog` (só usar caso o teste mostre incompatibilidade).
- Mudanças no motor de execução (`engine.server.ts`) — a avaliação de filtros já é genérica por nome de coluna.
- Custom properties (`custom_fields` JSONB) — segue oculto como hoje; pode ser feito em iteração futura.

## Validação
1. Abrir `/settings/workflows` → Novo workflow → escolher `Vagas (ATS)`.
2. No painel do gatilho, verificar que o dropdown de condição lista todas as colunas de `ats_jobs` (não só as ~10 hardcoded).
3. Salvar sem condições e confirmar que o workflow é criado.
4. Repetir para `deals` conferindo que `stage` continua com opções vindas do pipeline.
