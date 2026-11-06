---
module_key: crm
slug: exportar-contatos
title: Exportar contatos
summary: Exportar contatos.
article_type: howto
route_pattern: /contacts
min_permission:
audience: internal
sort_order: 117
version: 1
is_published: true
---
# Exportar contatos
**Para que serve:** Exportar contatos.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. Exige `techsales.contacts.export.workspace`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Ajuste os filtros e confira a página exibida.
2. Clique em "Exportar" e escolha o formato desejado.
3. Salve o arquivo gerado e confira seu conteúdo.
<!-- screenshot: Exportar contatos: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Um arquivo é gerado com os registros carregados na página.
## Regras e limites
Não é uma exportação de todos os resultados do filtro. Os formatos disponíveis são CSV, JSON e XLSX. "Exportar selecionados" considera os selecionados presentes nas linhas carregadas; não conte com registros de outras páginas.
## Erros comuns
"Nenhum registro para exportar": ajuste os filtros para carregar resultados.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
