---
module_key: platform
slug: administrar-sandboxes-da-plataforma
title: Administrar sandboxes da plataforma
summary: Administrar sandboxes da plataforma.
article_type: howto
route_pattern: /settings/platform/sandbox
min_permission: 
audience: internal
sort_order: 186
version: 1
is_published: true
---
# Administrar sandboxes da plataforma

**Para que serve:** Administrar sandboxes da plataforma, no contexto da tela `/settings/platform/sandbox`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/sandbox`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Sandbox.
2. Clique Novo sandbox.
3. Selecione Workspace de origem e informe Nome do sandbox.
4. Revise o resultado e as ações de ciclo de vida disponíveis na lista.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. Não presuma anonimização, isolamento integral de integrações ou cópia completa de todos os dados; confirme antes de usar dados reais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/sandbox com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
