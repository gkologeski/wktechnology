---
module_key: core
slug: consultar-o-painel-de-ia
title: Consultar o painel de IA
summary: Consultar o painel de IA.
article_type: howto
route_pattern: /settings/ai-panel
min_permission: 
audience: internal
sort_order: 111
version: 2
is_published: true
---
# Consultar o painel de IA

**Para que serve:** Consultar o painel de IA, no contexto da tela `/settings/ai-panel`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.ai_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/ai-panel`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/ai-panel.
2. Revise os controles e informações de IA apresentados.
3. Para configurar o provedor do workspace, use /settings/integrations/ai.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapeamento de rota usa system.ai_settings. O painel não é um módulo vertical nem autoriza acesso a dados dos demais módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/ai-panel com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-o-painel-de-ia.webp)
