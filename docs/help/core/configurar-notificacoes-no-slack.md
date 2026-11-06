---
module_key: core
slug: configurar-notificacoes-no-slack
title: Configurar notificações no Slack
summary: Configurar notificações no Slack.
article_type: howto
route_pattern: /settings/notifications/slack
min_permission: 
audience: internal
sort_order: 149
version: 2
is_published: true
---
# Configurar notificações no Slack

**Para que serve:** Configurar notificações no Slack, no contexto da tela `/settings/notifications/slack`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/notifications/slack`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/notifications/slack.
2. Confira Webhook URL, Workspace Slack e Canal default.
3. Revise o mapeamento Eventos → Canal antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O recurso da rota é system.integrations. Webhook URL é segredo; não a coloque em capturas ou compartilhe publicamente.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/notifications/slack com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/configurar-notificacoes-no-slack.webp)
