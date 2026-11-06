---
module_key: core
slug: manter-webhooks-de-integracao
title: Manter webhooks de integração
summary: Manter webhooks de integração.
article_type: howto
route_pattern: /settings/webhooks
min_permission: 
audience: internal
sort_order: 175
version: 2
is_published: true
---
# Manter webhooks de integração

**Para que serve:** Manter webhooks de integração, no contexto da tela `/settings/webhooks`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.webhooks`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/webhooks`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/webhooks.
2. Consulte os webhooks e filtros existentes.
3. Revise destino e configuração na criação ou edição disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.webhooks. URL e segredo de destino são sensíveis; configurar não comprova entrega ou autorização no serviço receptor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/webhooks com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/manter-webhooks-de-integracao.webp)
