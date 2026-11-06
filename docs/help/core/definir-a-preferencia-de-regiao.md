---
module_key: core
slug: definir-a-preferencia-de-regiao
title: Definir a preferência de região
summary: Definir a preferência de região.
article_type: howto
route_pattern: /settings/data-residency
min_permission: 
audience: internal
sort_order: 121
version: 1
is_published: true
---
# Definir a preferência de região

**Para que serve:** Definir a preferência de região, no contexto da tela `/settings/data-residency`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/data-residency`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/data-residency.
2. Consulte a região atual.
3. Se autorizado a gerenciar system.settings, selecione Brasil, Estados Unidos ou União Europeia.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O código registra preferência de localização. Não há nesta tela fluxo que comprove migração física dos dados, prazo de migração ou garantia de residência territorial.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/data-residency com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
