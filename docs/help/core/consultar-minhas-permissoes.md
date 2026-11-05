---
module_key: core
slug: consultar-minhas-permissoes
title: Consultar minhas permissões
summary: Consultar minhas permissões.
article_type: howto
route_pattern: /settings/my-permissions
min_permission: 
audience: internal
sort_order: 145
version: 1
is_published: true
---
# Consultar minhas permissões

**Para que serve:** Consultar minhas permissões, no contexto da tela `/settings/my-permissions`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/my-permissions`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/my-permissions.
2. Consulte as permissões agrupadas retornadas para sua conta.
3. Se aparecer Nenhuma permissão atribuída, solicite revisão ao administrador.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Esta tela é de consulta; não permite conceder permissões a si próprio. O acesso efetivo depende do workspace e deny prevalece.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/my-permissions com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
