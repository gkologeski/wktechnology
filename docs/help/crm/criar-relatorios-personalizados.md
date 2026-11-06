---
module_key: crm
slug: criar-relatorios-personalizados
title: Criar relatórios personalizados
summary: Configurar agrupamentos, métricas e visualizações e salvar relatórios.
article_type: howto
route_pattern: /reports
min_permission: system.analytics.reports.view.workspace
audience: internal
sort_order: 503
version: 2
is_published: true
---
# Criar relatórios personalizados
**Para que serve:** Montar consultas resumidas sobre o CRM e salvar a configuração.
**Quem pode fazer:** Gestor+ ou `system.analytics.reports.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Relatórios (`/reports`).
**Antes de começar:** Defina a entidade e o indicador.

## Passo a passo
1. Em "Salvos", clique em "Novo".
2. Escolha "Entidade" e "Agrupar por".
3. Escolha "Métrica" e, se numérica, o "Campo".
4. Escolha "Visualização": "Barras", "Linha", "Pizza" ou "Tabela".
5. Ajuste "Período por" e "Período", quando houver.
6. Clique em "Executar".
7. Preencha "Nome *" e, se quiser, "Descrição".
8. Clique em "Salvar".
9. Para reabrir, clique no relatório em "Salvos".
10. Use a estrela para favoritar ou a lixeira para excluir ("Excluir relatório?").
<!-- screenshot: configuração de entidade, métrica e visualização -->

## Resultado esperado
O relatório aparece em "Salvos" e pode ir para um painel.

## Regras e limites
- "Contagem" não exige campo numérico.
- Agrupamentos e períodos variam por entidade.
- O botão "CSV" exporta os resultados exibidos. Ele fica desabilitado sem resultados.

## Erros comuns
- "Informe o nome.": preencha "Nome *".
- "Erro": falha sem detalhe; tente de novo.

## Relacionados
- [Gerenciar painéis de relatórios](/ajuda/crm/gerenciar-paineis)
