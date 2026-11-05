---
module_key: core
slug: revisar-modulos-do-workspace
title: Revisar módulos do workspace
summary: Revisar módulos do workspace.
article_type: howto
route_pattern: /workspace/modules
min_permission: 
audience: internal
sort_order: 180
version: 1
is_published: true
---
# Revisar módulos do workspace

**Para que serve:** Revisar módulos do workspace, no contexto da tela `/workspace/modules`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/workspace/modules`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /workspace/modules.
2. Consulte os módulos e seus estados.
3. Revise as opções habilitadas para o workspace antes de confirmar uma mudança.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os seis módulos verticais são distintos do Core e da administração de plataforma. Services é identificador legado de TechContracts, não novo produto.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /workspace/modules com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
