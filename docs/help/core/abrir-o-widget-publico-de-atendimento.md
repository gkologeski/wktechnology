---
module_key: core
slug: abrir-o-widget-publico-de-atendimento
title: Abrir o widget público de atendimento
summary: Abrir o widget público de atendimento.
article_type: howto
route_pattern: /widget/$workspaceId
min_permission: 
audience: internal
sort_order: 220
version: 1
is_published: true
---
# Abrir o widget público de atendimento

**Para que serve:** Abrir o widget público de atendimento, no contexto da tela `/widget/$workspaceId`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/widget/$workspaceId`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o widget incorporado no site autorizado.
2. Consulte a interface e siga os controles de atendimento apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O workspaceId seleciona o contexto do widget, não concede acesso aos dados internos. Não confunda visitante com membro ativo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /widget/$workspaceId com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
