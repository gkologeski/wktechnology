---
module_key: contracts
slug: acompanhar-dashboard
title: Consultar o Dashboard de contratos
summary: Consultar o Dashboard de contratos no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/dashboard
min_permission:
audience: internal
sort_order: 10
version: 1
is_published: true
---
# Consultar o Dashboard de contratos
**Para que serve:** Consultar o Dashboard de contratos.
**Quem pode fazer:** Membro com acesso ao módulo e aos contratos consultados.
**Onde fica:** TechContracts > Contratos (/contracts/dashboard).
**Antes de começar:** Ter contratos visíveis para o seu acesso.

## Passo a passo
1. Abra TechContracts > Visão geral > Dashboard.
2. Consulte "Contratos ativos", "Valor contratado ativo", "Em aprovação ou assinatura" e "Vencem em 30 dias".
3. Veja "Carteira por status", "Próximos vencimentos", "Precisam de atenção" e "Contratos recentes".
4. Clique em um contrato para abrir sua ficha. Use "Atualizar" para consultar novamente ou "Ir para Contratos" para abrir a lista.
<!-- screenshot: Consultar o Dashboard de contratos, sem dados pessoais reais -->

## Resultado esperado
Indicadores e listas dos contratos acessíveis.

## Regras e limites
- Ativos incluem os status active e renewing. Aprovação ou assinatura inclui in_review, in_negotiation e awaiting_signature.
- Vencimentos considera os próximos 30 dias. Atenção inclui contratos ativos vencidos e os que aguardam aprovação ou assinatura.
- A consulta considera até 2.000 contratos mais recentes; listas auxiliares mostram até 8.
- O valor soma os valores cadastrados. Não há conversão multimoeda demonstrada; não use o indicador como total convertido.

## Erros comuns
Se a consulta falhar, tente "Atualizar". Uma lista vazia não comprova ausência de contratos fora do seu acesso.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)
