---
module_key: core
slug: entrar-na-conta
title: Entrar na conta
summary: Entrar na conta.
article_type: howto
route_pattern: /login
min_permission: 
audience: internal
sort_order: 199
version: 1
is_published: true
---
# Entrar na conta

**Para que serve:** Entrar na conta, no contexto da tela `/login`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/login`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /login.
2. Informe Email e Senha.
3. Use o controle de entrada apresentado ou a opção de autenticação externa disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Ter conta não concede acesso automático a qualquer workspace; membership e permissões continuam obrigatórios.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /login com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
