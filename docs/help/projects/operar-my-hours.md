---
module_key: projects
slug: operar-my-hours
title: Registrar e acompanhar minhas horas
summary: Registrar e acompanhar minhas horas no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/my-hours
min_permission: techprojects.time_entries.view.own
audience: internal
sort_order: 50
version: 1
is_published: true
---
# Registrar e acompanhar minhas horas

**Para que serve:** Horas confirmadas pelo servidor aparecem como apontamento; envio e aprovação são etapas posteriores.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.time_entries.view.own`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Minhas Horas (`/projects/my-hours`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Minhas Horas e selecione o dia ou semana que deseja conferir.
2. Abra o apontamento rápido e selecione Projeto e Atividade. Escolha início e término ou somente duração.
3. Informe data, descrição e se o trabalho é faturável; revise e salve. A atividade pode ser criada por texto quando a ação estiver disponível e autorizada.
4. Confira o apontamento na visão de horas; use as ações disponíveis para corrigir, duplicar ou remover somente registros permitidos.
5. Antes de enviar um período, revise os registros e a prévia de envio. Se habilitar a fila local, confira separadamente o que ainda aguarda sincronização.

## Resultado esperado
Horas confirmadas pelo servidor aparecem como apontamento; envio e aprovação são etapas posteriores.

## Regras e limites
Duração manual: mínimo de 1 minuto e máximo de 24 horas. No intervalo, término deve ser maior que início; sobreposição é recusada. Descrição tem até 2.000 caracteres. Edição de enviado/devolvido volta a rascunho. Competência fechada impede gravação.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Registrar e acompanhar minhas horas; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
