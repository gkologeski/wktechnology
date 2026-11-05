---
module_key: people
slug: consultar-margem-contrato
title: Consultar margem por contrato
summary: Ver horas, receita, custo e margem de cada contrato no período.
article_type: howto
route_pattern: /people/contract-margin
min_permission: techpeople.allocations.view.own
audience: internal
sort_order: 82
version: 1
is_published: true
---
# Consultar margem por contrato
**Para que serve:** Ver quanto cada contrato rende em horas, receita, custo e margem.
**Quem pode fazer:** Quem tem `techpeople.allocations.view` (ou é gestor) e pode ver os valores de todas as alocações (`techpeople.allocations_financial.view`).
**Onde fica:** Menu > TechPeople > Benefícios & custos > Margem por contrato (`/people/contract-margin`).
**Antes de começar:** Horas lançadas nas alocações.

## Passo a passo
1. Ajuste o "Período dos contratos" (padrão: início do mês até hoje).
2. Confira "Horas totais", "Receita", "Custo" e "Margem".
3. Na tabela "Contratos", clique no contrato para abri-lo.
<!-- screenshot: margem por contrato -->

## Resultado esperado
Cada contrato mostra pessoas, horas, receita, custo, margem e %.

## Regras e limites
- Entram todas as horas do período, aprovadas ou não.
- Receita = horas billable × tarifa (do apontamento ou da alocação).
- Custo = todas as horas × custo/hora da alocação.
- Não inclui impostos, despesas ou benefícios.
- Tela só de consulta.

## Erros comuns
- "Sem permissão para consultar os valores de todas as alocações do relatório.": peça acesso aos valores financeiros.

## Relacionados
- [Faturar horas aprovadas](/ajuda/people/faturar-horas)
