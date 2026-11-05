---
module_key: crm
slug: excluir-lead
title: Excluir lead
summary: Excluir lead.
article_type: howto
route_pattern: /leads/$id
min_permission:
audience: internal
sort_order: 104
version: 1
is_published: true
---
# Excluir lead
**Para que serve:** Excluir lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A ficha aceita `techsales.leads.delete.workspace`, `techsales.leads.manage.workspace`, `techsales.leads.delete.team` ou `techsales.leads.delete.own`, conforme o registro. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra a ficha do registro.
2. Clique no ícone "Excluir lead".
3. Revise a confirmação e confirme a exclusão.
<!-- screenshot: Excluir lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Excluído" aparece e a navegação volta à listagem.
## Regras e limites
A ação depende da permissão sobre o registro. Não há restauração nesta ficha. Não confirme se precisar preservar o cadastro.
## Erros comuns
"Você não tem permissão para excluir este registro.": solicite ao administrador a revisão do acesso.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
