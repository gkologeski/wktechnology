---
module_key: finance
slug: configurar-o-gateway-de-pagamentos
title: Configurar o gateway de pagamentos
summary: Configurar o gateway de pagamentos.
article_type: howto
route_pattern: /settings/payments
min_permission: 
audience: internal
sort_order: 151
version: 1
is_published: true
---
# Configurar o gateway de pagamentos

**Para que serve:** Configurar o gateway de pagamentos, no contexto da tela `/settings/payments`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/payments`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/payments.
2. Revise Provedor, Ambiente e Método padrão.
3. Confira a seção Webhook e salve se autorizado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Consulta exige techfinance.payments_settings.view.workspace e alteração manage.workspace. Separe ambiente de testes de produção; não copie segredos de gateway.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/payments com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
