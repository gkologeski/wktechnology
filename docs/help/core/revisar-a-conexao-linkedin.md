---
module_key: core
slug: revisar-a-conexao-linkedin
title: Revisar a conexão LinkedIn
summary: Revisar a conexão LinkedIn.
article_type: howto
route_pattern: /settings/integrations/linkedin
min_permission: system.linkedin.view.workspace
audience: internal
sort_order: 135
version: 2
is_published: true
---
# Revisar a conexão LinkedIn

**Para que serve:** Revisar a conexão LinkedIn, no contexto da tela `/settings/integrations/linkedin`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/linkedin`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > LinkedIn (Unipile).
2. Confira as contas conectadas.
3. Revise Fuso horário, Início, Fim e Uso de hoje.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os limites exibidos dependem da conta e do provedor; conexão não autoriza envio irrestrito nem substitui consentimento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/integrations/linkedin com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-a-conexao-linkedin.webp)
