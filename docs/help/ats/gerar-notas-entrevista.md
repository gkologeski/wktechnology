---
module_key: ats
slug: gerar-notas-entrevista
title: Gerar notas de entrevista com IA
summary: Criar resumo e recomendação a partir da transcrição.
article_type: howto
route_pattern: /notetaker
min_permission: techhire.interviews.view.own
audience: internal
sort_order: 15
version: 1
is_published: true
---
# Gerar notas de entrevista com IA
**Para que serve:** Registrar a entrevista sem digitar tudo.
**Quem pode fazer:** Quem vê a entrevista e pode atualizar a avaliação. O servidor confere.
**Onde fica:** Menu > TechHire > Inteligência (IA) > Notetaker IA (`/notetaker`).
**Antes de começar:** Tenha a transcrição ou as anotações.

## Passo a passo
1. Em "Entrevista", escolha uma entrevista recente.
2. Cole o texto em "Transcrição / anotações".
3. Clique em "Gerar notas com IA".
4. Revise "Resumo", "Pontos fortes", "Preocupações" e "Follow-ups sugeridos".
<!-- screenshot: notetaker -->

## Resultado esperado
"Notas geradas pela IA."

## Regras e limites
- Transcrição de 40 a 60.000 caracteres.
- Recomendação: Forte contratação, Contratar, Neutro, Não contratar, Forte rejeição.
- A recomendação é sugestão; revise antes de decidir.

## Erros comuns
- "Transcrição muito curta — cole ao menos algumas frases.": complete o texto.
- "Créditos da IA esgotados. Adicione créditos em Workspace → Uso.": peça recarga.

## Relacionados
- [Gerenciar scorecards](/ajuda/ats/gerenciar-scorecards)
