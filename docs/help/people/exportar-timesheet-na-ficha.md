---
module_key: people
slug: exportar-timesheet-na-ficha
title: Filtrar e exportar o timesheet da ficha
summary: Baixar em CSV os apontamentos visíveis após os filtros da aba.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.timesheet.view.own
audience: internal
sort_order: 123
version: 1
is_published: true
---
# Filtrar e exportar o timesheet da ficha

**Para que serve:** Baixar em CSV os apontamentos visíveis após os filtros da aba.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. O botão CSV usa os dados já carregados; não há chave de exportação específica nesse componente.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** Abra a pessoa correta e tenha pelo menos uma linha no recorte desejado.

## Passo a passo
1. Escolha o período: semana, mês, últimos 30 dias, trimestre ou personalizado. Para personalizado, ajuste início e fim.
2. Aplique os filtros de projeto, aprovação e tipo faturável/interno. Confira a lista resultante.
3. Clique em "CSV" no cabeçalho de Apontamentos. Não é necessário selecionar caixas.
4. Abra o arquivo baixado como UTF-8, com separador ponto e vírgula. Confira datas, linhas e colunas antes de compartilhar.

## Resultado esperado
O navegador baixa um CSV cujo nome inclui o prefixo timesheet, parte do identificador da pessoa e o intervalo.

## Regras e limites
- A exportação considera todas as linhas filtradas, não apenas as selecionadas. CSV fica desabilitado sem linhas.
- O arquivo tem Data, Projeto, Tarefa, Descrição, Horas, Billable, Tarifa efetiva, Valor, Custo/h, Custo e Status.
- O CSV usa BOM UTF-8 e ponto e vírgula. Campos numéricos são serializados pelo código, não como moeda formatada.
- Na geração do CSV, tarifa ou custo ausentes são convertidos em zero. Isso não comprova tarifa gratuita nem custo efetivamente zero; confira as permissões e a origem dos valores.
- Os cartões de totais vêm do período carregado; os filtros locais de projeto/status/tipo recortam as linhas exportadas, não recalculam esses totais.

## Erros comuns
- CSV desabilitado: amplie o período ou remova filtros.
- Valores zero inesperados: confira se a tarifa/custo existe e está acessível; não use o arquivo como comprovação financeira sem revisão.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
