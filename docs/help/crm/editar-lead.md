---
module_key: crm
slug: editar-lead
title: Editar lead
summary: Editar lead.
article_type: howto
route_pattern: /leads/$id
min_permission:
audience: internal
sort_order: 103
version: 1
is_published: true
---
# Editar lead
**Para que serve:** Editar lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.leads.update.own` ou `techsales.leads.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads/$id`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Abra o registro pela listagem.
2. No painel de propriedades, clique no campo que deseja alterar.
3. Informe o novo valor e saia do campo para concluir a edição.
4. Confira a mensagem "Atualizado".
<!-- screenshot: Editar lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A propriedade editada aparece atualizada na ficha.
## Regras e limites
A gravação ocorre por campo. Campos e opções dependem do catálogo da entidade e das permissões. Registros acessíveis apenas por vínculo podem mostrar somente um resumo, sem edição.
## Erros comuns
"Email inválido.": revise o endereço. "CNPJ inválido.": revise o documento, quando o campo existir. "CEP inválido. Use 8 dígitos (99999-999).": corrija o CEP, quando disponível.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
