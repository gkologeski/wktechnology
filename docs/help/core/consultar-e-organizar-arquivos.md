---
module_key: core
slug: consultar-e-organizar-arquivos
title: Consultar e organizar arquivos
summary: Consultar e organizar arquivos.
article_type: howto
route_pattern: /files
min_permission: 
audience: internal
sort_order: 103
version: 1
is_published: true
---
# Consultar e organizar arquivos

**Para que serve:** Consultar e organizar arquivos, no contexto da tela `/files`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.files`.

**Onde fica:** Configurações ou navegação do workspace > `/files`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Arquivos.
2. Consulte a lista de arquivos e as ações habilitadas para seu acesso.
3. Use as ações de envio ou organização somente nos registros que você pode alterar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O recurso de autorização é system.files. Sessões de “Ver como” podem ser somente leitura; compartilhar um arquivo é uma ação distinta de consultar.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /files com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
