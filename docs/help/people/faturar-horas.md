---
module_key: people
slug: faturar-horas
title: Faturar horas aprovadas
summary: Gerar fatura em rascunho com as horas billable aprovadas de uma alocação.
article_type: howto
route_pattern: /people/billing
min_permission: techpeople.timesheet.view.own
audience: internal
sort_order: 81
version: 1
is_published: true
---
# Faturar horas aprovadas
**Para que serve:** Transformar horas billable aprovadas em fatura.
**Quem pode fazer:** Ver a tela e gerar fatura exige criar e ver faturas (`techfinance.invoices` ou `techsales.invoices`). O menu aparece com `techpeople.timesheet.view` ou `.approve`, ou para gestores.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Faturamento de horas (`/people/billing`).
**Antes de começar:** As horas precisam estar lançadas como billable na ficha.

## Passo a passo
1. Em "Período", escolha as datas ou use "Limpar período".
2. Confira "Horas pendentes" e "Valor pendente".
3. Se houver horas sem aprovação na alocação, clique em "Aprovar pendentes".
4. Clique em "Faturar".
5. Confira o resumo, escolha o "Vencimento" (padrão: hoje + 15 dias) e clique em "Gerar fatura".
<!-- screenshot: faturamento de horas -->

## Resultado esperado
"Fatura {número} criada — {N} apontamento(s) vinculado(s)." A fatura nasce em rascunho.

## Regras e limites
- Só entram horas aprovadas, billable e ainda sem fatura.
- Valor = horas × tarifa do apontamento.
- A alocação só aparece se já tiver pelo menos uma hora aprovada.

## Erros comuns
- "Nenhuma hora aprovada e disponível para faturamento.": aprove as horas antes.
- "Ação financeira não autorizada.": falta permissão de faturas.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
