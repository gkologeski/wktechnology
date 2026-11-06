---
module_key: core
slug: consultar-o-cancelamento-de-comunicacoes
title: Consultar o cancelamento de comunicações
summary: Consultar o cancelamento de comunicações.
article_type: howto
route_pattern: /unsubscribe
min_permission: 
audience: internal
sort_order: 218
version: 1
is_published: true
---
# Consultar o cancelamento de comunicações

**Para que serve:** Consultar o cancelamento de comunicações, no contexto da tela `/unsubscribe`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/unsubscribe`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de descadastro recebido na comunicação.
2. Confira o estado ou a confirmação apresentada.
3. Siga a ação indicada quando disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mecanismo é o link da comunicação, não uma sessão administrativa. Descadastro não apaga automaticamente a conta ou todos os registros pessoais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /unsubscribe com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
