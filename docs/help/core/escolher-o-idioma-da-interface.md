---
module_key: core
slug: escolher-o-idioma-da-interface
title: Escolher o idioma da interface
summary: Escolher o idioma da interface.
article_type: howto
route_pattern: /settings/language
min_permission: system.language.view.workspace
audience: internal
sort_order: 136
version: 1
is_published: true
---
# Escolher o idioma da interface

**Para que serve:** Escolher o idioma da interface, no contexto da tela `/settings/language`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/language`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Idioma.
2. Confira o idioma atual.
3. Selecione Português, Inglês ou Espanhol.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A tela usa setLocale para a interface; não é tradução automática dos dados cadastrados nem ajuste de país de telefones.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/language com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
