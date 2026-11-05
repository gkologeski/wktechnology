---
module_key: contracts
slug: iniciar-aprovacoes
title: Iniciar e reiniciar aprovações de contrato
summary: Iniciar e reiniciar aprovações de contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 32
version: 1
is_published: true
---
# Iniciar e reiniciar aprovações de contrato
**Para que serve:** Iniciar e reiniciar aprovações de contrato.
**Quem pode fazer:** Gerenciamento de techcontracts.approvals e atualização do contrato.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Contrato não vigente nem encerrado; condições revisadas.

## Passo a passo
1. Abra o painel de aprovações na ficha.
2. Clique em "Iniciar fluxo".
3. Acompanhe as etapas pendentes.
4. Quando precisar abrir uma nova cadeia, clique em "Reiniciar" e confirme a preservação das decisões anteriores no histórico.
<!-- screenshot: Iniciar e reiniciar aprovações de contrato, sem dados pessoais reais -->

## Resultado esperado
"Fluxo de aprovação iniciado" ou "Fluxo reiniciado"; contrato em revisão.

## Regras e limites
- Prestação: Jurídico → Financeiro. Compra: Compras → Financeiro → Jurídico.
- Cadeia não pode ser omitida ou reduzida.
- Iniciar sem reiniciar reutiliza o fluxo existente.
- Reiniciar preserva decisões antigas no histórico e abre nova geração.
- Ativos, encerrados e rescindidos não iniciam esse processo.

## Erros comuns
"Contrato encerrado ou vigente: use aditivo para novo processo." ou "A cadeia de aprovação não pode ser omitida ou reduzida.": respeite o processo indicado.

## Relacionados
- [Aprovar ou rejeitar](/ajuda/contracts/decidir-aprovacao)
