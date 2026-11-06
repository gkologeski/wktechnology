---
module_key: contracts
slug: aninhar-contratos
title: Aninhar contratos de compra sob uma prestação
summary: Aninhar contratos de compra sob uma prestação no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 40
version: 1
is_published: true
---
# Aninhar contratos de compra sob uma prestação
**Para que serve:** Aninhar contratos de compra sob uma prestação.
**Quem pode fazer:** Atualização dos contratos e capacidade de alterar o vínculo.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a prestação principal e o contrato de compra correto.

## Passo a passo
1. Na prestação, abra "Contratos de compra aninhados" e clique em "Aninhar contrato de compra".
2. Selecione o contrato de compra e clique em "Aninhar".
3. Se ele já estiver vinculado a outro contrato, use "Mover" e confirme a troca de vínculo.
4. Pela compra, também é possível usar "Aninhar sob contrato de prestação" ou "Alterar contrato principal".
5. Para remover, use "Desaninhar" e confirme "Desaninhar este contrato de compra do contrato de prestação?".
<!-- screenshot: Aninhar contratos de compra sob uma prestação, sem dados pessoais reais -->

## Resultado esperado
Contrato de compra associado à prestação e apresentado sob ela na listagem.

## Regras e limites
- Compra representa a WK como contratante do profissional; prestação representa a WK prestadora.
- Compra não aninha outra compra ou prestação neste card. Aditivos têm painel próprio.
- Autovínculo é impedido. Mover exige confirmação.
- A apresentação de margem não equivale a faturamento ou recebimento.

## Erros comuns
"Você não tem permissão para alterar este vínculo": revise seu acesso. Não confunda o contrato principal de um aditivo com o pai de uma compra.

## Relacionados
- [Vincular aditivos](/ajuda/contracts/vincular-aditivo)
- [Vinculação de contratos](/ajuda/contracts/revisar-vinculacao)
