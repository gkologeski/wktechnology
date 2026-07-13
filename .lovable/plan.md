## Problema
No card "Itens de linha" da página do deal, o modal fecha assim que o primeiro item é adicionado, impedindo editar quantidade, preço, desconto e imposto. A partir do segundo item, o botão "Editar" no cabeçalho continua funcionando normalmente.

## Causa raiz
`src/components/deals/deal-line-items.tsx` → `DealLineItems` (o componente de leitura do card) renderiza um `DealLineItemsEditor` (Dialog) somente no ramo `items.length === 0` (linhas 105–121). Quando o usuário adiciona o primeiro item dentro desse modal, `useLineItems` atualiza o cache, `items.length` vira 1 e o React troca o ramo de renderização, desmontando o Dialog aberto.

O `DealLineItemsEditor` que fica no cabeçalho do card em `src/routes/_authenticated/deals.$id.tsx` (linha 221) já cobre a ação "Editar" de forma persistente — mas fica invisível durante o empty-state porque o card só mostra "Nenhum item adicionado" + botão do editor duplicado.

## Correção proposta (escopo mínimo, só UI)
Editar `src/components/deals/deal-line-items.tsx`:

1. Em `DealLineItems`, no ramo `items.length === 0`, remover o `DealLineItemsEditor` embutido e manter apenas o texto "Nenhum item adicionado.". A ação de adicionar continua disponível pelo botão "Editar" do cabeçalho do card, que já existe em `deals.$id.tsx:221` e é persistente entre re-renders (não desmonta).

   - Vantagem: fix pontual, sem lift-state, sem mudar props públicas do componente. Elimina o Dialog que desmonta ao mudar de ramo.

2. Não alterar `LineItemsEditorBody`, `addFromProduct`, cache/optimistic updates, migrations, RLS ou qualquer server function.

## Fora do escopo
- Redesenhar o card ou o modal.
- Mudar comportamento do `DealDetailDrawer` (também usa `DealLineItems`, mas o drawer já tem seu próprio botão de editar persistente ou pode ser ajustado numa próxima demanda se surgir o mesmo sintoma).
- Alterar `EntityCombobox`, produtos, descontos, impostos.

## Validação manual
1. Abrir um deal sem itens de linha (ex.: um deal novo em `/deals/:id`).
2. Clicar em "Editar" no cabeçalho do card "Itens de linha".
3. Selecionar um produto no combobox "Adicionar do catálogo…".
4. Confirmar que o modal permanece aberto e o item recém-criado aparece na lista já editável (quantidade, preço, desconto, imposto).
5. Fechar o modal manualmente e reabrir — o item persiste.

## Riscos
- Baixo. Mudança restrita ao ramo de empty-state de um componente presentacional. Nenhuma regra de negócio, permissão ou schema é afetada.
- Se algum outro consumidor (ex.: `DealDetailDrawer`) dependia visualmente do botão "Adicionar item" dentro do empty-state, a ação continua acessível pelo botão "Editar" do cabeçalho; se necessário, aplica-se a mesma correção no drawer numa demanda futura.