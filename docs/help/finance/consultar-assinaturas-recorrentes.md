---
module_key: finance
slug: consultar-assinaturas-recorrentes
title: Consultar assinaturas recorrentes
summary: Consultar assinaturas recorrentes.
article_type: howto
route_pattern: /settings/recurring
min_permission: 
audience: internal
sort_order: 162
version: 1
is_published: true
---
# Consultar assinaturas recorrentes

**Para que serve:** Consultar assinaturas recorrentes, no contexto da tela `/settings/recurring`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techfinance.recurrences`, `techfinance.invoices`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/recurring`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/recurring.
2. Consulte as assinaturas e o formulário disponível.
3. Revise datas e conteúdo antes de gravar uma alteração.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O mapa de rota usa techfinance.recurrences ou techfinance.invoices. Não confunda recorrência financeira com tipos de assinatura de comunicações.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/recurring com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
