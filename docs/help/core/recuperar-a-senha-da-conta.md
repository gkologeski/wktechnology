---
module_key: core
slug: recuperar-a-senha-da-conta
title: Recuperar a senha da conta
summary: Recuperar a senha da conta.
article_type: howto
route_pattern: /reset-password
min_permission: 
audience: internal
sort_order: 209
version: 1
is_published: true
---
# Recuperar a senha da conta

**Para que serve:** Recuperar a senha da conta, no contexto da tela `/reset-password`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/reset-password`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Recuperar senha a partir do login.
2. Siga o formulário exibido para recuperação.
3. Use o link de recuperação recebido para definir a nova senha quando essa etapa for apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Não envie senha, token ou link de recuperação a terceiros. O fluxo depende do estado de recuperação da sessão.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /reset-password com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
