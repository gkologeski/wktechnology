---
module_key: platform
slug: consultar-status-e-manutencao-da-plataforma
title: Consultar status e manutenção da plataforma
summary: Consultar status e manutenção da plataforma.
article_type: howto
route_pattern: /settings/platform/status
min_permission: 
audience: internal
sort_order: 188
version: 1
is_published: true
---
# Consultar status e manutenção da plataforma

**Para que serve:** Consultar status e manutenção da plataforma, no contexto da tela `/settings/platform/status`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/status`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Status.
2. Revise os indicadores de workspace, integrações e crons.
3. Use Reagendar crons apenas após avaliar o estado dos jobs.
4. Execute Backfill de qualificações na timeline somente para o caso descrito na tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Atualização de consulta a cada 30 segundos. O backfill cria atividade Pesquisa para qualificações históricas e é apresentado como idempotente; não é manutenção genérica dos seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/status com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
