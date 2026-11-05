---
module_key: platform
slug: consultar-quotas-por-workspace
title: Consultar quotas por workspace
summary: Consultar quotas por workspace.
article_type: howto
route_pattern: /settings/platform/quotas
min_permission: 
audience: internal
sort_order: 185
version: 1
is_published: true
---
# Consultar quotas por workspace

**Para que serve:** Consultar quotas por workspace, no contexto da tela `/settings/platform/quotas`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/quotas`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Quotas.
2. Localize o workspace e confira o Plano.
3. Compare os contadores de Emails, WhatsApp, API e IA.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Limites PLAN_LIMITS são referências display-only por plano. O texto de alerta em 80% e as cores não provam bloqueio de uso ou regra contratual de cobrança.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /settings/platform/quotas com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
