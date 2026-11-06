---
module_key: core
slug: revisar-o-widget-do-site
title: Revisar o widget do site
summary: Revisar o widget do site.
article_type: howto
route_pattern: /settings/widget
min_permission: system.widget.view.workspace
audience: internal
sort_order: 177
version: 1
is_published: true
---
# Revisar o widget do site

**Para que serve:** Revisar o widget do site, no contexto da tela `/settings/widget`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/widget`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Widget do site.
2. Revise as opções apresentadas de configuração do widget.
3. Confira o contexto do workspace antes de usar a configuração no site.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O widget público e a Inbox são superfícies diferentes. A configuração não concede a visitantes acesso à Ajuda interna ou aos registros do ERP.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/widget com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
