---
module_key: platform
slug: revisar-um-workspace-e-seus-membros
title: Revisar um workspace e seus membros
summary: Revisar um workspace e seus membros.
article_type: howto
route_pattern: /admin/workspaces/$id
min_permission: 
audience: internal
sort_order: 183
version: 1
is_published: true
---
# Revisar um workspace e seus membros

**Para que serve:** Revisar um workspace e seus membros, no contexto da tela `/admin/workspaces/$id`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/workspaces/$id`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o workspace pela lista Super-admin.
2. Confira os dados do workspace e os Membros.
3. Revise Nome, Email, Telefone e Papel ao preparar um convite.
4. Para ações de ciclo de vida, leia o diálogo e confirme o workspace alvo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Suspensão e exclusão podem afetar todo o workspace. Não descreva exclusão como reversível sem conferir o estado e a operação específica.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/workspaces/$id com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
