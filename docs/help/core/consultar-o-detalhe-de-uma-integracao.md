---
module_key: core
slug: consultar-o-detalhe-de-uma-integracao
title: Consultar o detalhe de uma integração
summary: Consultar o detalhe de uma integração.
article_type: howto
route_pattern: /settings/integrations/$slug
min_permission: 
audience: internal
sort_order: 132
version: 2
is_published: true
---
# Consultar o detalhe de uma integração

**Para que serve:** Consultar o detalhe de uma integração, no contexto da tela `/settings/integrations/$slug`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra uma integração pelo catálogo.
2. Confira o nome e o estado da conexão.
3. Use somente as ações e recursos habilitados no detalhe.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O slug seleciona o conector. Não aplique o procedimento de um conector a todos os demais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/integrations/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-o-detalhe-de-uma-integracao.webp)
