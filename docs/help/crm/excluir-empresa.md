---
module_key: crm
slug: excluir-empresa
title: Excluir empresa
summary: Excluir empresa.
article_type: howto
route_pattern: /companies/$id
min_permission:
audience: internal
sort_order: 122
version: 1
is_published: true
---
# Excluir empresa
**Para que serve:** Excluir empresa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.companies.delete.workspace`, `techsales.companies.manage.workspace` ou `techsales.companies.delete.own` para registro próprio. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha do registro.
2. Clique no ícone "Excluir empresa".
3. Revise a confirmação e confirme a exclusão.
<!-- screenshot: Excluir empresa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Excluído" aparece e a navegação volta à listagem.
## Regras e limites
A ação depende da permissão sobre o registro. Não há restauração nesta ficha. Não confirme se precisar preservar o cadastro.
## Erros comuns
"Você não tem permissão para excluir este registro.": solicite ao administrador a revisão do acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
