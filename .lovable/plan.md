## Problema

Em `/deals/:id`, o painel **Cotações** mantém o botão "Adicionar" desabilitado mesmo depois de adicionar itens de linha. Só funciona ao recarregar a página.

## Causa

`src/components/deals/deal-quotes.tsx` consulta os itens de linha com um query key próprio:

```ts
queryKey: ["deal_line_items_count", dealId]
```

Já `src/components/deals/deal-line-items.tsx` (editor que cria/edita/remove itens) invalida apenas `["deal_line_items", dealId]`. Como as keys não batem, o cache do DealQuotes nunca é invalidado e `hasLineItems` permanece `false` até um reload.

## Correção (1 arquivo, escopo mínimo)

`src/components/deals/deal-quotes.tsx`:

- Trocar o `queryKey` da verificação de itens de linha para `["deal_line_items", dealId]` (mesmo usado pelo editor), assim qualquer create/update/delete já invalida automaticamente e o botão "Adicionar" reativa imediatamente.
- Manter o `select`/shape compatível (apenas `id`), sem alterar regra de negócio, RLS ou queries do servidor.

## Fora do escopo

- Não alterar `deal-line-items.tsx`, `quotes.functions.ts`, RLS, schema ou layout.
- Sem mexer em outras telas.

## Validação manual

1. Abrir um deal sem itens de linha → botão "Adicionar" em Cotações fica desabilitado com tooltip.
2. Adicionar 1 item de linha pelo editor → o botão "Adicionar" reativa **sem reload**.
3. Remover todos os itens → o botão volta a ficar desabilitado.
