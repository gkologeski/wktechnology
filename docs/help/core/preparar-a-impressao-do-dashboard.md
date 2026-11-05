---
module_key: core
slug: preparar-a-impressao-do-dashboard
title: Preparar a impressão do dashboard
summary: Preparar a impressão do dashboard.
article_type: howto
route_pattern: /home/print
min_permission: 
audience: internal
sort_order: 105
version: 1
is_published: true
---
# Preparar a impressão do dashboard

**Para que serve:** Preparar a impressão do dashboard, no contexto da tela `/home/print`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/home/print`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a versão de impressão do dashboard.
2. Confira o período e os indicadores apresentados.
3. Use a impressão do navegador após conferir o conteúdo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota verifica a ação de exportação de system.home. A impressão não deve expor dados a pessoas sem acesso ao workspace.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /home/print com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
