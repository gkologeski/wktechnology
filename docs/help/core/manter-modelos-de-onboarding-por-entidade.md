---
module_key: core
slug: manter-modelos-de-onboarding-por-entidade
title: Manter modelos de onboarding por entidade
summary: Manter modelos de onboarding por entidade.
article_type: howto
route_pattern: /settings/onboarding-templates
min_permission: 
audience: internal
sort_order: 150
version: 1
is_published: true
---
# Manter modelos de onboarding por entidade

**Para que serve:** Manter modelos de onboarding por entidade, no contexto da tela `/settings/onboarding-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/onboarding-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/onboarding-templates.
2. Defina Entidade, Nome e Descrição.
3. Revise os campos de Segmentação e o UUID opcional de Workflow.
4. Confira os JSONs de etapas/campos e tarefas automáticas antes de gravar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelo genérico por entidade; não substitui /people/onboarding-templates. JSON inválido ou UUID incorreto precisa ser corrigido antes de uso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/onboarding-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
