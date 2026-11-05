---
module_key: crm
slug: gerenciar-macros
title: Gerenciar macros
summary: Criar e manter textos reutilizáveis para atendimento.
article_type: howto
route_pattern: /settings/macros
min_permission: system.automation.macros.view.workspace
audience: internal
sort_order: 513
version: 2
is_published: true
---
# Gerenciar macros
**Para que serve:** Manter textos reutilizáveis com atalho e personalização.
**Quem pode fazer:** Gestor+ ou `system.automation.macros.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Macros (`/settings/macros`).
**Antes de começar:** Prepare o texto.

## Passo a passo
1. Abra a criação de macro. A janela se chama "Nova macro".
2. Preencha "Nome *".
3. Informe "Atalho" e "Categoria", se quiser.
4. Preencha "Corpo *".
5. Use os campos de personalização.
6. Ajuste "Ativa" e salve.
7. Para alterar, abra a edição e salve.
8. Para excluir, use a lixeira e confirme "Excluir esta macro?".
<!-- screenshot: edição de macro -->

## Resultado esperado
"Macro criada." ou "Macro atualizada.".

## Regras e limites
- Nome e corpo obrigatórios.
- Exemplo de atalho: "ola-cliente".
- Personalização como "{{contact_first_name}}".

## Erros comuns
- "Informe nome e corpo.": preencha os dois.

## Relacionados
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)
