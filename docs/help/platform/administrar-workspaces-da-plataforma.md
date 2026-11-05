---
module_key: platform
slug: administrar-workspaces-da-plataforma
title: Administrar workspaces da plataforma
summary: Administrar workspaces da plataforma.
article_type: howto
route_pattern: /admin/workspaces
min_permission: 
audience: internal
sort_order: 182
version: 1
is_published: true
---
# Administrar workspaces da plataforma

**Para que serve:** Administrar workspaces da plataforma, no contexto da tela `/admin/workspaces`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/workspaces`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Super-admin.
2. Filtre por Ativos, Suspensos, Lixeira ou Todos.
3. Abra um workspace para conferir seus dados e membros.
4. Para criar workspace ou convidar membro, revise os campos e o papel antes de confirmar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma; owner/admin de workspace não é super-admin. Ações de ciclo de vida exigem revisão do diálogo de confirmação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/workspaces com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
