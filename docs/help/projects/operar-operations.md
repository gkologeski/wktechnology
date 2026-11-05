---
module_key: projects
slug: operar-operations
title: Consultar operação e saúde do TechProjects
summary: Consultar operação e saúde do TechProjects no TechProjects: operação, acesso e limites comprovados no código.
article_type: howto
route_pattern: /projects/settings/operations
min_permission: 
audience: internal
sort_order: 140
version: 1
is_published: true
---
# Consultar operação e saúde do TechProjects

**Para que serve:** O administrador obtém uma visão de diagnóstico das operações do workspace.

**Quem pode fazer:** Membro ativo, no workspace ativo, com o módulo liberado e as capacidades de consulta e ação indicadas na tela. Configurações administrativas e ações sensíveis exigem autorização própria; menu visível não concede a ação.

**Onde fica:** TechProjects > Operação e saúde (`/projects/settings/operations`).

**Antes de começar:** Confirme o workspace e o período, confira o registro de destino e disponha da permissão para a ação. Para importações, revise a prévia antes da gravação.

## Passo a passo
1. Abra Configurações > Operação e saúde.
2. Confira os agendamentos esperados, as últimas execuções e as filas apresentadas.
3. Compare a situação da execução com a fila antes de relatar uma falha.
4. Em caso de erro, reúna apenas tipo de operação e mensagem sanitizada; solicite investigação administrativa sem compartilhar segredos.

## Resultado esperado
O administrador obtém uma visão de diagnóstico das operações do workspace.

## Regras e limites
Tela somente leitura para administrador ativo. Não fornece comando nem segredo de agendamento e não permite executar tarefas apenas ao consultar. Agendadores dependem de configuração externa e opt-in quando previsto.

## Erros comuns
- Registro indisponível ou sem permissão: confira o workspace, o escopo e a capacidade específica; não tente contornar por URL.
- Resultado diferente do esperado: confira filtros, período e confirmação da operação; uma consulta não confirma uma gravação.
- Falha ao salvar: leia a mensagem retornada, corrija os campos ou bloqueios indicados e confirme o estado antes de repetir.

## Relacionados
- [Campos e status](/ajuda/projects/campos-e-status)
- [Permissões](/ajuda/projects/permissoes)
- [Erros comuns](/ajuda/projects/erros-comuns)

<!-- screenshot: Consultar operação e saúde do TechProjects; usar workspace demonstrativo, sem nomes, horas, valores ou credenciais reais. -->
