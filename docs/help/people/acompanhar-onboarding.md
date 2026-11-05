---
module_key: people
slug: acompanhar-onboarding
title: Acompanhar onboarding
summary: Ver os planos de integração e o progresso de cada pessoa.
article_type: howto
route_pattern: /people/onboarding
min_permission: techpeople.onboarding.view.own
audience: internal
sort_order: 40
version: 1
is_published: true
---
# Acompanhar onboarding
**Para que serve:** Ver o andamento da integração de quem entrou.
**Quem pode fazer:** Quem tem `techpeople.onboarding.view` (own, team ou workspace).
**Onde fica:** Menu > TechPeople > Pessoas > Onboarding (`/people/onboarding`).
**Antes de começar:** O plano é iniciado na ficha da pessoa, aba "Onboarding".

## Passo a passo
1. Abra a tela.
2. Confira "Status", "Progresso", "Início" e "Alvo".
3. Clique em "Abrir" para ir à ficha e marcar as tarefas.
<!-- screenshot: onboarding -->

## Resultado esperado
Você vê quanto do checklist já foi feito.

## Regras e limites
- Status: "Não iniciado", "Em andamento", "Concluído", "Cancelado".
- Planos concluídos e cancelados também aparecem.
- Tarefas feitas ou puladas contam no progresso.

## Erros comuns
- "Você não tem permissão para consultar esta tela.": falta `techpeople.onboarding.view`.
- "Nenhum onboarding em andamento": inicie um plano na ficha.

## Relacionados
- [Criar modelos de onboarding](/ajuda/people/criar-modelos-onboarding)
- [Acompanhar offboarding](/ajuda/people/acompanhar-offboarding)
