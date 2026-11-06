---
module_key: crm
slug: consultar-o-agente-de-voz
title: Consultar o agente de voz
summary: Consultar o agente de voz.
article_type: howto
route_pattern: /settings/voice-agent
min_permission: 
audience: internal
sort_order: 174
version: 2
is_published: true
---
# Consultar o agente de voz

**Para que serve:** Consultar o agente de voz, no contexto da tela `/settings/voice-agent`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_voice`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/voice-agent`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/voice-agent.
2. Revise as opções e o estado apresentado pelo agente de voz.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_voice; é recurso de prospecção do TechSales, não provedor global de IA.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/voice-agent com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/consultar-o-agente-de-voz.webp)
