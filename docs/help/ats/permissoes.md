---
module_key: ats
slug: permissoes
title: Permissões do TechHire
summary: Quem vê, cria, edita e exclui em cada tela.
article_type: reference
route_pattern: 
min_permission: 
audience: internal
sort_order: 4
version: 1
is_published: true
---
# Permissões do TechHire

| Tela | Ver | Criar | Outras ações |
|---|---|---|---|
| Candidatos | `techhire.candidates.view` | `techhire.candidates.create` | Exportar: `.export.workspace`; Atribuir: `.assign.workspace` |
| Vagas | `techhire.jobs.view` | `techhire.jobs.create` | Publicar: `.publish.workspace`; Exportar: `.export.workspace` |
| Pipelines | `techhire.pipelines.view` | `.create` | Padrão: `.update.workspace` |
| Scorecards | `techhire.scorecards.view` | `.create` | Editar e excluir por registro |
| Kits de entrevista | `techhire.interview_kits.view` | `.create` | Padrão: `.update.workspace` |
| Scheduling | `techhire.interviews` / `interviewer_pools` | Pool: `.create` | — |
| Ofertas | `techhire.offers` | — | Enviar, cancelar e excluir por registro |
| LGPD | `techhire.compliance.view` | `.create` | Exportar e anonimizar por registro |
| Contratar | — | `techpeople.people.create` | — |

Escopos: own (seus registros), team (do time) e workspace (todos). Deny sempre prevalece.

As telas de Hunting, Sourcing, E-mails por etapa e as de IA ainda não têm permissão própria: qualquer membro ativo com o módulo entra, e os dados ficam limitados ao workspace. Isso está registrado como divergência.

## Relacionados

- [Erros comuns](/ajuda/ats/erros-comuns)
