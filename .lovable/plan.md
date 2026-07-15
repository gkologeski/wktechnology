## Objetivo

Fazer com que o **Valor** exibido no detalhe do negócio seja o **valor líquido** (mesmo total mostrado no rodapé dos Itens de linha: subtotal − descontos + impostos), em vez de um valor bruto/manual descolado.

Hoje: `deals.value` é um campo independente, editado manualmente; a soma dos itens de linha aparece só no editor. Os dois divergem.

## Estratégia

Tornar `deals.value` derivado dos itens de linha sempre que existirem itens. Quando o negócio não tiver itens de linha, mantém o valor manual atual (retrocompatível).

### 1. Banco de dados (migration)

Criar função e trigger em `public.deal_line_items` que, a cada `INSERT/UPDATE/DELETE`, recalcula o total líquido do deal correspondente e grava em `deals.value`:

```
total = Σ (quantity * unit_price
           − (discount_type='amount' ? min(discount_amount*quantity, gross) : gross*discount_pct/100))
       * (1 + tax_rate/100)
```

- Se a soma dos itens for `> 0` → atualiza `deals.value`.
- Se o deal ficar sem itens (último removido) → **preserva** o `deals.value` atual (não zera), para não perder valores manuais em negócios sem catálogo.
- Backfill único: recalcular `deals.value` para todos os deals que já tenham pelo menos um item de linha.

### 2. Frontend

- `src/routes/_authenticated/deals.$id.tsx`: após `notifyDealsChanged` (evento `deal:line-items-changed`), o `load()` já é chamado — o header vai refletir o novo valor automaticamente. Nenhuma lógica de cálculo no cliente.
- `PropertiesPanel` do negócio: tornar o campo **Valor** somente-leitura quando existirem itens de linha, com hint “Calculado a partir dos itens de linha”. Continua editável quando não houver itens.
- Nenhuma alteração em cotações, faturas, pipeline board ou lista (eles já leem `deals.value`, que passará a estar sincronizado).

### 3. Fora do escopo

- Não alterar regras de RLS, políticas, permissões, autenticação ou schema além do necessário para o trigger.
- Não mexer no cálculo dentro do editor de itens (fórmula já está correta e será replicada no SQL).
- Não mexer em `quote_line_items` / cotações.

## Detalhes técnicos

- Trigger `AFTER INSERT OR UPDATE OR DELETE ON public.deal_line_items FOR EACH ROW`, `SECURITY DEFINER`, `search_path = public`, que faz um `UPDATE public.deals SET value = (SELECT ...) WHERE id = deal_id` guardado com `SET LOCAL` para não recursar.
- A subquery usa `GREATEST(gross - discount, 0) * (1 + tax_rate/100)` para bater 1:1 com `lineTotal` do TypeScript.
- Migration inclui `COMMENT ON COLUMN public.deals.value IS 'Auto-sincronizado com a soma líquida de deal_line_items quando houver itens.'`.

## Validação manual

1. Abrir um deal com itens de linha → header e “Total” do editor devem ser idênticos.
2. Editar quantidade/preço/desconto/imposto de um item → header atualiza após fechar o editor.
3. Remover todos os itens → valor permanece como estava (não zera).
4. Deal sem itens → campo Valor continua editável manualmente.
