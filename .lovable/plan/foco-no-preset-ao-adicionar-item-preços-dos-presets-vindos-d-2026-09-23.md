# Foco no preset ao adicionar item + preços dos presets vindos do HubSpot

## 1. Foco automático no campo "Preset de contratação"

Ao adicionar um serviço do catálogo (ou vincular um serviço a um item em branco) no modal de itens de linha, o novo item aparece com o campo **Preset de contratação** já focado e com a busca aberta, pronto para digitar (ex.: "java sen"). Esc fecha sem escolher; nada muda nas demais regras.

- `use-line-items.ts`: `addFromCatalogService` passa a devolver o id do item criado.
- `deal-line-items.tsx`: guarda `focusItemId` e repassa `autoFocusPreset` ao `LineItemCard` desse item; limpa após o uso.
- `line-item-card.tsx` → `PresetLinePicker`: nova prop `autoOpen` que abre o popover e foca a busca na montagem (só se o serviço tiver presets).

## 2. Atualizar preços dos presets com os produtos do HubSpot (ação única, sem tela)

Hoje não guardamos os produtos do HubSpot no sistema (a tabela de Produtos foi removida). A atualização é feita uma vez, direto no banco, lendo os produtos pela conexão do HubSpot. Nenhuma tela e nenhum código novo no app.

Passos:
1. Ler todos os produtos do HubSpot (nome, SKU, preço, recorrência) pela conexão existente, com paginação.
2. Casar cada produto com um preset ativo do workspace WK Technology: nome exato (sem acento/caixa), depois nome sem senioridade + senioridade, usando as mesmas regras já usadas na criação dos presets. Casamentos ambíguos (mais de um preset) ou sem correspondência não são tocados.
3. Mostrar a você a prévia no chat: quantos casaram, exemplos de valor atual x novo, e a lista dos sem correspondência.
4. Após sua confirmação, aplicar em lote: só `default_unit_price` (e `currency` quando vazia) dos presets casados. Produtos sem preço são ignorados.
5. Conferir por consulta: quantos presets foram atualizados e total com preço antes/depois.

O que não muda: itens de linha já existentes, cotações, contratos, regras de acesso e estrutura do banco.

## Validação
Parte 1: `bunx vitest run`, `bunx eslint` nos arquivos alterados, `bunx tsgo --noEmit` e teste no navegador do foco automático. Parte 2: consultas de conferência antes/depois.
