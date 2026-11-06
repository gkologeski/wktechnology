---
module_key: core
slug: diagnosticar-o-acesso-de-um-membro
title: Diagnosticar o acesso de um membro
summary: Diagnosticar o acesso de um membro.
article_type: howto
route_pattern: /settings/rbac-diagnostics
min_permission: system.rbac_diagnostics.view.workspace
audience: internal
sort_order: 160
version: 2
is_published: true
---
# Diagnosticar o acesso de um membro

**Para que serve:** Diagnosticar o acesso de um membro, no contexto da tela `/settings/rbac-diagnostics`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.rbac_diagnostics`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/rbac-diagnostics`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Pessoas & Acesso > Diagnóstico de acesso.
2. Escolha o Membro em Usuário analisado.
3. Revise a visibilidade e as permissões efetivas exibidas.
4. Compare o resultado com a rota e ação que o membro precisa executar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.rbac_diagnostics. Diagnóstico é diferente de editar concessões; um menu visível não comprova autorização de escrita.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/rbac-diagnostics com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/diagnosticar-o-acesso-de-um-membro.webp)
