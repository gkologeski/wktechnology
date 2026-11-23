---
module_key: contracts
slug: aninhar-contratos
title: Aninhar contratos de compra sob uma prestação
summary: Aninhar contratos de compra sob uma prestação no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 40
version: 8
is_published: true
---
# Aninhar contratos de compra sob uma prestação
**Para que serve:** Aninhar contratos de compra sob uma prestação.
**Quem pode fazer:** Atualização dos contratos e capacidade de alterar o vínculo.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a prestação principal e o contrato de compra correto.

## Passo a passo

### Contratar fornecedor a partir da venda
1. Na venda, abra a aba "Aditivos e vínculos" e clique em "Contratar fornecedor".
2. Escolha "Empresa (PJ)" e selecione a empresa fornecedora (e, se quiser, o contato que assina) ou escolha "Pessoa física" e selecione o profissional.
3. Clique em "Criar contrato de compra". O sistema abre o novo contrato de compra em rascunho, já aninhado à venda e com a proposta comercial aceita da venda como anexo técnico.
4. No contrato de compra, abra a aba "Documento", escolha o "Modelo de compra" e clique em "Preencher com dados do fornecedor". O texto recebe a WK como contratante e a empresa ou o profissional como contratada; a data de início fica como hoje se ainda estiver vazia.
5. Se aparecer o aviso "Complete manualmente", ajuste no texto os dados indicados e salve. Depois envie para assinatura como em qualquer contrato.

Você pode contratar o fornecedor no mesmo dia da venda ou depois; a venda continua valendo sozinha. O mesmo botão "Contratar fornecedor" também aparece na ficha do negócio, na jornada de contratação, assim que o contrato de venda existe. Na lista de Contratos, o botão "Contratar fornecedor" (ao lado de "Novo contrato") pede primeiro o "Contrato de venda" e depois segue igual.

### Aninhar um contrato de compra já existente
1. Na prestação, abra "Contratos de compra aninhados" e clique em "Aninhar contrato de compra".
2. Selecione o contrato de compra e clique em "Aninhar".
3. Se ele já estiver vinculado a outro contrato, use "Mover" e confirme a troca de vínculo.
4. Pela compra, também é possível usar "Aninhar sob contrato de prestação" ou "Alterar contrato principal".
5. Para remover, use "Desaninhar" e confirme "Desaninhar este contrato de compra do contrato de prestação?".
![Tela: Aninhar contratos de compra sob uma prestação, sem dados pessoais reais](/help-media/contracts/aninhar-contratos.webp)

## Resultado esperado
Contrato de compra associado à prestação e apresentado sob ela na listagem.

### Gerar as contas a pagar da compra assinada
1. Depois que o contrato de compra for assinado, abra a aba "Visão geral" e vá ao quadro "Contas a pagar".
2. O sistema propõe as parcelas pelas condições de pagamento do contrato (ou uma parcela única, se não houver condições). Revise descrição, valor e vencimento de cada parcela; adicione ou remova parcelas se precisar.
3. Quando a soma fechar o valor total do contrato, clique em "Gerar contas a pagar". As parcelas passam a aparecer no Financeiro como contas a pagar em aberto.
## Regras e limites

- Ao contratar um fornecedor, a vigência da compra já vem preenchida: começa hoje (ou na data de início da venda, se for futura) e termina no prazo mais longo entre a venda, seus aditivos ativos e o projeto ligado. Ajuste as datas se o fornecedor entregar antes.
- "Gerar contas a pagar" exige permissão de criar lançamentos financeiros; quem não tem vê apenas o aviso de que o Financeiro precisa confirmar.
- As contas a pagar só são geradas com o contrato assinado e o valor total preenchido, a soma das parcelas precisa fechar exatamente esse valor e cada contrato gera uma única vez.
- "Contratar fornecedor" exige permissão de criar contratos; o botão não aparece para quem não tem.
- O contato precisa ser da empresa escolhida. Pessoa física deve ser um contato sem empresa vinculada.
- "Preencher com dados do fornecedor" só aparece em contratos de compra em rascunho, para quem pode editar contratos, e substitui o texto atual.
- Compra representa a WK como contratante do profissional; prestação representa a WK prestadora.
- Compra não aninha outra compra ou prestação neste card. Aditivos têm painel próprio.
- Autovínculo é impedido. Mover exige confirmação.
- A apresentação de margem não equivale a faturamento ou recebimento.

## Erros comuns
"Você não tem permissão para alterar este vínculo": revise seu acesso. Não confunda o contrato principal de um aditivo com o pai de uma compra.

## Relacionados
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)
- [Vinculação de contratos](/ajuda/contracts/revisar-vinculacao)
