---
module_key: contracts
slug: vincular-aditivo
title: Vincular e desvincular aditivos
summary: Vincular e desvincular aditivos no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 34
version: 1
is_published: true
---
# Vincular e desvincular aditivos
**Para que serve:** Vincular e desvincular aditivos.
**Quem pode fazer:** Atualização do contrato e das relações no escopo autorizado.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Ter contrato principal e aditivo do mesmo papel.

## Passo a passo
1. Para classificar pela ficha, escolha "Tipo de documento" = "Aditivo", selecione "Contrato principal" e salve.
2. No painel de aditivos, use "Vincular aditivo" ou "Alterar contrato principal".
3. Selecione o contrato correspondente e informe "Número do aditivo" e "Vigência do aditivo" quando aplicável.
4. Clique em "Vincular".
5. Para desvincular, use a ação de remover vínculo e confirme "Remover o vínculo de aditivo deste contrato?".
<!-- screenshot: Vincular e desvincular aditivos, sem dados pessoais reais -->

## Resultado esperado
"Aditivo vinculado." ou "Vínculo de aditivo removido.".

## Regras e limites
- Um contrato não pode ser aditivo de si mesmo.
- Aditivo não pode ser principal de outro aditivo.
- Principal e aditivo devem ter o mesmo papel.
- Alterar para Principal remove vínculo, número e vigência do aditivo após confirmação.
- Essa relação não é o aninhamento de compra sob prestação.

## Erros comuns
"Contrato principal não encontrado." ou "O aditivo deve ter o mesmo papel do contrato principal.": revise o destino.

## Relacionados
- [Aninhar compra e prestação](/ajuda/contracts/aninhar-contratos)
