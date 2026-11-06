---
module_key: people
slug: consultar-beneficios
title: Consultar benefícios e custos
summary: Ver os benefícios ativos de todo o workspace e o total mensal.
article_type: howto
route_pattern: /people/benefits
min_permission: techpeople.benefits.view.own
audience: internal
sort_order: 60
version: 1
is_published: true
---
# Consultar benefícios e custos
**Para que serve:** Ver todos os benefícios ativos e quanto custam por mês.
**Quem pode fazer:** Quem tem `techpeople.benefits.view` (ou é gestor). Editar exige `techpeople.benefits.update`; excluir, `techpeople.benefits.delete`.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Benefícios (`/people/benefits`).
**Antes de começar:** Os benefícios são cadastrados na ficha da pessoa, aba "Benefícios".

## Passo a passo
1. Abra a tela. O topo mostra "Total mensal:".
2. Use "Buscar nesta lista…" ou clique no cabeçalho para ordenar.
3. Clique no nome em "Pessoa" para abrir a ficha.
4. Para alterar vários: marque as linhas, clique em "Editar em massa", marque "Provedor", "Plano" ou "Término", preencha e clique em "Aplicar".
5. Para exportar: "Exportar" e escolha CSV, JSON ou Excel (XLSX).
<!-- screenshot: benefícios -->

## Resultado esperado
"{N} registro(s) atualizado(s)" ou o arquivo exportado.

## Regras e limites
- Só aparecem benefícios ativos, até 500.
- "Total mensal:" soma o valor mensal; não desconta a "Cota empregado".
- Esta tela não cadastra benefício novo.

## Erros comuns
- "{alterados} de {selecionados} atualizado(s). Verifique suas permissões.": parte dos registros está fora do seu acesso.
- "Nenhum benefício ativo": cadastre na ficha da pessoa.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
