---
module_key: core
slug: concluir-o-retorno-de-conexao-unipile
title: Concluir o retorno de conexão Unipile
summary: Concluir o retorno de conexão Unipile.
article_type: howto
route_pattern: /unipile-connected
min_permission: 
audience: internal
sort_order: 217
version: 2
is_published: true
---
# Concluir o retorno de conexão Unipile

**Para que serve:** Concluir o retorno de conexão Unipile, no contexto da tela `/unipile-connected`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/unipile-connected`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Conclua o fluxo no provedor e aguarde o retorno para /unipile-connected.
2. Leia o estado informado.
3. Volte à tela de configuração para conferir a conta conectada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Callback não é prova de capacidade de envio; confira a conta no workspace correto. Não divulgue parâmetros de conexão.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /unipile-connected com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/concluir-o-retorno-de-conexao-unipile.webp)
