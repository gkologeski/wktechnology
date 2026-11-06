---
module_key: projects
slug: permissoes
title: Permissões do TechProjects
summary: Permissões do TechProjects no TechProjects: operação, acesso e limites comprovados no código.
article_type: reference
route_pattern: 
min_permission: 
audience: internal
sort_order: 320
version: 1
is_published: true
---
# Permissões do TechProjects
## Requisitos comuns
Acesso pretendido: membro ativo, workspace ativo, módulo licenciado e permissão efetiva. Negação prevalece. Escopos own, team e workspace não são intercambiáveis. Menu é navegação; a tela, o registro, as funções e o banco podem negar uma ação mesmo quando o item aparece.
## Menu e suas chaves declaradas
A tabela reproduz o contrato estático do menu, não certifica autorização de URL nem concede acesso.

| Item | Rota | need declarado | permissionAny (alternativas) |
|---|---|---|---|
| Dashboard | `/projects/dashboard` | sem need | `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace`, `techprojects.tasks.view.own`, `techprojects.tasks.view.team`, `techprojects.tasks.view.workspace` |
| My Work | `/projects/my-work` | sem need | `techprojects.my_work.view.own`, `techprojects.my_work.view.team`, `techprojects.my_work.view.workspace` |
| Espaços | `/projects/spaces` | manager | `techprojects.spaces.view.team`, `techprojects.spaces.view.workspace` |
| Projetos | `/projects` | manager | `techprojects.projects.view.own`, `techprojects.projects.view.team`, `techprojects.projects.view.workspace` |
| Tarefas | `/projects/tasks` | sem need | `techprojects.tasks.view.own`, `techprojects.tasks.view.team`, `techprojects.tasks.view.workspace` |
| Minhas Horas | `/projects/my-hours` | sem need | `techprojects.time_entries.view.own`, `techprojects.time_entries.view.workspace` |
| Revisão de Horas | `/projects/hours-review` | manager | `techprojects.time_entries.approve.workspace`, `techprojects.timesheet.approve.workspace`, `techprojects.time_entries.view.own` |
| Timesheet | `/projects/timesheet` | manager | `techprojects.timesheet.view.team`, `techprojects.timesheet.view.workspace` |
| Importar do Clockify | `/projects/settings/imports/clockify` | admin | sem chave; min_permission vazio |
| Importar do Jibble | `/projects/settings/imports/jibble` | admin | sem chave; min_permission vazio |
| Importar do ClickUp | `/projects/settings/imports/clickup` | admin | sem chave; min_permission vazio |
| Conciliação de horas | `/projects/settings/imports/reconciliation` | admin | sem chave; min_permission vazio |
| Entrega de negócios | `/projects/settings/delivery` | admin | sem chave; min_permission vazio |
| Política de horas e modelos | `/projects/settings/time` | admin | `techprojects.time_policy.view.workspace`, `techprojects.delivery_templates.view.workspace` |
| Tarifas e custos | `/projects/settings/rates` | admin | `techprojects.rates.view.workspace` |
| Operação e saúde | `/projects/settings/operations` | admin | sem chave; min_permission vazio |

## Ações e dados sensíveis
- Projetos, tarefas, espaços, pastas, listas, marcos e membros têm capacidades por recurso e registro. Criar, atualizar e excluir não decorrem de view.
- Status, campos personalizados e templates de lista exigem gestão dos recursos correspondentes.
- Horas: consultar, apontar, enviar, aprovar, registrar aceite e fechar/reabrir competência são operações distintas. A fila exige elegibilidade de decisão; não presuma autoaprovação.
- Acompanhamento macro usa project_updates para criar, atualizar e excluir.
- Tarifas: leitura por `techprojects.rates.view.workspace`, gestão por `techprojects.rates.manage.workspace`.
- Rentabilidade e medições têm recursos próprios; custos e receitas são projetados conforme acesso, não liberados por visualizar projeto.
- Conciliação e operação exigem administrador ativo do workspace ativo. Conciliação não permite gravação em Ver Como.
- Importação exige autorização do recurso da fonte e suas verificações administrativas; configurar conexão não concede acesso a outros workspaces.
## Quando o menu aparece mas a operação é negada
Solicite ao administrador revisão do recurso, ação e escopo; informe apenas a rota e a mensagem sanitizada. Não compartilhe credenciais nem exporte dados para contornar bloqueios. A divergência entre fallback de menu e política de negação está registrada no relatório de auditoria, fora dos artigos operacionais.
## Leitura da Ajuda
Artigos são internos e filtrados no servidor por módulo e min_permission. Uma única chave de referência não representa toda a lista permissionAny; a compatibilidade dos leitores com escopos alternativos precisa ser tratada antes de publicar.
