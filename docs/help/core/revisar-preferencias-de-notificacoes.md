---
module_key: core
slug: revisar-preferencias-de-notificacoes
title: Revisar preferências de notificações
summary: Revisar preferências de notificações.
article_type: howto
route_pattern: /settings/notifications
min_permission: 
audience: internal
sort_order: 148
version: 1
is_published: true
---
# Revisar preferências de notificações

**Para que serve:** Revisar preferências de notificações, no contexto da tela `/settings/notifications`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/notifications`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/notifications.
2. Consulte as preferências disponíveis.
3. Ajuste apenas as opções exibidas e confirme o resultado na tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Preferência de notificação não altera a responsabilidade dos registros nem concede acesso a outro módulo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/notifications com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
