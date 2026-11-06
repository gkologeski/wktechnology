---
module_key: projects
slug: operar-timesheet
title: Consultar o timesheet da equipe
summary: Consultar o timesheet da equipe no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/timesheet
min_permission: techprojects.timesheet.view.team
audience: internal
sort_order: 190
version: 1
is_published: true
---
# Consultar o timesheet da equipe

**Para que serve:** O timesheet apresenta os apontamentos que seu escopo permite consultar na semana.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. A chave de referência do menu é `techprojects.timesheet.view.team`; alternativas e escopos constam em [Permissões](/ajuda/projects/permissoes).

**Onde fica:** TechProjects > Timesheet (`/projects/timesheet`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Horas > Timesheet.
2. Navegue para a semana desejada e confira os totais e os registros apresentados.
3. Revise descrição e situação antes de comparar pessoas ou projetos.
4. Quando precisar decidir horas, abra Revisão de Horas: consulta de timesheet não é aprovação.

## Resultado esperado
O timesheet apresenta os apontamentos que seu escopo permite consultar na semana.

## Regras e limites
Meta depende da jornada configurada no People. Ausência de jornada não significa falta nem meta zero. Horas importadas travadas não são aprovadas.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar o timesheet da equipe; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
