---
module_key: core
slug: manter-tipos-de-assinatura-de-comunicacao
title: Manter tipos de assinatura de comunicação
summary: Manter tipos de assinatura de comunicação.
article_type: howto
route_pattern: /settings/subscriptions
min_permission: 
audience: internal
sort_order: 169
version: 2
is_published: true
---
# Manter tipos de assinatura de comunicação

**Para que serve:** Manter tipos de assinatura de comunicação, no contexto da tela `/settings/subscriptions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.communication.subscription_types`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/subscriptions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/subscriptions.
2. Consulte o cadastro de tipos de assinatura.
3. Revise a criação ou edição disponível antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.communication.subscription_types. São preferências/tipos de comunicação, não assinatura de contrato nem cobrança recorrente.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/subscriptions com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/manter-tipos-de-assinatura-de-comunicacao.webp)
