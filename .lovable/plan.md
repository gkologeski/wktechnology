# Projeção dinâmica segura nos grids centrais e do TechHire

Duas frentes: blindar os grids que já usam catálogo dinâmico (Contatos, Empresas, Negócios, Tarefas) e levar o mesmo comportamento aos grids do TechHire, que hoje usam projeção fixa dentro de server functions.

## O que muda para o usuário

1. Contatos, Empresas, Negócios e Tarefas param de buscar a tabela inteira (`select("*")`): só as colunas visíveis são carregadas, e uma coluna que não exista mais no banco é simplesmente ignorada em vez de esvaziar a lista.
2. Quando a consulta de listagem falhar, cada grid mostra o estado de erro padrão (mensagem em PT-BR + "tentar novamente") em vez de "0 registros".
3. Nos grids do TechHire (Candidatos, Vagas, Candidaturas da vaga, Ofertas, Entrevistas) o botão "Colunas" passa a ter o grupo "Outros campos" com todos os campos da entidade, ordenação clicável nesses campos e persistência por usuário/tela.

## Escopo técnico

### Fase 1 — Grids centrais (Contatos, Empresas, Negócios, Tarefas)

Para cada tela, seguindo exatamente o padrão já aplicado em `/leads`:

- Adicionar `useGridProjection({ gridKey, entity, declaredSortKeys })` antes da query da lista.
- Declarar `BASE_*_KEYS` com as colunas realmente consumidas por células, filtros, seleção em massa, kanban e ações de linha (auditadas arquivo por arquivo, sem adivinhar nomes).
- Trocar `select("*", { count: "exact" })` por
  `select(buildGridSelect(BASE_KEYS, projection.selectKeys, { customFields: projection.needsCustomFields, allowed: projection.knownColumns }), { count: "exact" })`.
- Incluir `projection.selectSignature` na `queryKey` para refazer a busca quando o usuário muda colunas.
- Ligar `sortKey`/`sortDir` da preferência salva via `resolveSortKey` e passar `sortHeader` para as colunas dinâmicas (Negócios/Tarefas só quando a tela já ordena no banco; onde a ordenação é em memória, mantém-se o comportamento atual).
- Adicionar ramo de erro na tabela com o `ErrorState` do design system.

Entidades do catálogo já suportadas: `contacts`, `companies`, `deals`, `activities`.

### Fase 2 — TechHire

Server functions (`src/lib/ats/ats.functions.ts` para vagas e candidatos, `offers.functions.ts`, `interviews.functions.ts`, e a listagem de candidaturas usada por `jobs.$id.tsx`):

- Novo input opcional `extraColumns?: string[]`, `sortKey?: string`, `sortDir?: "asc" | "desc"`.
- Validação **no servidor**: as chaves vêm do catálogo real da tabela (`get_entity_field_catalog`, já usado por `getEntityFieldCatalog`) e passam por `isPlainColumn`; nada do cliente entra cru em `select`/`order`. Chave inválida é descartada e a ordenação cai no padrão atual da função.
- A projeção fixa atual continua sendo a base (nenhuma coluna hoje usada é removida), somada às `extraColumns` aprovadas. Relações embutidas (`ats_candidates(...)`, `ats_jobs(...)` em ofertas) permanecem.
- Nenhuma mudança em RLS, RBAC, filtros existentes ou limites — a ordenação roda sobre a mesma query já filtrada.

Telas:

- `gridKey` próprio por grid (`ats-candidates`, `ats-jobs`, `ats-job-applications`, `ats-offers`, `ats-interviews`) e `catalogEntity` correspondente (`ats_candidates`, `ats_jobs`, `ats_applications`, `ats_interviews`; ofertas precisam de `ats_offers` liberado na lista de entidades permitidas do catálogo).
- Colunas e ações atuais (seleção em massa, `AssigneeCell`, `AssigneeFilter`, badges de estágio/score/origem, kanban) preservadas como colunas declaradas.
- Modo kanban/cards inalterado; seleção de colunas afeta só o modo tabela.

## Fora do escopo

- Sem migration, sem alteração de schema, RLS, permissões ou regra de negócio.
- Sem redesenho visual dos grids e sem remoção de funcionalidade.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test` após cada fase.
- Playwright autenticado: em cada grid, escolher uma coluna de "Outros campos", ordenar por ela, recarregar e confirmar que coluna e ordenação voltam; abrir um registro a partir do grid (garante que as chaves base não faltaram); conferir no Network que a projeção não é mais `*`.

## Riscos

- Chave base esquecida quebraria uma célula ou ação de linha — mitigado pela auditoria por arquivo e pelo teste de abrir detalhes a partir de cada grid.
- Preferências antigas apontando para colunas removidas: filtradas por `allowed`; ordenação inválida cai no padrão.
