---
module_key: crm
slug: configurar-pipelines-do-crm
title: Configurar pipelines do CRM
summary: Configurar pipelines do CRM.
article_type: howto
route_pattern: /settings/pipelines
min_permission: system.pipelines.view.workspace
audience: internal
sort_order: 154
version: 2
is_published: true
---
# Configurar pipelines do CRM

**Para que serve:** Configurar pipelines do CRM, no contexto da tela `/settings/pipelines`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.pipelines`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/pipelines`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Estrutura CRM > Pipelines.
2. Revise Nome, Entidade e Visualização padrão.
3. Edite os estágios e confira tipo, identificador, probabilidade, SLA e cor.
4. Revise campos do card e substatus antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.pipelines. Não é o pipeline de recrutamento do ATS em /pipelines; substatus tem controle de gerenciamento próprio.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/pipelines com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/configurar-pipelines-do-crm.webp)
