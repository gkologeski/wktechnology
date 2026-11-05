---
module_key: core
slug: consultar-o-marketplace
title: Consultar o Marketplace
summary: Consultar o Marketplace.
article_type: howto
route_pattern: /settings/marketplace
min_permission: 
audience: internal
sort_order: 140
version: 1
is_published: true
---
# Consultar o Marketplace

**Para que serve:** Consultar o Marketplace, no contexto da tela `/settings/marketplace`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/marketplace`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Marketplace.
2. Consulte os aplicativos e abra o detalhe de um app.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O menu cita system.marketplace, enquanto o gate de rota aponta system.integrations. A divergência deve ser resolvida antes de publicar a chave mínima definitiva.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/marketplace com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
