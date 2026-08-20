# Escolher qualquer coluna nos grids das entidades

Hoje o editor de colunas de `/leads` (e dos demais grids) só oferece as colunas declaradas manualmente na tela, mais os campos personalizados. Objetivo: o editor passar a listar **todos os campos da tabela da entidade**, e o grid renderizar qualquer um deles.

## O que muda para o usuário

- Em "Colunas", além das colunas atuais e dos campos personalizados, aparece um grupo "Outros campos" com todos os campos da tabela (rótulos em pt-BR, busca por nome já existente no modal).
- Ao marcar um campo novo, ele aparece no grid com formatação adequada: data/hora, valor monetário (BRL), número, sim/não, listas, e nomes em vez de IDs para campos de referência (usuário, empresa, contato, pipeline, negócio, contrato, empresa/CNPJ).
- Campos internos de sistema (JSONB pesado, tokens, IDs de sincronização) continuam ocultos.
- A preferência continua salva por usuário e por grid; "Restaurar padrão" volta ao conjunto atual.
- Vale para todos os grids que usam o editor de colunas: Leads, Contatos, Empresas, Tarefas, Serviços, Negócios (tabela HubSpot) e as listas genéricas de entidade.

## Abordagem técnica

1. **Catálogo de campos**: reutilizar `getEntityFieldCatalog` (`src/lib/entity-fields.functions.ts`, RPC `get_entity_field_catalog`), que já retorna nome, rótulo pt-BR, tipo inferido, opções e `ref` (FK), e já esconde colunas de sistema/sync. Sem nova migration.
2. **`useGridColumns`** (`src/hooks/use-grid-columns.tsx`): nova opção `catalogTable` (nome da tabela). Quando presente, busca o catálogo (cache 5 min) e gera colunas automáticas para todo campo que **não** exista nas colunas declaradas, no grupo "Outros campos", com renderizadores genéricos por tipo em um novo módulo `src/lib/grid/auto-column-render.tsx`:
   - `date`/timestamp → data pt-BR (`formatDate`/`timeAgo` conforme já usado);
   - `currency` → máscara BRL existente (`money-fields`);
   - `boolean` → "Sim"/"Não"; `number` → número; arrays → lista separada por vírgula; JSON → texto truncado;
   - `select` → rótulo traduzido via `translateFieldValue` quando houver;
   - `ref` → nome resolvido pelo hook existente `use-reference-labels.ts` (usuário/empresa/contato/pipeline/negócio/contrato/empresa CNPJ), com fallback para "—".
   - vazio → "—" (padrão do design system).
3. **Projeção da query**: `useGridColumns` passa a expor `selectKeys` (colunas visíveis que precisam vir do banco). Cada grid concatena essas chaves ao seu `select` atual em vez de manter uma string fixa — assim os campos novos chegam sem trazer JSONB pesado. Em `EntityList`, o mesmo se soma ao `selectColumns` já calculado.
4. **`EntityList`** (`src/components/entity-list.tsx`): hoje monta `allColumns` só a partir do prop `columns` e o `ColumnEditorDialog` sem grupos/defaults do catálogo. Passa a usar o mesmo gerador de colunas automáticas, mantendo `columnOrder` das views salvas intacto.
5. **Ordenação**: colunas automáticas de tipos ordenáveis (texto, número, data, boolean) ficam clicáveis nos grids que já suportam ordenação server-side; JSON/array permanecem sem ordenação.
6. **Segurança**: nada de acesso novo a dados — a leitura continua pelo mesmo client/RLS por `workspace_id`; o catálogo já roda com `requireSupabaseAuth`. Sem alteração de RLS, schema ou regra de negócio.

## Fases

- Fase 1: `auto-column-render.tsx` + `useGridColumns` com `catalogTable` e `selectKeys`; aplicar em `/leads` e validar.
- Fase 2: Contatos, Empresas, Tarefas, Serviços e tabela de Negócios.
- Fase 3: `EntityList` (listas genéricas) com o mesmo catálogo.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test` após cada fase.
- Manual por grid: abrir "Colunas", buscar um campo não listado hoje, marcar, confirmar valor correto no grid (data, moeda, booleano, referência), recarregar para checar persistência, "Restaurar padrão", paginação, CSV e dark mode.
