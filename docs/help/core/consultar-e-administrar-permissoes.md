---
module_key: core
slug: consultar-e-administrar-permissoes
title: Consultar e administrar permissões
summary: Consultar e administrar permissões.
article_type: howto
route_pattern: /settings/permissions
min_permission: system.roles.view.workspace
audience: internal
sort_order: 152
version: 1
is_published: true
---
# Consultar e administrar permissões

**Para que serve:** Consultar e administrar permissões, no contexto da tela `/settings/permissions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.roles`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/permissions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Permissões.
2. Revise a matriz de permissões.
3. Consulte o painel de permissões efetivas.
4. Revise também regras de campos e modelos de acesso nos painéis correspondentes antes de alterar uma concessão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.roles. A permissão efetiva exige membership ativo, escopo correto e ausência de deny; esconder menu não protege URL/API. Edição de cargos deve ficar restrita a owner/admin.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/permissions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
