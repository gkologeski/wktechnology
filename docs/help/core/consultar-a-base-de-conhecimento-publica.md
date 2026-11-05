---
module_key: core
slug: consultar-a-base-de-conhecimento-publica
title: Consultar a base de conhecimento pública
summary: Consultar a base de conhecimento pública.
article_type: howto
route_pattern: /kb
min_permission: 
audience: internal
sort_order: 197
version: 1
is_published: true
---
# Consultar a base de conhecimento pública

**Para que serve:** Consultar a base de conhecimento pública, no contexto da tela `/kb`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/kb`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /kb.
2. Consulte os artigos disponíveis e abra o assunto desejado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A base pública /kb usa kb.functions e não é a Ajuda interna /ajuda. O artigo interno desta entrega não fica público por documentar essa tela.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /kb com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
