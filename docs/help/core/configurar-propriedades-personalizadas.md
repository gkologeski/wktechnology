---
module_key: core
slug: configurar-propriedades-personalizadas
title: Configurar propriedades personalizadas
summary: Configurar propriedades personalizadas.
article_type: howto
route_pattern: /settings/custom-properties
min_permission: system.custom_properties.view.workspace
audience: internal
sort_order: 120
version: 1
is_published: true
---
# Configurar propriedades personalizadas

**Para que serve:** Configurar propriedades personalizadas, no contexto da tela `/settings/custom-properties`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.custom_properties`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/custom-properties`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Propriedades.
2. Escolha a Entidade e abra a criação ou edição.
3. Revise Tipo, Rótulo, Chave, Grupo e Opções.
4. Confira ordem, obrigatoriedade e o Prompt de IA opcional antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A chave é apresentada como sem espaços. Campo de prompt não garante enriquecimento executado. O cadastro não substitui regras de acesso a campos privados.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/custom-properties com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
