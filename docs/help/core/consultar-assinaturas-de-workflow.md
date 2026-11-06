---
module_key: core
slug: consultar-assinaturas-de-workflow
title: Consultar assinaturas de workflow
summary: Consultar assinaturas de workflow.
article_type: howto
route_pattern: /settings/workflow-subscriptions
min_permission: 
audience: internal
sort_order: 178
version: 1
is_published: true
---
# Consultar assinaturas de workflow

**Para que serve:** Consultar assinaturas de workflow, no contexto da tela `/settings/workflow-subscriptions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.workflows`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/workflow-subscriptions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/workflow-subscriptions.
2. Consulte as assinaturas e as ações disponíveis.
3. Revise a configuração antes de criar ou editar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.workflows. Não confunda assinatura de workflow com assinatura eletrônica ou recorrência financeira.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/workflow-subscriptions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
