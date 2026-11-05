---
module_key: core
slug: consultar-a-configuracao-do-zapier
title: Consultar a configuração do Zapier
summary: Consultar a configuração do Zapier.
article_type: howto
route_pattern: /settings/zapier
min_permission: 
audience: internal
sort_order: 179
version: 1
is_published: true
---
# Consultar a configuração do Zapier

**Para que serve:** Consultar a configuração do Zapier, no contexto da tela `/settings/zapier`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.webhooks`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/zapier`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/zapier.
2. Revise as instruções e os dados de configuração apresentados.
3. Use credenciais somente em um destino de integração confiável.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso de rota system.webhooks. Nunca inclua API keys, tokens ou URLs secretas em capturas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/zapier com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
