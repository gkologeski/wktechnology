# Corrigir tela em branco em "Preparar contrato da minuta aceita"

Porte P · estimativa 25–35 min · sem publicação automática.

## Causa confirmada
- A proposta desse negócio da NEXID (complemento de 111 h) já tem um contrato: o aditivo C-202611-5749 (ativo).
- Ao clicar no botão, o servidor encontra esse aditivo e devolve "Contrato existente carregado; nada foi duplicado", sem criar nada (comportamento correto).
- A tela do negócio, porém, ignora aditivos ao escolher o contrato da proposta. Assim, o painel "Contrato e assinaturas" abre sem contrato e não mostra nada.

## O que muda
1. A jornada do negócio passa a reconhecer o aditivo ligado à proposta aceita como o contrato daquela venda, quando não houver contrato principal. O painel mostra "Abrir ficha completa do contrato", aprovações, aceite e assinatura do C-202611-5749.
2. O painel nunca mais fica vazio: se o contrato existir mas não estiver visível, aparece um aviso com link para a ficha do contrato devolvido pelo servidor e a opção de tentar novamente.
3. O painel de outras operações continua listando só contratos principais para criar aditivos.

## Detalhes técnicos
- `src/lib/deals/contracting-journey.ts` (`selectJourney`): candidatos por `proposal_id` preferem `document_kind !== "amendment"` e, se não houver, aceitam o aditivo.
- `src/components/deals/deal-contracting-journey.tsx`: guardar o `contract.id` retornado por `create` e usar como alternativa no `sheet === "contract"`; estado vazio/erro com link.
- Sem migration, RLS, permissões ou mudança em `sales-flow.server.ts`; nenhum dado alterado.
- Teste unitário da regra em `contracting-journey` (aditivo único é escolhido; principal tem prioridade).
- Validação: testes, permissions:check, verificação no navegador com o negócio da NEXID; atualizar o artigo da Ajuda da jornada se o texto mudar.
