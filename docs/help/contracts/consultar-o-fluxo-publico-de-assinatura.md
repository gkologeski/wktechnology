---
module_key: contracts
slug: consultar-o-fluxo-publico-de-assinatura
title: Consultar o fluxo público de assinatura
summary: Consultar o fluxo público de assinatura.
article_type: howto
route_pattern: /sign/$token
min_permission: 
audience: internal
sort_order: 213
version: 1
is_published: true
---
# Consultar o fluxo público de assinatura

**Para que serve:** Consultar o fluxo público de assinatura, no contexto da tela `/sign/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/sign/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira o documento e as instruções.
3. Execute somente as etapas de assinatura apresentadas para seu acesso.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Link de assinatura é sensível; não prometa que a tela é configurador global de assinatura eletrônica.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `contracts`; consulte os artigos desse módulo em `/ajuda/contracts`.

<!-- screenshot: capturar /sign/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
