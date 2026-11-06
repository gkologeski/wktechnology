---
module_key: core
slug: administrar-membros-do-workspace
title: Administrar membros do workspace
summary: Administrar membros do workspace.
article_type: howto
route_pattern: /settings/teams
min_permission: system.members.view.workspace
audience: internal
sort_order: 171
version: 2
is_published: true
---
# Administrar membros do workspace

**Para que serve:** Administrar membros do workspace, no contexto da tela `/settings/teams`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.members`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/teams`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Membros.
2. Consulte os membros e o estado do vínculo.
3. Revise o usuário antes de convidar, editar ou desativar pelo controle disponível.
4. Confira os efeitos da confirmação no diálogo de desativação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Membro inativo perde acesso mas permanece identificável como responsável. Não confunda Membros com Times nem conceda acesso só para importar um nome do HubSpot.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/teams com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/administrar-membros-do-workspace.webp)
