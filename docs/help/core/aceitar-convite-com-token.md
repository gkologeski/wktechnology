---
module_key: core
slug: aceitar-convite-com-token
title: Aceitar convite com token
summary: Aceitar convite com token.
article_type: howto
route_pattern: /accept-invite/$token
min_permission: 
audience: internal
sort_order: 191
version: 1
is_published: true
---
# Aceitar convite com token

**Para que serve:** Aceitar convite com token, no contexto da tela `/accept-invite/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/accept-invite/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o convite recebido.
2. Confira o e-mail e preencha os campos do formulário.
3. Confirme a senha quando exigido e conclua o aceite.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O token é credencial de acesso. Não o substitua por um valor de exemplo ao operar nem o inclua em capturas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /accept-invite/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
