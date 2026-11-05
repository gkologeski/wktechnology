---
module_key: core
slug: revisar-responsaveis-importados-do-hubspot
title: Revisar responsáveis importados do HubSpot
summary: Revisar responsáveis importados do HubSpot.
article_type: howto
route_pattern: /settings/hubspot-users
min_permission: 
audience: internal
sort_order: 128
version: 1
is_published: true
---
# Revisar responsáveis importados do HubSpot

**Para que serve:** Revisar responsáveis importados do HubSpot, no contexto da tela `/settings/hubspot-users`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/hubspot-users`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/hubspot-users.
2. Confira os responsáveis e vínculos apresentados.
3. Revise a ação disponível antes de criar ou associar responsáveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Responsável importado não recebe automaticamente acesso: membership inactive preserva o nome e remove acesso. Não trate importação como convite aceito.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/hubspot-users com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
