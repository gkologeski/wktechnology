---
module_key: crm
slug: manter-origens-de-leads
title: Manter origens de leads
summary: Manter origens de leads.
article_type: howto
route_pattern: /settings/lead-sources
min_permission: 
audience: internal
sort_order: 137
version: 2
is_published: true
---
# Manter origens de leads

**Para que serve:** Manter origens de leads, no contexto da tela `/settings/lead-sources`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.lead_sources`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/lead-sources`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/lead-sources.
2. Revise Nome (valor) e Rótulo em português no cadastro.
3. Salve a origem pelo formulário disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.lead_sources; pertence ao TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/lead-sources com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/manter-origens-de-leads.webp)
