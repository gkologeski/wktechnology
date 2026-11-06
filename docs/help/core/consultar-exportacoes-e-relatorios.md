---
module_key: core
slug: consultar-exportacoes-e-relatorios
title: Consultar exportações e relatórios
summary: Consultar exportações e relatórios.
article_type: howto
route_pattern: /settings/exports
min_permission: 
audience: internal
sort_order: 125
version: 2
is_published: true
---
# Consultar exportações e relatórios

**Para que serve:** Consultar exportações e relatórios, no contexto da tela `/settings/exports`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.analytics.reports`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/exports`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/exports.
2. Revise as exportações disponíveis e suas configurações.
3. Confira o destino antes de salvar uma configuração.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapa de rota usa system.analytics.reports. Não confunda configurar uma exportação com comprovar entrega por e-mail.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/exports com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-exportacoes-e-relatorios.webp)
