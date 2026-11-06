---
module_key: core
slug: consultar-o-catalogo-de-integracoes
title: Consultar o catálogo de integrações
summary: Consultar o catálogo de integrações.
article_type: howto
route_pattern: /settings/integrations
min_permission: system.integrations.view.workspace
audience: internal
sort_order: 131
version: 2
is_published: true
---
# Consultar o catálogo de integrações

**Para que serve:** Consultar o catálogo de integrações, no contexto da tela `/settings/integrations`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Integrações.
2. Localize a integração no catálogo.
3. Abra seu detalhe para consultar conexão e recursos disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cada integração tem requisitos próprios; aparecer no catálogo não significa estar conectada ou licenciada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/integrations com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-o-catalogo-de-integracoes.webp)
