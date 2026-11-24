## Detalhes técnicos
- `src/components/deals/use-line-items.ts`: novo `useLineItemDraft(dealId, userId)` em `localStorage` (chave `deal-line-items-draft:<userId>:<dealId>`, patches por `item.id`), limpo após `update` bem-sucedido; função `flushPending()` que aplica os patches pendentes e retorna sucesso/falha.
- `line-item-card.tsx` / `line-item-billing-fields.tsx`: além de `onDirty`, reportar o valor em edição ao rascunho; valor inicial do campo vem do rascunho quando existir.
- `deal-line-items.tsx`: botão `Save` → **Concluído** (ícone Check); `onClick` = blur do campo ativo → `flushPending()` → `setOpen(false)` se ok. `LineItemsEditorBody` recebe `onDone` opcional (usos sem janela mantêm o comportamento atual). Aviso "Rascunho restaurado" + "Descartar rascunho".
- Sem mudança de banco, RLS ou permissões; classificação de apresentação no `permission-contracts.json` com hashes atualizados.
- Teste unitário da regra do rascunho (gravar, restaurar, limpar após sucesso, manter após falha).
- Ajuda: atualizar artigo de itens de linha do negócio (bump de `version`).
- Validação: `permissions:check`, `tsgo`, testes, build e Playwright (digitar, fechar pelo X, reabrir, clicar Concluído).
