---
module_key: ats
slug: configurar-pipelines
title: Configurar pipelines de recrutamento
summary: Criar e ordenar as etapas dos funis.
article_type: howto
route_pattern: /pipelines
min_permission: techhire.pipelines.view.own
audience: internal
sort_order: 31
version: 1
is_published: true
---
# Configurar pipelines de recrutamento
**Para que serve:** Adaptar o funil ao processo da vaga.
**Quem pode fazer:** Ver exige `techhire.pipelines.view` ou `techhire.jobs.view`. Criar exige `.create`. Tornar padrão exige `techhire.pipelines.update.workspace`.
**Onde fica:** Menu > TechHire > Recrutamento > Pipelines (`/pipelines`).
**Antes de começar:** Defina as etapas.

## Passo a passo
1. Preencha "Nome" e as "Etapas".
2. Defina o tipo de cada etapa: "Em andamento", "Ganho (contratado)" ou "Perdido (rejeitado)".
3. Clique em "Salvar pipeline".
4. Use "Duplicar", "Tornar padrão" ou "Excluir".
<!-- screenshot: pipelines -->

## Resultado esperado
"Pipeline salvo".

## Regras e limites
- De 2 a 20 etapas.
- Nome até 120 caracteres.
- Excluir pede: "Excluir este pipeline?".

## Erros comuns
- "Pipeline precisa de no mínimo 2 etapas": adicione etapas.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)
