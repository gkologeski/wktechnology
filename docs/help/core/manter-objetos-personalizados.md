---
module_key: core
slug: manter-objetos-personalizados
title: Manter objetos personalizados
summary: Manter objetos personalizados.
article_type: howto
route_pattern: /settings/custom-objects
min_permission: system.custom_objects.view.workspace
audience: internal
sort_order: 119
version: 1
is_published: true
---
# Manter objetos personalizados

**Para que serve:** Manter objetos personalizados, no contexto da tela `/settings/custom-objects`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.custom_objects`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/custom-objects`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Objetos custom.
2. Defina Nome e Slug do objeto no formulário disponível.
3. Revise os Campos e os respectivos tipos antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Criação, atualização e exclusão verificam ações distintas de system.custom_objects. Criar um objeto não cria um novo módulo vertical.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/custom-objects com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
