---
module_key: crm
slug: exportar-empresas
title: Exportar empresas
summary: Exportar empresas.
article_type: howto
route_pattern: /companies
min_permission:
audience: internal
sort_order: 126
version: 1
is_published: true
---
# Exportar empresas
**Para que serve:** Exportar empresas.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.companies.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar" e escolha o formato desejado.
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar empresas: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Os formatos disponíveis são CSV, JSON e XLSX. "Exportar selecionados" considera os selecionados presentes nas linhas carregadas; não conte com registros de outras páginas.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
