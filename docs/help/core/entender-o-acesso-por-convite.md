---
module_key: core
slug: entender-o-acesso-por-convite
title: Entender o acesso por convite
summary: Entender o acesso por convite.
article_type: howto
route_pattern: /signup
min_permission: 
audience: internal
sort_order: 214
version: 1
is_published: true
---
# Entender o acesso por convite

**Para que serve:** Entender o acesso por convite, no contexto da tela `/signup`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/signup`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /signup.
2. Leia Acesso por convite.
3. Solicite convite ao administrador ou use Ir para o login se já possui conta.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cadastro público está desativado. Esta página não cria conta ou workspace por autoatendimento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /signup com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
