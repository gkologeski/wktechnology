---
module_key: core
slug: consultar-planos-e-cobranca
title: Consultar planos e cobrança
summary: Consultar planos e cobrança.
article_type: howto
route_pattern: /settings/billing
min_permission: system.billing.view.workspace
audience: internal
sort_order: 115
version: 2
is_published: true
---
# Consultar planos e cobrança

**Para que serve:** Consultar planos e cobrança, no contexto da tela `/settings/billing`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/billing`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Planos e cobrança.
2. Revise o plano, as cotas mensais e o comparativo.
3. Consulte a seção de planos dos módulos antes de iniciar uma ação de contratação disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O plano não concede automaticamente permissões de operação. Não use os números de referência da tela de quotas da plataforma como contrato comercial.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/billing com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-planos-e-cobranca.webp)
