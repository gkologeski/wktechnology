# Corrigir total zerado quando o desconto é em R$

Confirmei a causa: quando o desconto está em R$, o sistema multiplica o valor digitado pela quantidade. No exemplo da imagem, 16 × R$ 200,00 = R$ 3.200,00 de desconto, exatamente o subtotal — por isso o total fica R$ 0,00.

Também confirmei que o valor do negócio, calculado no banco, ignora o desconto em R$ (só considera desconto em %), então hoje o valor do negócio fica maior do que o total mostrado no modal.

## O que muda

1. Desconto em R$ passa a ser o desconto **da linha inteira**, não por unidade. No exemplo: subtotal R$ 3.200,00 − R$ 200,00 = R$ 3.000,00.
2. O desconto continua limitado ao subtotal da linha (nunca gera total negativo).
3. Um texto curto abaixo do campo esclarece se o desconto é "% do subtotal" ou "valor total da linha".
4. O valor do negócio calculado automaticamente passa a considerar o desconto em R$, ficando igual ao total exibido no modal e nas cotações.

## Detalhes técnicos

- `src/components/deals/deal-line-items.tsx` (`lineDiscount`): remover a multiplicação por `quantity` no ramo `amount`, mantendo o clamp `[0, gross]`.
- `src/lib/quotes.functions.ts` (`lineDiscountServer`): mesma correção e atualização do comentário que descreve o espelhamento.
- `src/lib/workflows/line-items.ts` (`lineItemTotal`): já trata o desconto em R$ como valor da linha; adicionar o clamp para não passar do bruto, mantendo a consistência.
- Migration para `public.recompute_deal_value`: aplicar desconto por linha como `CASE WHEN discount_type = 'amount' THEN LEAST(GREATEST(discount_amount,0), gross) ELSE gross * discount_pct/100 END` antes do imposto. Só altera a função de cálculo — sem mudança de schema, RLS ou permissões.
- Após a migration, recalcular o valor dos negócios que possuem itens com `discount_type = 'amount'` (idempotente, apenas onde o valor divergir).
- Testes: casos de desconto em R$ (normal, maior que o subtotal, com quantidade > 1) para o cálculo compartilhado.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test`.
- Manual: no modal de itens de linha, com Qtd 16 e Preço R$ 200,00, aplicar desconto R$ 200,00 e conferir total R$ 3.000,00; depois conferir o valor do negócio no grid.
