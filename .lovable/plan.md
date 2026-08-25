# Presets de contratação no fluxo comercial e remoção do Catálogo de Produtos

## Objetivo

1. Aplicar automaticamente os presets de contratação nos itens de linha de Negócios/Propostas ao escolher um serviço do catálogo.
2. Sugerir e pré-preencher presets também na criação/edição de Cotações, incluindo cargo e senioridade.
3. Sugerir cargo, senioridade e competências coerentes com o serviço na tela de alocação de pessoas.
4. Remover o Catálogo de Produtos do sistema (interface e tabela).

## Situação atual verificada

- `contracting_presets` hoje só é consumido no modal "Associar serviço" de contratos (`src/components/services/link-catalog-service-dialog.tsx`), via `listContractingPresetOptions`.
- Itens de linha de Negócios (`deal_line_items`) já usam `service_catalog_id` e trazem apenas nome, unidade e `base_price` do serviço — nenhum dado de preset.
- `quote_line_items` tem apenas nome, descrição, quantidade, preço, impostos e descontos; não tem serviço, cargo nem senioridade.
- Alocações (`src/components/people/allocations-panel.tsx`) já sugerem cargo/senioridade a partir dos serviços vinculados ao contrato (`listContractRoleSuggestions`), mas não usam presets nem preenchem competências. `people_allocations` não tem coluna de competências.
- Produtos aparecem em: rota `/catalog/products`, `products-page.tsx`, menus (`menu-config-core.ts`, `menu-config.ts`, `menu-resources.ts`), catálogo de permissões, grids/bulk-edit/workflows, além das colunas `deal_line_items.product_id`, `service_catalog.product_id` e `questionnaires.product_id`.

## Etapa 1 — Migrations

- Adicionar em `quote_line_items`: `service_catalog_id` (FK), `contracting_preset_id` (FK), `job_profile_id` (FK), `seniority`, `unit`.
- Adicionar em `deal_line_items`: `contracting_preset_id`, `job_profile_id`, `seniority`, `unit` (aditivo, nullable).
- Adicionar `competencies text[]` em `people_allocations` e `contracting_preset_id` (nullable) para rastrear a origem da sugestão.
- Remoção de produtos: dropar as colunas `deal_line_items.product_id`, `service_catalog.product_id` e `questionnaires.product_id`; depois `DROP TABLE public.products` (com as policies). Dados de produtos serão perdidos, conforme decidido.

## Etapa 2 — Presets em Negócios/Propostas

- Nova server function `resolvePresetForService` (em `src/lib/contracting-presets.functions.ts`): recebe `serviceCatalogId` e devolve o preset ativo mais adequado (match exato de serviço; se houver mais de um, retorna a lista para escolha).
- Em `deal-line-items.tsx`, ao selecionar um serviço: buscar presets do serviço.
  - 1 preset → aplica automaticamente unidade, preço (`default_unit_price`), cargo e senioridade, com aviso discreto "Preset X aplicado" e opção de desfazer.
  - Vários presets → mostra seletor compacto de preset na linha.
  - Nenhum preset → mantém o comportamento atual (dados do serviço).
- Campos permanecem editáveis; nada é sobrescrito depois de o usuário digitar manualmente.
- Exibir cargo/senioridade na linha via `StatusBadge`/texto secundário, seguindo o design system.

## Etapa 3 — Presets em Cotações

- No wizard/editor de cotações (`quote-wizard.tsx` + `src/lib/quotes.functions.ts`), permitir escolher serviço do catálogo por item e aplicar o preset com a mesma regra da Etapa 2.
- Persistir `service_catalog_id`, `contracting_preset_id`, `job_profile_id`, `seniority` e `unit` nos itens da cotação.
- Refletir cargo/senioridade no PDF público (`src/routes/api/public/quotes/$token.pdf.ts`) como linha secundária do item, sem quebrar cotações antigas.

## Etapa 4 — Presets nas alocações de pessoas

- Estender `listContractRoleSuggestions` para, além dos serviços do contrato, buscar presets ligados a cada `service_catalog_id` e mesclar cargo, senioridade e competências (preset tem prioridade quando o serviço não define o campo).
- Em `allocations-panel.tsx`: exibir a origem da sugestão (serviço ou preset) e, ao aplicar, preencher cargo, senioridade, competências e opcionalmente as taxas (`billable_rate`/`cost_rate`) a partir de `default_unit_price`/`default_unit_cost`, sempre editáveis.
- Salvar `competencies` e `contracting_preset_id` na alocação.

## Etapa 5 — Remover Produtos da interface

- Remover rota `src/routes/_authenticated/catalog.products.tsx` e `src/components/products/products-page.tsx`.
- Remover entradas de menu (`menu-config-core.ts`, `menu-config.ts`, `menu-resources.ts`), do catálogo de permissões (`access-profiles.constants.ts`, `resource-labels.ts`, chaves `techsales.catalog.products.*`), de grids/bulk-edit (`use-auto-grid-columns.tsx`, `bulk-edit-fields.ts`), de `entity-fields.functions.ts`, `entity-fields-meta.ts` e dos objetos de Workflows (`workflows/schemas.ts`).
- Ajustar telas/queries que referenciavam `product_id` (itens de linha, serviços, questionários de prospecção).

## Validações

- `bun run typecheck`, `bun run lint`, `bun run build:dev` e `bun run test`.
- Verificação manual: criar item de linha em negócio com serviço que tem preset; criar cotação e conferir PDF; criar alocação e aplicar sugestão; confirmar que nenhuma tela referencia Produtos.

## Riscos

- Remoção da tabela `products` é irreversível e derruba qualquer relatório/workflow que a referencie.
- Alterações em cotações exigem cuidado para não invalidar cotações já enviadas (todos os campos novos são nullable).
