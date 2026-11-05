---
module_key: core
slug: consultar-o-log-de-auditoria
title: Consultar o log de auditoria
summary: Consultar o log de auditoria.
article_type: howto
route_pattern: /settings/audit-log
min_permission: 
audience: internal
sort_order: 114
version: 1
is_published: true
---
# Consultar o log de auditoria

**Para que serve:** Consultar o log de auditoria, no contexto da tela `/settings/audit-log`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.audit`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/audit-log`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/audit-log.
2. Filtre por Módulo, Entidade e Ação.
3. Examine os eventos retornados no contexto do workspace.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota usa system.audit. Eventos de auditoria não devem ser confundidos com todos os eventos operacionais ou com garantia de retenção ilimitada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/audit-log com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
