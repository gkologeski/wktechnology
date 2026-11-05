---
module_key: core
slug: organizar-times-do-workspace
title: Organizar times do workspace
summary: Organizar times do workspace.
article_type: howto
route_pattern: /settings/user-groups
min_permission: 
audience: internal
sort_order: 172
version: 1
is_published: true
---
# Organizar times do workspace

**Para que serve:** Organizar times do workspace, no contexto da tela `/settings/user-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/user-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Times.
2. Consulte Equipes do workspace.
3. Preencha Nome, Cor e Descrição no formulário disponível.
4. Revise os participantes e salve.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Times organizam usuários; não são empresas, cargos de contratação ou módulos licenciados. A permissão para organizar times não é autorização universal sobre seus registros.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/user-groups com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
