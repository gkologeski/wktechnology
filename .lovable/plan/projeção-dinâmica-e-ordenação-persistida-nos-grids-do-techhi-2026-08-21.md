# Projeção dinâmica e ordenação persistida nos grids do TechHire

Fase 2 do trabalho já concluído em Leads/Contatos/Empresas/Negócios/Tarefas: levar o mesmo padrão (`buildGridSelect` + validação `allowed`, ordenação salva por usuário) para Candidatos, Vagas, Candidaturas da vaga, Ofertas e Entrevistas — que hoje usam projeção fixa dentro das server functions.

## O que muda para o usuário

1. Nos grids de Candidatos, Vagas, Candidaturas (aba Pipeline da vaga), Ofertas e Entrevistas o botão "Colunas" passa a listar o grupo "Outros campos" com todos os campos da entidade.
2. Essas colunas ficam clicáveis no cabeçalho para ordenar (asc/desc), com ordenação feita no banco.
3. Coluna escolhida + ordenação são salvas por usuário e por tela e voltam automaticamente ao recarregar a página.
4. Uma coluna que não exista mais no banco é ignorada em vez de esvaziar a lista (fim da "lista vazia" por projeção inválida).

## Escopo técnico

### Server functions (validação no servidor)

Arquivos: `src/lib/ats/ats.functions.ts` (`listAtsJobs`, `listAtsCandidates`), `src/lib/ats/offers.functions.ts` (`listOffers`), `src/lib/ats/interviews.functions.ts` (`listInterviews`), e a listagem de candidaturas usada por `jobs.$id.tsx`.

- Novos inputs opcionais: `extraColumns?: string[]`, `sortKey?: string`, `sortDir?: "asc" | "desc"`.
- Um helper server-only novo (`src/lib/ats/grid-projection.server.ts`) lê o catálogo real da tabela (mesma consulta usada por `get_entity_field_catalog`), filtra as chaves com `isPlainColumn` e devolve só as colunas que existem. Nada vindo do cliente entra cru em `select`/`order`; chave inválida é descartada e a ordenação cai no padrão atual de cada função.
- A projeção fixa atual continua como base (`buildGridSelect(BASE_KEYS, extras, { allowed })`), somada às colunas aprovadas. Relações embutidas (`ats_candidates(...)`, `ats_jobs(...)` em ofertas) permanecem como estão, concatenadas após a projeção.
- `listOffers` passa de `method: "GET"` para `POST` com `inputValidator` (precisa receber input). `listInterviews` mantém o filtro por `application_id`.
- Nenhuma mudança em RLS, RBAC, filtros ou limites — a ordenação roda sobre a mesma query já filtrada.

### Catálogo

- `getEntityFieldCatalog` e o tipo `CatalogEntity` ganham `ats_offers` (hoje ausentes; as outras quatro entidades já estão liberadas).

### Telas

- `candidates.index.tsx`, `jobs.index.tsx`, `offers.tsx` e `jobs.$id.tsx` (abas Pipeline e Entrevistas) passam a usar `useGridProjection` com `gridKey` próprio (`ats-candidates`, `ats-jobs`, `ats-offers`, `ats-job-applications`, `ats-interviews`) e a entidade de catálogo correspondente.
- `projection.selectKeys`/`sortKey`/`sortDir` vão para a chamada da server function, e `projection.selectSignature` entra na `queryKey` para refazer a busca quando o usuário troca colunas.
- Cabeçalhos das colunas dinâmicas usam o mesmo `sortHeader` de Leads, com persistência debounced via `saveGridPreference`.
- Colunas e ações atuais (seleção em massa, `AssigneeCell`, `AssigneeFilter`, badges de estágio/score/origem, kanban) são preservadas como colunas declaradas. Modo kanban/cards inalterado — a seleção de colunas afeta só o modo tabela.

## Fora do escopo

Sem migration, sem alteração de schema, RLS, permissões ou regra de negócio; sem redesenho visual e sem remoção de funcionalidade.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test`.
- Playwright autenticado: em cada um dos cinco grids — escolher uma coluna de "Outros campos", ordenar por ela, recarregar e confirmar coluna + ordenação; abrir um registro a partir do grid (garante que as chaves base não faltaram).

## Riscos

- Chave base esquecida quebraria uma célula ou ação de linha — mitigado pela auditoria arquivo por arquivo e pelo teste de abrir detalhes a partir de cada grid.
- Preferências antigas apontando para colunas inexistentes: filtradas por `allowed`; ordenação inválida cai no padrão.
