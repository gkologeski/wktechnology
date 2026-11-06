---
module_key: crm
slug: consultar-segmentos-comerciais
title: Consultar segmentos comerciais
summary: Consultar segmentos comerciais.
article_type: howto
route_pattern: /settings/segments
min_permission: 
audience: internal
sort_order: 166
version: 2
is_published: true
---
# Consultar segmentos comerciais

**Para que serve:** Consultar segmentos comerciais, no contexto da tela `/settings/segments`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.segments`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/segments`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/segments.
2. Consulte os segmentos e os filtros apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.segments; pertence ao TechSales, não é segmentação de todos os seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/segments com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/consultar-segmentos-comerciais.webp)
