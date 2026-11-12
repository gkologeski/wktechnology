---
module_key: crm
slug: definir-condicoes-de-pagamento
title: Definir as condições de pagamento da cotação
summary: Escolher entrada, vencimento da entrada e saldo (mensal, parcelas ou marcos) que seguem para proposta, contrato e contas a receber.
article_type: howto
route_pattern: /deals/$id
min_permission:
audience: internal
sort_order: 205
version: 3
is_published: true
---
# Definir as condições de pagamento da cotação
**Para que serve:** Combinar como o cliente vai pagar — entrada e saldo — uma única vez na cotação. As condições seguem para a proposta (texto e PDF), para o contrato e, na ativação do serviço, viram as contas a receber.
**Quem pode fazer:** Membros ativos com `techsales.quotes` (alterar) para a cotação e `techsales.proposals` (alterar) para a proposta. Gerar as contas a receber na ativação exige `techservice.services` (alterar), `techservice.billing` (gerenciar) e criação de lançamentos em `techfinance.entries`.
**Onde fica:** Negócio > cartão "Cotações" > "Adicionar" ou editar > etapa "Condições de pagamento".
**Antes de começar:** O negócio precisa ter itens de linha com valores.

## Passo a passo
1. Abra o negócio e, no cartão "Cotações", clique em "Adicionar" (ou edite uma cotação em rascunho).
2. Avance até a etapa "Condições de pagamento". A sugestão inicial vem do tipo dos itens: outsourcing fica mensal; consultoria e fábrica de software ficam com entrada e entrega final.
3. Em "Entrada", escolha "Sem entrada", "% do total" ou "Valor em R$" e informe o número.
4. Em "Vencimento da entrada", escolha "Na assinatura do contrato" ou "Em uma data" e selecione o dia.
5. Em "Saldo", escolha "Mensal" (meses e dia de vencimento), "Parcelas periódicas" (quantidade, intervalo em meses e dia) ou "Por entregas/marcos" (nome e % de cada marco; os marcos somam 100% do saldo) ou "Em uma data" (o saldo inteiro vence em parcela única na data escolhida, que não pode ser anterior à entrada).
6. Confira a tabela "Parcelas previstas" e clique em "Avançar" para gravar.
7. Ao gerar a proposta, o assistente já abre com as mesmas condições; ajuste se a negociação mudou. O bloco "Condições comerciais" do texto e o PDF mostram entrada, saldo e vencimentos.
8. Ao gerar o contrato da proposta, a ficha mostra o cartão "Condições de pagamento" com o cronograma previsto.
9. Ao ativar o serviço do contrato, o sistema cria as contas a receber do cronograma uma única vez para o contrato.

## Resultado esperado
A cotação, a proposta e o contrato mostram as mesmas condições, e as contas a receber aparecem no TechFinance logo após ativar o serviço.

## Regras e limites
- Entrada na assinatura: antes de assinar, a conta nasce com a data de ativação e a observação "Vence na assinatura do contrato"; se o contrato já estiver assinado, usa a data da assinatura.
- Marcos não têm data: a conta nasce com a data de ativação e a observação "Vence na entrega do marco"; ajuste a data no TechFinance quando o marco for entregue.
- Mensalidades e parcelas começam no mês seguinte quando há entrada.
- Com condições de pagamento no contrato, o serviço deixa de faturar sozinho todo mês, para não cobrar em dobro. Contratos sem condições continuam como antes.
- A soma das parcelas precisa fechar com o valor do contrato.
- Cotações e propostas antigas receberam condições automáticas a partir das parcelas que já tinham.

## Erros comuns
- "Escolha a data de vencimento da entrada.": selecione o dia ou volte para "Na assinatura do contrato".
- "Escolha a data de vencimento do saldo.": selecione o dia do saldo.
- "O saldo não pode vencer antes da entrada.": escolha uma data igual ou posterior à da entrada.
- "Os marcos devem somar 100% do saldo.": ajuste os percentuais.
- "Todo marco precisa de nome.": preencha o nome do marco.
- "As parcelas não fecham com o valor do contrato.": o valor do contrato mudou depois da proposta; ajuste o valor ou as condições.
- "Sem permissão para gerar lançamentos financeiros.": peça a permissão de criar lançamentos no TechFinance.

## Relacionados
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)
- [Editar e enviar uma proposta](/ajuda/crm/editar-enviar-proposta)

## Na proposta e no contrato

Na proposta, as condições aparecem no quadro **Condições comerciais** (tela, link do cliente e PDF). Ao trocar o modelo de proposta, confirme em **Usar modelo**; o assistente continua aberto. No contrato gerado da proposta aceita, as condições aparecem na ficha e no texto do modelo pela variável **Condições de pagamento**.
