---
module_key: crm
slug: excluir-empresas-em-massa
title: Excluir empresas em massa
summary: Excluir empresas em massa.
article_type: howto
route_pattern: /companies
min_permission:
audience: internal
sort_order: 123
version: 1
is_published: true
---
# Excluir empresas em massa
**Para que serve:** Excluir empresas em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.companies.delete.workspace`, `techsales.companies.manage.workspace` ou `techsales.companies.delete.own` para registro próprio. A barra da lista usa as chaves delete.own e delete.workspace. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Marque os registros desejados na listagem.
2. Clique em "Excluir" na barra de seleção.
3. Revise a quantidade e confirme.
4. Confira se a mensagem informa exclusão completa ou parcial.
<!-- screenshot: Excluir empresas em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
Os registros autorizados são removidos e a listagem é atualizada.
## Regras e limites
A seleção não amplia suas permissões. Confira o total antes de confirmar. Uma operação pode remover apenas parte dos registros.
## Erros comuns
Se a mensagem indicar exclusão parcial, atualize a lista e peça revisão das permissões. "Você não tem permissão para excluir este registro.": solicite revisão de acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
