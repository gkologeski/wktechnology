---
module_key: projects
slug: operar-my-work
title: Organizar o Meu trabalho
summary: Organizar o Meu trabalho no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/my-work
min_permission: techprojects.my_work.view.own
audience: internal
sort_order: 60
version: 3
is_published: true
---
# Organizar o Meu trabalho

**Para que serve:** O usuário identifica trabalho pendente e acompanha sua atividade sem consultar toda a carteira.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.my_work.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Meu trabalho (`/projects/my-work`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Projetos > Meu trabalho.
2. Revise Hoje, Atrasadas e Próximos 7 dias. Abra uma tarefa para conferir seus dados.
3. Consulte os apontamentos disponíveis antes de registrar novo trabalho. O cronômetro está indisponível.

## Resultado esperado
O usuário identifica trabalho pendente e acompanha sua atividade sem consultar toda a carteira.

## Regras e limites
A visão pessoal não concede acesso a projetos de outros usuários. Prazo e responsável afetam a organização das tarefas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

![Tela: Organizar o Meu trabalho](/help-media/projects/operar-my-work.webp)

## Atualização de navegação e consistência
**Meu trabalho** abre cada tarefa diretamente na lista de tarefas com o painel contextual. Próximos 7 dias inclui os sete dias seguintes à data atual. Havendo mais tarefas, clique **Carregar mais tarefas**; enquanto houver outra página, os indicadores são parciais e mostram +. As horas da semana vêm do agregado completo e falha de consulta não aparece como zero. O cronômetro está indisponível: use **Minhas Horas → Apontar horas**.
