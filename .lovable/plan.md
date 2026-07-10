## Diagnóstico — modal de Itens de Linha

Após auditar `deal-line-items.tsx`, `deal-quotes.tsx` e `quotes.functions.ts`, identifiquei **quatro gaps** que explicam por que os valores continuam zerando/desaparecendo e por que o desconto em R$ não é refletido nas cotações.

### Gap 1 (raiz do "zera o modal") — colisão de cache entre dois `useQuery` com a mesma `queryKey` e `select` diferentes

Dois componentes usam **exatamente** `queryKey: ["deal_line_items", dealId]`:

- `DealLineItems` / `LineItemsEditorBody` → `.select("*")` (todos os campos)
- `DealQuotes` (`deal-quotes.tsx:140-150`) → `.select("id")` (só id)

Como a chave é a mesma, o React Query compartilha o cache. Sempre que o `DealQuotes` (que fica montado no drawer do negócio) refaz o fetch — por foco na janela, invalidação de `["deals"]`, ou remount do drawer — ele **sobrescreve o cache** com linhas contendo apenas `{id}`, e o editor renderiza tudo como `0`/vazio. Foi por isso que abrir/fechar "resolvia" (o editor tornava a chamar com `select("*")`).

### Gap 2 — server `recompute` ignora `discount_amount` e `discount_type`

`quotes.functions.ts:11-34` só usa `discount_pct`. Consequência: cotação gerada a partir de um deal com desconto em R$ tem `discount_total` e `total` errados.

### Gap 3 — insert em `quote_line_items` perde campos

`quotes.functions.ts:132-142` não copia `discount_amount`, `discount_type` nem `description`. A cotação nasce sem esses dados.

### Gap 4 — `CurrencyInput` do desconto por valor não re-sincroniza com prop

O input de `%` usa `defaultValue` + `key` (recria ao mudar), mas o `CurrencyInput` de `discount_amount` é controlado por `value`. Ele já tem `useEffect` interno, então tende a atualizar; porém após o Gap 1 zerar o cache, o valor mostrado fica "0,00" mesmo com o usuário tendo digitado — reforça a percepção do bug.

---

## Correções propostas

### 1. Isolar o cache do editor (frontend, `deal-line-items.tsx` + `deal-quotes.tsx`)
- Alterar a `queryKey` do editor para `["deal_line_items", dealId, "full"]` e do `DealQuotes` para `["deal_line_items", dealId, "count"]` (ou trocar o count por `select("id", { count: "exact", head: true })`).
- Ajustar `notifyDealsChanged` para invalidar ambas as variantes com um prefixo (`["deal_line_items", dealId]`) via `predicate`, mantendo o cache otimista intacto durante o mutation (só invalida em `onSettled` do último update).

### 2. Server-side de cotações (`src/lib/quotes.functions.ts`)
- `recompute` passa a aceitar `discount_amount` e `discount_type` e replicar a fórmula do frontend (`lineDiscount`): quando `type === 'amount'`, usa `min(discount_amount * qty, sub)`.
- Payload de `quote_line_items` inclui `description`, `discount_amount`, `discount_type`.
- Idem no `regenerateQuoteFromDeal`/`updateQuote` se replicarem lógica (verificar no momento da edição).

### 3. Robustez do editor
- `TextField` e `LabeledNumber`: em `onBlur`, se o valor não mudou não chamar `update` (já feito) — reforçar comparando com string normalizada para evitar disparos por reformatação numérica.
- Após `addFromProduct`, garantir que o produto selecionado propague `description` e `tax_rate` corretos (já ok) e limpar apenas o combobox, mantendo foco no novo item.

### 4. Consistência semântica do desconto em R$
- Confirmar contrato: hoje `discount_amount * quantity`. Vou manter (retrocompatível) mas deixar comentário no server e no editor documentando a fórmula, para evitar divergência futura.

---

## Arquivos a alterar
- `src/components/deals/deal-line-items.tsx` — nova queryKey, ajuste do `notifyDealsChanged`.
- `src/components/deals/deal-quotes.tsx` — queryKey do contador separada.
- `src/lib/quotes.functions.ts` — `recompute` completa + payload completo de `quote_line_items`.

## Fora do escopo
- Migração de banco (colunas já existem).
- Redesign visual do modal.
- Alterações em RLS.

## Como validar
1. Abrir um deal → itens de linha → adicionar produto do catálogo: nome, preço, imposto e desconto do produto aparecem sem reabrir o modal.
2. Alterar desconto em % e depois trocar para R$: valor persiste, total recalcula.
3. Fechar e reabrir o modal: mesmos valores.
4. Gerar cotação a partir do deal: totais e linhas espelham exatamente o editor (inclusive descontos em R$ e descrição).
