---
module_key: core
slug: revisar-layouts-de-fichas
title: Revisar layouts de fichas
summary: Revisar layouts de fichas.
article_type: howto
route_pattern: /settings/record-layouts
min_permission: 
audience: internal
sort_order: 161
version: 1
is_published: true
---
# Revisar layouts de fichas

**Para que serve:** Revisar layouts de fichas, no contexto da tela `/settings/record-layouts`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/record-layouts`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/record-layouts.
2. Consulte os layouts e as opções de organização apresentados.
3. Revise a configuração da entidade antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O layout organiza a apresentação; não redefine as permissões de acesso a dados nem a visibilidade de campos sensíveis.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/record-layouts com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
