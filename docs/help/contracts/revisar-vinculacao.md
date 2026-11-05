---
module_key: contracts
slug: revisar-vinculacao
title: Vincular contratos e remover pendências da fila
summary: Vincular contratos e remover pendências da fila no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/links
min_permission:
audience: internal
sort_order: 43
version: 1
is_published: true
---
# Vincular contratos e remover pendências da fila
**Para que serve:** Vincular contratos e remover pendências da fila.
**Quem pode fazer:** Leitura de techcontracts.links; dispensar exige gerenciamento; aplicar vínculo exige atualização de contratos e acesso aos registros.
**Onde fica:** TechContracts > Contratos (/contracts/links).
**Antes de começar:** Identificar compra, prestação ou aditivo e destino correto.

## Passo a passo
1. Clique em "Vincular contratos" na lista.
2. Na tela "Vinculação de contratos", use "Buscar" e "Tipo": Todos, Prestação, Compra ou Aditivos.
3. Clique em "Vincular" no registro, escolha o destino e confirme.
4. Compra deve apontar para prestação; aditivo deve apontar para principal do mesmo papel.
5. Se a pendência não exigir vínculo, use "Remover da fila".
<!-- screenshot: Vincular contratos e remover pendências da fila, sem dados pessoais reais -->

## Resultado esperado
"Contratos vinculados.", "Aditivo vinculado." ou "Contrato removido da fila de vinculação.", conforme ação.

## Regras e limites
- Busca filtra localmente os registros carregados; fila limitada a 500.
- Remover da fila não exclui contrato, não cria vínculo e não pede confirmação nesse componente.
- Candidatos da tela ainda podem ser recusados pelas regras do servidor.
- Compra/prestação e principal/aditivo são relações distintas.

## Erros comuns
Destino recusado: confira papel, tipo de documento, autovínculo e nível permitido.

## Relacionados
- [Aninhar contratos](/ajuda/contracts/aninhar-contratos)
- [Sugestões de IA](/ajuda/contracts/analisar-vinculos-ia)
