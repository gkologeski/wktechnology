---
module_key: ats
slug: acompanhar-vaga
title: Acompanhar uma vaga
summary: Gerir propriedades e candidaturas da vaga.
article_type: howto
route_pattern: /jobs/$id
min_permission: techhire.jobs.view.own
audience: internal
sort_order: 23
version: 1
is_published: true
---
# Acompanhar uma vaga
**Para que serve:** Mover candidatos pelas etapas e registrar a contratação.
**Quem pode fazer:** Quem vê a vaga. Adicionar candidato exige `techhire.candidates.create`. Exportar exige `techhire.jobs.export.workspace` e `techhire.candidates.export.workspace`.
**Onde fica:** Vagas > clique na vaga (`/jobs/$id`).
**Antes de começar:** Abra a vaga.

## Passo a passo
1. Clique em "Adicionar candidato", escolha em "Candidato" e clique em "Adicionar".
2. Mova as candidaturas entre as etapas.
3. Edite o painel "Propriedades".
4. Ao contratar, preencha "Registrar contratação": modelo "Interna", "Outsourcing" ou "Hunting".
5. Para exportar, clique em "CSV".
<!-- screenshot: detalhe da vaga -->

## Resultado esperado
"Candidato adicionado à vaga" ou "Contratação registrada".

## Regras e limites
- Etapas padrão: Aplicado, Triagem, Entrevista RH, Entrevista técnica, Teste, Proposta, Contratado, Rejeitado.
- Pipelines próprios podem ter outras etapas.

## Erros comuns
- "Sem permissão para confirmar contratação.": peça acesso.
- "Falha ao mover em massa": confira sua permissão.

## Relacionados
- [Gerenciar vagas](/ajuda/ats/gerenciar-vagas)
