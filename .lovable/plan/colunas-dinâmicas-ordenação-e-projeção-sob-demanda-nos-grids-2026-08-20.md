# Colunas dinâmicas, ordenação e projeção sob demanda nos grids

Objetivo: qualquer coluna da entidade pode ser escolhida, ordenada e persistida por usuário — e a consulta busca apenas as colunas realmente exibidas.

## O que muda para o usuário

1. Grids do TechHire (Candidatos, Vagas, Candidaturas da vaga, Ofertas, Entrevistas) passam a ter o botão "Colunas" com o grupo "Outros campos", igual a Leads/Contatos/Empresas/Negócios.
2. Colunas do grupo "Outros campos" ficam clicáveis no cabeçalho para ordenar (asc/desc), com ordenação feita no banco.
3. As colunas escolhidas e a ordenação (coluna + direção) são salvas por usuário e por grid, e reaplicadas automaticamente ao abrir a tela.
4. Os grids param de carregar a tabela inteira: buscam só as colunas visíveis, deixando as listas mais leves e rápidas.

## Escopo técnico

### 1. Projeção dinâmica (fim do `select("*")`)

- Novo helper `src/lib/grid/dynamic-select.ts`: recebe as chaves base obrigatórias (id, chaves usadas por ações/seleção/kanban) + `selectKeys` do `useGridColumns` e devolve a string de projeção, deduplicada e tipada como `string` (padrão `sel()` do projeto, para não estourar o typecheck).
- `useGridColumns` passa a expor também `sortableKeys` e `fieldByKey` (já disponível em `useAutoGridColumns`, hoje descartado).
- Telas com query direta no Supabase (Leads, Contatos, Empresas, Tarefas, Negócios) trocam `select("*")` por `select(buildGridSelect(BASE_KEYS, selectKeys))`, com `selectKeys` na `queryKey` para refazer a busca quando o usuário muda colunas.
- Campos `custom_fields` e `metadata` entram na projeção só quando há coluna personalizada visível.

### 2. Ordenação das colunas dinâmicas

- Novo `src/lib/grid/sort-guard.ts`: valida a chave de ordenação contra (colunas declaradas) ∪ (catálogo da entidade), com fallback para o padrão do grid. Isso evita `order()` com coluna arbitrária vinda da preferência salva.
- Colunas automáticas recebem `header` com o mesmo componente `Th sortable` já usado em Leads; tipos numéricos/data/texto ordenam nativamente no Postgres. Colunas `jsonb`, arrays e colunas `custom:*` continuam sem ordenação (cabeçalho estático).
- RLS não muda: a ordenação acontece na mesma query já filtrada por RLS/RBAC.

### 3. Preferências por usuário

- Migration em `user_grid_preferences`: colunas `sort_key text` e `sort_dir text` (check `asc|desc`), sem alterar policies existentes (a tabela já é escopada por `user_id`).
- `grid-preferences.functions.ts`: `getGridPreference` devolve `{ visibleColumns, sortKey, sortDir }`; `saveGridPreference` aceita ordenação opcional (persistida com debounce ao clicar no cabeçalho); `resetGridPreference` limpa tudo.
- `useGridColumns` devolve `sort`/`setSort` já hidratados da preferência, aplicados após o carregamento (sem piscar o padrão duas vezes).

### 4. Grids do TechHire

- `listAtsJobs`, `listAtsCandidates`, a listagem de candidaturas de `jobs.$id`, ofertas e entrevistas ganham input opcional `extraColumns: string[]` + `sortKey`/`sortDir`, todos validados no servidor contra o catálogo real da tabela (`get_entity_field_catalog`) antes de entrar no `select`/`order` — nenhuma string do cliente vai crua para a query.
- Telas correspondentes passam a usar `useGridColumns` com `gridKey` próprio (`ats-jobs`, `ats-candidates`, `ats-job-applications`, `ats-offers`, `ats-interviews`) e `catalogEntity` (`ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`; ofertas usam o catálogo de `ats_offers`, incluído na lista de entidades permitidas).
- Colunas atuais e ações (seleção em massa, `AssigneeCell`, `AssigneeFilter`, badges, kanban) são preservadas como colunas declaradas — nada é removido.
- Modo kanban/cards de cada tela continua igual; a seleção de colunas afeta só o modo tabela.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run build:dev`, `bun run test`.
- Playwright autenticado: em `/leads` e em Candidatos/Vagas — escolher uma coluna de "Outros campos", ordenar por ela, recarregar a página e confirmar que coluna e ordenação voltam; verificar no Network que a projeção não é mais `*`.

## Riscos

- Preferências antigas apontando para colunas removidas: já são filtradas pelas chaves existentes; ordenação inválida cai no padrão.
- Chaves base faltando na projeção quebrariam ações de linha — por isso cada tela declara explicitamente seu `BASE_KEYS` e a validação inclui abrir os detalhes a partir do grid.
