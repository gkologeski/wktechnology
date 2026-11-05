---
module_key: projects
slug: consultar-projetos
title: Consultar e criar projetos
summary: Consultar e criar projetos no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects
min_permission: techprojects.projects.view.own
audience: internal
sort_order: 30
version: 1
is_published: true
---
# Consultar e criar projetos

**Para que serve:** O projeto criado aparece na listagem disponível ao seu usuário e pode ser aberto pela ficha.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.projects.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Projetos (`/projects`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > Projetos e busque pelo nome ou filtre o status. Confira os resultados antes de selecionar registros.
2. Abra a criação de projeto, informe Nome e, quando necessário, Descrição, Prazo e Horas planejadas. Salve e aguarde a confirmação.
3. Abra o projeto para consultar tarefas, marcos, timesheet e membros. Use a seleção da grade apenas depois de revisar os filtros e o escopo da ação.

## Resultado esperado
O projeto criado aparece na listagem disponível ao seu usuário e pode ser aberto pela ficha.

## Regras e limites
O nome é obrigatório. Criar projeto exige capacidade de criação; consultar não autoriza editar nem excluir. A grade usa filtros e seleção; a seleção não altera as permissões de cada registro.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar e criar projetos; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
