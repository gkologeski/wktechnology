---
module_key: contracts
slug: aprovar-medicao
title: Aprovar e reverificar uma medição
summary: Aprovar e reverificar uma medição no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 73
version: 1
is_published: true
---
# Aprovar e reverificar uma medição
**Para que serve:** Aprovar e reverificar uma medição.
**Quem pode fazer:** techprojects.measurements.approve.workspace e acesso ao registro; pessoa diferente de quem preparou ou enviou.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição em revisão e sem pendências impeditivas.

## Passo a passo
1. Abra a medição em revisão.
2. Confira a prévia, linhas e pendências.
3. Clique em "Aprovar medição".
4. Se houver pendências financeiras após aprovação, resolva-as e clique em "Reverificar pendências".
<!-- screenshot: Aprovar e reverificar uma medição, sem dados pessoais reais -->

## Resultado esperado
Aprovada com pendências financeiras ou pronta para o Financeiro; nenhum título criado pela aprovação.

## Regras e limites
- Quem preparou ou enviou não pode aprovar (SELF_APPROVAL).
- Aprovação revalida contrato, competência, fontes e hash.
- Medição aprovada pode continuar bloqueada para geração.
- Devolver à situação Rascunho exige justificativa e autorização própria.

## Erros comuns
APPROVE_BLOCKED: confira pendências. SELF_APPROVAL: encaminhe a outro aprovador autorizado.

## Relacionados
- [Gerar no Financeiro](/ajuda/contracts/gerar-medicao-financeiro)
