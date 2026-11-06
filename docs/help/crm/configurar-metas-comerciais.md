---
module_key: crm
slug: configurar-metas-comerciais
title: Configurar metas comerciais
summary: Configurar metas comerciais.
article_type: howto
route_pattern: /settings/goals
min_permission: 
audience: internal
sort_order: 127
version: 2
is_published: true
---
# Configurar metas comerciais

**Para que serve:** Configurar metas comerciais, no contexto da tela `/settings/goals`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.goals`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/goals`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/goals.
2. Consulte as metas e use a criação ou edição habilitada.
3. Confira os valores antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A autorização é techsales.goals; metas comerciais pertencem ao TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/goals com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/configurar-metas-comerciais.webp)
