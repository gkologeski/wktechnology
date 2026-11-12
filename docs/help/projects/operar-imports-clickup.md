---
module_key: projects
slug: operar-imports-clickup
title: Importar organização e tarefas do ClickUp
summary: Importar organização e tarefas do ClickUp no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/imports/clickup
min_permission: 
audience: internal
sort_order: 80
version: 3
is_published: true
---
# Importar organização e tarefas do ClickUp

**Para que serve:** As listas e tarefas lidas são importadas conforme as decisões de organização e responsáveis.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Importar do ClickUp (`/projects/settings/imports/clickup`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Importar do ClickUp e use a leitura da origem disponível.
2. Espere a leitura concluir. Em Organização, revise onde cada lista será criada ou vinculada no TechProjects.
3. Em Responsáveis, confira os vínculos com membros existentes. Quando usar criação de identidade, confira que será um membro inativo e sem acesso.
4. Execute a etapa de importação disponível após revisar organização e responsáveis. Confira o resultado de cada etapa.

## Resultado esperado
As listas e tarefas lidas são importadas conforme as decisões de organização e responsáveis.

## Regras e limites
Leitura e importação são etapas separadas. Identidade inativa preserva atribuição sem liberar login. Não prometa mapeamento por similaridade de nome nem sincronização contínua.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
## Importação contínua

A importação contínua ainda não está disponível para o ClickUp, porque cada etapa exige revisão. Continue usando a importação manual.

- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Importar organização e tarefas do ClickUp](/help-media/projects/operar-imports-clickup.webp)
