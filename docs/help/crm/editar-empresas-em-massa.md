---
module_key: crm
slug: editar-empresas-em-massa
title: Editar campos de empresas em massa
summary: Editar campos de empresas em massa.
article_type: howto
route_pattern: /companies
min_permission:
audience: internal
sort_order: 124
version: 1
is_published: true
---
# Editar campos de empresas em massa
**Para que serve:** Editar campos de empresas em massa.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. A edição exige `techsales.companies.update.own` ou `techsales.companies.update.workspace`, dentro do escopo autorizado. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Empresas (`/companies`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Selecione os registros na listagem.
2. Clique em "Editar em massa".
3. Em "Propriedade a atualizar", escolha o campo e informe o novo valor.
4. Se necessário, clique em "Adicionar outra propriedade".
5. Clique em "Atualizar" e depois em "Confirmar alteração".
<!-- screenshot: Editar campos de empresas em massa: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem informa quantos registros foram atualizados.
## Regras e limites
No máximo 5.000 IDs por solicitação. Valor em branco limpa o campo, exceto quando obrigatório. Propriedades repetidas não são aceitas. Pipeline, etapa e substatus podem exigir seleção em cascata. 
## Erros comuns
"Nenhum registro foi alterado. Verifique suas permissões.": revise o escopo. "A mesma propriedade foi escolhida duas vezes.": remova a repetida. "Não foi possível carregar as propriedades.": clique em "Tentar novamente".
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
