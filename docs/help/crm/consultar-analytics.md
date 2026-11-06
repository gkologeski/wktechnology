---
module_key: crm
slug: consultar-analytics
title: Consultar Analytics
summary: Acompanhar análises comerciais e indicadores de atendimento.
article_type: howto
route_pattern: /analytics
min_permission: system.analytics.insights.view.workspace
audience: internal
sort_order: 502
version: 2
is_published: true
---
# Consultar Analytics
**Para que serve:** Analisar funil, velocidade de vendas, coortes, sentimento, e-mails e SLA.
**Quem pode fazer:** Gestor+ ou `system.analytics.insights.view.workspace`.
**Onde fica:** Menu > TechSales > Otimizar > Analytics (`/analytics`).
**Antes de começar:** Tenha registros para a análise.

## Passo a passo
1. Ajuste "Período" e "Pipeline".
2. Abra "Funil".
3. Abra "Sales Velocity".
4. Abra "Cohort".
5. Abra "Sentimento".
6. Abra "E-mails 1:1".
7. Abra "SLA".
<!-- screenshot: filtros e abas de Analytics -->

## Resultado esperado
A aba mostra seus indicadores.

## Regras e limites
- "Todos" não restringe o pipeline.
- Os filtros valem para as abas "Funil", "Sales Velocity" e "Cohort".
- Sentimento depende das mensagens processadas.

## Erros comuns
- "Erro": a análise de sentimento falhou sem detalhe. Tente de novo.

## Relacionados
- [Consultar o painel de vendas](/ajuda/crm/consultar-painel-de-vendas)
- [Configurar SLA por etapa](/ajuda/crm/configurar-sla-por-etapa)
