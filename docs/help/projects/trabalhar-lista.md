---
module_key: projects
slug: trabalhar-lista
title: Trabalhar em uma lista
summary: Trabalhar em uma lista no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/lists/$id
min_permission: techprojects.spaces.view.team
audience: internal
sort_order: 40
version: 1
is_published: true
---
# Trabalhar em uma lista

**Para que serve:** As visualizações representam as tarefas da mesma lista; alterações confirmadas aparecem nas consultas seguintes.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.spaces.view.team`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Espaços (`/projects/lists/$id`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra uma lista pela árvore de Espaços.
2. Alterne entre quadro, lista, calendário, linha do tempo e carga de trabalho conforme a informação que precisa consultar.
3. Crie uma tarefa quando autorizado; abra sua ficha para atualizar campos, tags, checklist e dependências.
4. No quadro, mova o status somente quando tiver capacidade de alteração. Confira o resultado após salvar.
5. Use os controles de status, campos personalizados e templates somente com a permissão de gestão correspondente.

## Resultado esperado
As visualizações representam as tarefas da mesma lista; alterações confirmadas aparecem nas consultas seguintes.

## Regras e limites
Gerenciar status, campos personalizados e templates não é a mesma permissão de criar tarefas. Excluir tarefa exige capacidade no registro; não presuma exclusão em cascata.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Trabalhar em uma lista; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
