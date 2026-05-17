# Acelerar entrada em /companies (e demais listas)

## Diagnóstico

`src/components/entity-list.tsx` faz hoje:

```ts
let q = supabase.from(table).select("*");      // todas as colunas, incluindo hs_raw
q = applyFilters(q, view.filters);
q = q.order(view.sortBy, ...);
const { data } = await q;                      // sem range, sem count
```

- Sem `count` separado — o "total" exibido é `rows.length` (cap de 1000 do Supabase).
- Sem paginação — busca tudo de uma vez.
- `select("*")` puxa colunas pesadas (`hs_raw`, `description`, etc.) que a tabela nem renderiza.
- Busca/filtro de texto é feito 100% no cliente sobre o array carregado.

Em `companies` com 32k linhas + JSONB, isso domina o TTI da tela.

## Plano

### 1. Paginação server-side no `EntityList`

- Adicionar estado `page` (default 0) e constante `PAGE_SIZE = 50`.
- Alterar a query para:
  ```ts
  supabase
    .from(table)
    .select(selectColumns, { count: "estimated", head: false })
    .order(...)
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  ```
- Usar `count: "estimated"` (rápido, vem do planner do Postgres) em vez de `exact` — para 30k+ registros `exact` é caro. Mostrar o total como "~32.000".
- Trocar o footer/contagem para usar `count` retornado, não `rows.length`.
- Adicionar controles "Anterior / Próximo" e indicador "Página X de Y".

### 2. Selecionar só as colunas necessárias

- Computar `selectColumns` a partir de `columns` + campos essenciais (`id`, `owner_id`, `created_at`, e quaisquer chaves usadas em `searchKeys`, `rowActions`).
- Nunca trazer `hs_raw` na listagem.

### 3. Busca server-side

- Quando `search` tiver texto, aplicar `.or()` com `ilike` nas `searchKeys` em vez de filtrar no cliente — caso contrário a busca só encontra dentro da página atual.
- Debounce de 300ms no input para evitar requests a cada tecla.
- A `queryKey` passa a incluir `page` e `search`.

### 4. Ajustes secundários

- Manter a seleção (`selectedIds`) por id ao trocar de página (já é `Set<string>`, só não resetar).
- "Selecionar todos" passa a significar "selecionar todos da página"; adicionar opção "selecionar todos os N filtrados" que dispara uma query separada só de `id` quando o usuário clicar.
- Bulk actions e CSV: o export CSV hoje usaria só a página; adicionar caminho que busca todos os ids/colunas em lotes quando o usuário pedir exportar tudo.

## Arquivos afetados

- `src/components/entity-list.tsx` — única alteração estrutural. As páginas (`companies.tsx`, `contacts.tsx`, `deals.tsx`, etc.) continuam iguais porque só consomem o componente.

## Fora de escopo

- Índices no banco (estimar antes se a ordenação default em `created_at desc` precisa de índice — `companies` provavelmente já tem).
- Virtualização da tabela; com 50 linhas/página não é necessário.
