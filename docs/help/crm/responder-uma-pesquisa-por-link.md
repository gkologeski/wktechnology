---
module_key: crm
slug: responder-uma-pesquisa-por-link
title: Responder uma pesquisa por link
summary: Responder uma pesquisa por link.
article_type: howto
route_pattern: /survey/$token
min_permission: 
audience: internal
sort_order: 215
version: 1
is_published: true
---
# Responder uma pesquisa por link

**Para que serve:** Responder uma pesquisa por link, no contexto da tela `/survey/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/survey/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Responda às perguntas apresentadas.
3. Confira o envio no estado final da tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
As perguntas dependem da pesquisa publicada; resposta não concede acesso ao construtor de pesquisas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /survey/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
