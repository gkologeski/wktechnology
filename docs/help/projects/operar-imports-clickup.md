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
version: 4
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

No fim da tela, a seção **Importação contínua** lê o ClickUp sozinha.

1. Ligue **Ligar importação contínua**.
2. Escolha a **Frequência**: a cada 1 hora, 6 horas, 12 horas, diariamente ou semanalmente. Nas duas últimas, escolha também o horário (Brasília) e, na semanal, o dia.
3. Escolha o que fazer a cada execução:
   - **Só gerar a prévia**: o sistema lê o ClickUp e deixa a organização pronta para revisão nesta tela.
   - **Importar automaticamente**: grava as tarefas em nome de quem ligou a agenda e completa os responsáveis já confirmados.
4. Clique em **Salvar agenda**. Para rodar na hora, clique em **Executar agora**.

Cuidados:
- Listas do ClickUp que **nunca foram importadas** ficam de fora da importação automática. A seção avisa quantas ficaram aguardando revisão.
- Nenhuma tarefa editada no sistema é sobrescrita e nada é duplicado. Horas nunca vêm do ClickUp.
- A leitura é feita aos poucos para respeitar o limite do ClickUp; uma execução grande pode levar vários minutos.
- Se quem ligou a agenda perder a permissão ou deixar de ser administrador ativo, a agenda é desligada.

- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Importar organização e tarefas do ClickUp](/help-media/projects/operar-imports-clickup.webp)
