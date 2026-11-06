---
module_key: core
slug: atualizar-o-perfil-da-conta
title: Atualizar o perfil da conta
summary: Atualizar o perfil da conta.
article_type: howto
route_pattern: /settings
min_permission: 
audience: internal
sort_order: 108
version: 2
is_published: true
---
# Atualizar o perfil da conta

**Para que serve:** Atualizar o perfil da conta, no contexto da tela `/settings`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Perfil.
2. Confira o e-mail apresentado e edite o Nome completo.
3. Use a ação de salvamento do perfil.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O layout /settings não é uma segunda tela de perfil. Alterar o perfil não concede permissões nem muda o cargo do usuário.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/atualizar-o-perfil-da-conta.webp)
