---
module_key: crm
slug: acompanhar-negocios
title: Acompanhar negócios
summary: Consultar negócios nas diferentes visualizações e iniciar uma fila com os resultados.
article_type: howto
route_pattern: /deals
min_permission:
audience: internal
sort_order: 200
version: 2
is_published: true
---
# Acompanhar negócios
**Para que serve:** Consultar o funil comercial e percorrer os negócios encontrados.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Criar negócios exige a permissão correspondente de `techsales.deals`, como `techsales.deals.create.own`.
**Onde fica:** Menu > TechSales > Negócios (`/deals`).
**Antes de começar:** Tenha acesso ao funil e aos negócios que deseja consultar.

## Passo a passo
1. Abra "Negócios".
2. Alterne entre as visualizações disponíveis para consultar a tabela, o quadro, a lista ou a previsão.
3. Ajuste os filtros antes de trabalhar com os resultados.
4. Para percorrer os resultados, clique em "Iniciar fila".
5. Para cadastrar um registro, clique em "Criar negócio" e preencha o formulário. O botão só aparece para quem pode criar negócios.
<!-- screenshot: cabeçalho de Negócios com visualizações, filtros, Criar negócio e Iniciar fila -->

## Resultado esperado
Os negócios aparecem na visualização escolhida. A fila usa os negócios do filtro atual.

## Regras e limites
- O acesso aos registros depende das permissões e do escopo do usuário.
- A fila não inclui automaticamente todos os negócios do ambiente: ela parte dos resultados atuais.
- A criação só deve ficar disponível para quem tem permissão de criar.

## Erros comuns
- "Nenhum negócio para percorrer.": revise os filtros e confirme que existem resultados.
- Se um negócio não aparecer, confira o funil, os filtros e seu acesso ao registro.

## Relacionados
- [Atualizar um negócio](/ajuda/crm/atualizar-negocio)
- [Permissões](/ajuda/crm/permissoes)
