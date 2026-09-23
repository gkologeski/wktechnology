# Foco no preset ao adicionar item + preços dos presets vindos do HubSpot

## 1. Foco automático no campo "Preset de contratação"

Ao adicionar um serviço do catálogo (ou vincular um serviço a um item em branco) no modal de itens de linha, o novo item aparece com o campo **Preset de contratação** já focado e com a busca aberta, pronto para digitar (ex.: "java sen"). Esc fecha sem escolher; nada muda nas demais regras.

- `use-line-items.ts`: `addFromCatalogService` passa a devolver o id do item criado.
- `deal-line-items.tsx`: guarda `focusItemId` e repassa `autoFocusPreset` ao `LineItemCard` desse item; limpa após o uso.
- `line-item-card.tsx` → `PresetLinePicker`: nova prop `autoOpen` que abre o popover e foca a busca na montagem (só se o serviço tiver presets).

## 2. Atualizar preços dos presets com os produtos do HubSpot

Hoje não guardamos os produtos do HubSpot no sistema (a tabela de Produtos foi removida), então os valores precisam ser lidos direto do HubSpot pela conexão já existente.

Fluxo, com revisão antes de gravar:
1. Tela **Catálogo > Presets > Atualizar com HubSpot** lista os produtos do HubSpot (nome, SKU, preço) e o preset correspondente sugerido (mesmo nome sem senioridade + senioridade, usando as regras de classificação já existentes).
2. Mostra valor atual x valor do HubSpot; linhas sem correspondência ficam para escolha manual ou "ignorar".
3. O usuário aprova e aplica; só `default_unit_price` (e `currency` quando vazia) é alterado. Presets sem correspondência ficam como estão.
4. Resumo final: quantos atualizados, ignorados e sem correspondência.

Detalhes técnicos:
- `src/lib/integrations/hubspot-products.server.ts`: paginação em `crm/v3/objects/products` (properties `name, hs_sku, price, hs_recurring_billing_period`) com o token da integração HubSpot do workspace.
- `src/lib/contracting-presets-hubspot.functions.ts`: `previewHubspotPresetPrices()` e `applyHubspotPresetPrices(entries)`, com `requireSupabaseAuth` + `assertPermission` de edição do catálogo, filtradas por `workspace_id`.
- Matching reaproveita `src/lib/catalog/line-item-classify.ts` (`parseSeniority`, `matchJobProfile`); testes unitários do casamento.
- Tela com PageHeader, FilterBar, tabela, EmptyState, Skeletons, estado de erro (ex.: "HubSpot não conectado").
- Sem migração, sem mudança de RLS; itens de linha já existentes não são alterados.

## Validação
`bunx vitest run`, `bunx eslint` nos arquivos alterados, `bunx tsgo --noEmit`; teste no navegador do foco automático e da prévia de preços.
