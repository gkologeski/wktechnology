---
module_key: people
slug: permissoes
title: Permissões do TechPeople
summary: Quem vê, cria, edita e exclui em cada tela.
article_type: reference
route_pattern: 
min_permission: 
audience: internal
sort_order: 4
version: 1
is_published: true
---
# Permissões do TechPeople

As chaves seguem o formato `techpeople.<recurso>.<ação>.<escopo>`.

| Tela ou aba | Ver | Outras ações |
|---|---|---|
| Pessoas | `techpeople.people.view` | Criar: `.create`; editar/excluir por registro |
| Dados financeiros da pessoa | `techpeople.people_sensitive.view` | Editar: `.update` |
| Alocações | `techpeople.allocations.view` | Valores: `techpeople.allocations_financial.view` |
| Timesheet | `techpeople.timesheet.view` | Aprovar: `techpeople.timesheet.approve.workspace` |
| Metas, 1:1s, Avaliações | `techpeople.goals` / `one_on_ones` / `reviews` `.view` | Notas privadas de 1:1: `techpeople.one_on_ones_private` |
| Onboarding / Offboarding | `techpeople.onboarding.view` / `offboarding.view` | Criar plano: `.create` |
| Modelos de onboarding | `techpeople.onboarding_templates.view` | Criar: `.create`; editar/excluir por registro |
| Documentos | `techpeople.documents.view` | `.update`, `.delete` |
| Benefícios | `techpeople.benefits.view` | `.update`, `.delete` |
| Incidentes | `techpeople.incidents.view` | `.update`, `.delete` |
| Riscos psicossociais | `techpeople.wellbeing.assessments.view` | — |
| Histórico | `techpeople.events.view` | — |
| Contratação integrada | `techpeople.employment.view` | Gerir: `.manage.workspace` |
| Faturamento de horas | faturas do TechFinance (`view` + `create`) | — |

Escopos: own (seus registros), team (do time) e workspace (todos). Deny sempre prevalece. Membros inativos não acessam.

Várias telas de lista também aparecem para gestores pelo perfil. Mesmo assim, o servidor confere a permissão de cada ação.

## Relacionados
- [Erros comuns](/ajuda/people/erros-comuns)
