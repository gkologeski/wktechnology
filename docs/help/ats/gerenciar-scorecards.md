---
module_key: ats
slug: gerenciar-scorecards
title: Gerenciar scorecards
summary: Criar modelos de avaliação com critérios e pesos.
article_type: howto
route_pattern: /scorecards
min_permission: techhire.scorecards.view.own
audience: internal
sort_order: 33
version: 1
is_published: true
---
# Gerenciar scorecards
**Para que serve:** Avaliar candidatos de forma comparável.
**Quem pode fazer:** Ver exige `techhire.scorecards.view`. Criar exige `.create`. Editar depende da permissão sobre o scorecard.
**Onde fica:** Menu > TechHire > Recrutamento > Scorecards (`/scorecards`).
**Antes de começar:** Defina os critérios.

## Passo a passo
1. Clique em "Novo scorecard".
2. Preencha "Nome" e "Descrição".
3. Em "Critérios (escala 0–5)", clique em "Critério" para adicionar e defina chave, rótulo e peso.
4. Clique em "Salvar".
<!-- screenshot: scorecards -->

## Resultado esperado
"Scorecard salvo".

## Regras e limites
- De 1 a 20 critérios; peso de 0,1 a 10.
- Notas de 0 a 5.
- Excluir pede: "Excluir scorecard?".

## Erros comuns
- "Informe nome e ao menos um critério": complete o formulário.

## Relacionados
- [Gerenciar kits de entrevista](/ajuda/ats/gerenciar-kits-entrevista)
