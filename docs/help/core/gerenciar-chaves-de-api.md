---
module_key: core
slug: gerenciar-chaves-de-api
title: Gerenciar chaves de API
summary: Gerenciar chaves de API.
article_type: howto
route_pattern: /settings/api-keys
min_permission: 
audience: internal
sort_order: 112
version: 1
is_published: true
---
# Gerenciar chaves de API

**Para que serve:** Gerenciar chaves de API, no contexto da tela `/settings/api-keys`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.api_keys`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/api-keys`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/api-keys.
2. Consulte Endpoints disponíveis e Suas chaves.
3. Para criar uma chave, preencha Nome e revise Permissões.
4. Guarde o segredo fora da Ajuda e utilize a ação de revogação quando necessário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
As permissões de system.api_keys possuem escopo próprio no catálogo. Não copie valores de chave nem presuma que uma chave contorne RLS ou restrições do usuário.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/api-keys com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
