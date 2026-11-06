---
module_key: people
slug: gerenciar-incidentes
title: Gerenciar incidentes
summary: Acompanhar incidentes de segurança, assédio e discriminação em tabela ou kanban.
article_type: howto
route_pattern: /people/incidents
min_permission: techpeople.incidents.view.own
audience: internal
sort_order: 70
version: 1
is_published: true
---
# Gerenciar incidentes
**Para que serve:** Acompanhar incidentes de segurança, assédio, discriminação e quase-acidentes.
**Quem pode fazer:** Quem tem `techpeople.incidents.view` ou `techpeople.wellbeing.incidents.view` (ou é gestor). Mudar status exige `.update`; excluir, `.delete`.
**Onde fica:** Menu > TechPeople > Saúde & segurança > Incidentes (`/people/incidents`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Em "Severidade", escolha "Todas as severidades", "Baixa", "Moderada", "Alta" ou "Crítica".
2. Alterne entre "Visualizar em tabela" e "Visualizar em kanban".
3. No kanban, arraste o cartão para outra coluna ou use "Mover para outra etapa".
4. Na tabela, marque linhas e clique em "Editar em massa" para mudar "Severidade" ou "Status". Clique em "Aplicar".
<!-- screenshot: incidentes kanban -->

## Resultado esperado
"Etapa atualizada" no kanban ou "{N} registro(s) atualizado(s)" na tabela.

## Regras e limites
- Status: "Aberto", "Investigando", "Resolvido", "Arquivado".
- Categorias: "Segurança", "Assédio", "Discriminação", "Psicossocial", "Quase-acidente", "Acidente", "Outro".
- Esta tela não registra incidente novo.

## Erros comuns
- "Você não tem permissão para esta ação": peça revisão do seu perfil ao administrador.

## Relacionados
- [Consultar riscos psicossociais](/ajuda/people/consultar-riscos-psicossociais)
