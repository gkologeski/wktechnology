---
module_key: contracts
slug: consultar-rentabilidade
title: Consultar e exportar rentabilidade do contrato
summary: Consultar e exportar rentabilidade do contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 77
version: 1
is_published: true
---
# Consultar e exportar rentabilidade do contrato
**Para que serve:** Consultar e exportar rentabilidade do contrato.
**Quem pode fazer:** techprojects.profitability.view.workspace; exportação também profitability.export.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Contrato e intervalo disponíveis; acesso a tarifas/custos conforme restrições.

## Passo a passo
1. Em rentabilidade, ajuste "De", "Até" e "Moeda".
2. Compare "Receita aprovada (medida)", "Lançada no Financeiro", "Custo estimado" e "Margem estimada".
3. Confira a cobertura de custos e esforço.
4. Use "Exportar CSV" quando autorizado.
<!-- screenshot: Consultar e exportar rentabilidade do contrato, sem dados pessoais reais -->

## Resultado esperado
Consulta ou exportação de indicadores estimados; nenhuma geração ou cobrança executada.

## Regras e limites
- Intervalo de meses completos até 12 meses; moeda com três letras.
- Filtro de moeda não é conversão cambial.
- Custo parcial aparece como parcial; sem cobertura, desconhecido.
- Receita medida, título lançado e recebimento são diferentes.
- Margem estimada não equivale a lucro contábil realizado.

## Erros comuns
Custo desconhecido: revise cobertura e acesso, sem assumir custo zero.

## Relacionados
- [Fechar provisão mensal](/ajuda/contracts/fechar-provisao)
