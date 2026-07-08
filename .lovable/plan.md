## Contexto
Ao selecionar um produto no combobox do modal de itens de linha, o servidor persiste o item corretamente (confirmado no banco: `name`, `quantity=1`, `unit_price` do produto), mas a linha renderizada no modal aparece vazia (`Nome do item` placeholder, `QTD=0`, `PREÇO=R$ 0,00`). Somente ao fechar e reabrir o modal a linha aparece com dados. Ao adicionar de novo, o combobox insere um segundo registro no banco (não é duplicação — é uma segunda inserção real feita pelo usuário), reforçando que o fluxo depende de reabrir o modal para ler o estado real.

## Causa raiz
O fluxo de inserção em `src/components/deals/deal-line-items.tsx` combina:
1. Optimistic append no cache (`setItemsCache`).
2. Em seguida `notifyChanged()` chama `qc.invalidateQueries` na MESMA chave (`lineItemsQueryKey`) e também em `["deals"]`.
3. A invalidação em `["deals"]` faz a rota do negócio revalidar e re-renderizar, o que reprocessa o subtree onde o `Dialog` está montado. O `LineItemsEditorBody` sofre re-render antes da refetch de `lineItemsQueryKey` completar, e a combinação `cancelQueries` + `invalidateQueries` deixa a query em estado transitório que descarta o item recém-adicionado no cache visível ao componente.

Além disso, o `EntityCombobox` permanece com `value={null}` mas nunca é forçado a resetar após inserir, o que impede reusar o mesmo produto na mesma sessão do modal e mascara o problema.

## Correções

### 1. `deal-line-items.tsx` — não invalidar a query local após mutation
- `notifyChanged()` deixa de chamar `refreshItems()` (invalidação da chave `deal_line_items:<dealId>`). O cache otimista já contém a verdade retornada pelo `.select("*").single()`.
- Continua invalidando `["deals"]` para atualizar totais no restante da UI, mas de forma que não force o subtree do modal a re-fetch da lista.
- `addBlank`, `addFromProduct`, `update`, `remove` passam a chamar `setQueryData` diretamente (sem `cancelQueries` prévio), garantindo que a escrita otimista sobreviva a re-renders.
- Em `update` e `remove`, manter rollback do cache em caso de erro (mantém comportamento atual, apenas sem invalidação global da chave).

### 2. Reset do `EntityCombobox` após inserir
- Após `addFromProduct(id)` bem-sucedido, forçar o combobox a limpar a seleção (via `key` incrementado ou controlando `value` explicitamente) para permitir escolher o mesmo produto novamente e evitar estados residuais.

### 3. Sincronização defensiva dos inputs
- Confirmar que `LabeledNumber`, `TextField` e `CurrencyInput` refletem imediatamente o item recém-inserido: os dois primeiros já sincronizam via `useEffect` quando `!focused`; adicionar um `key={li.id}` no card da linha garante que uma linha recém-criada monte com os valores certos e não reutilize instância anterior.

### 4. Sem mudanças de schema, RLS, rotas ou lógica de negócio
Apenas ajustes de fluxo de cache/UX no componente.

## Validação
- `bunx tsgo --noEmit`.
- Manual: abrir modal em negócio vazio via botão "Editar", selecionar um produto do catálogo, confirmar imediatamente `nome`, `qtd=1`, `preço` corretos, `total` da linha e "Total" agregado; adicionar segundo produto e verificar; fechar e reabrir para confirmar persistência sem duplicação.

## Fora do escopo
- Remover ou reestruturar o branch empty/non-empty em `DealLineItems`.
- Alterar `EntityCombobox` internamente.
- Alterar server functions ou RLS.