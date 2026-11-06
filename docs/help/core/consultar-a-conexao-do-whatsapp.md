---
module_key: core
slug: consultar-a-conexao-do-whatsapp
title: Consultar a conexão do WhatsApp
summary: Consultar a conexão do WhatsApp.
article_type: howto
route_pattern: /settings/whatsapp
min_permission: system.whatsapp.view.workspace
audience: internal
sort_order: 176
version: 2
is_published: true
---
# Consultar a conexão do WhatsApp

**Para que serve:** Consultar a conexão do WhatsApp, no contexto da tela `/settings/whatsapp`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.whatsapp`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/whatsapp`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Conexão do WhatsApp.
2. Revise a conexão e as contas apresentadas.
3. Siga o fluxo de configuração exibido para a conta desejada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Estar conectado não libera envio irrestrito. Fora das 24 horas desde a última mensagem inbound, envio exige template APPROVED validado no servidor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/whatsapp com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-a-conexao-do-whatsapp.webp)
