---
module_key: projects
slug: gerenciar-campos-lista
title: Gerenciar campos personalizados da lista
summary: Gerenciar campos personalizados da lista no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: 
min_permission: 
audience: internal
sort_order: 270
version: 1
is_published: true
---
# Gerenciar campos personalizados da lista

**Para que serve:** A definição de campo fica disponível na lista para preenchimento nas tarefas.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Espaços > Lista > Tarefa (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra uma lista e acione o gerenciador de campos personalizados.
2. Confira os campos existentes antes de cadastrar outro.
3. Preencha a definição no formulário exibido e confirme a criação.
4. Para remover, confira o campo selecionado e a confirmação; depois revise a ficha das tarefas.

## Resultado esperado
A definição de campo fica disponível na lista para preenchimento nas tarefas.

## Regras e limites
Exige capacidade manage em techprojects.custom_fields. Não confunda remover a definição com limpar um único valor de tarefa.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Gerenciar campos personalizados da lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
