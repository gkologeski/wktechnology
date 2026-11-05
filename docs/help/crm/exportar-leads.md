---
module_key: crm
slug: exportar-leads
title: Exportar leads
summary: Exportar leads.
article_type: howto
route_pattern: /leads
min_permission:
audience: internal
sort_order: 108
version: 1
is_published: true
---
# Exportar leads
**Para que serve:** Exportar leads.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.leads.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar".
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar leads: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Leads usa CSV e colunas fixas; selecionar linhas não muda o conteúdo desta exportação.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
