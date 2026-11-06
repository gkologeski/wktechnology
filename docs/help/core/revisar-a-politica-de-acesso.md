---
module_key: core
slug: revisar-a-politica-de-acesso
title: Revisar a política de acesso
summary: Revisar a política de acesso.
article_type: howto
route_pattern: /settings/access-policy
min_permission: 
audience: internal
sort_order: 109
version: 2
is_published: true
---
# Revisar a política de acesso

**Para que serve:** Revisar a política de acesso, no contexto da tela `/settings/access-policy`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/access-policy`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/access-policy.
2. Revise IP allow-list e o estado de Ativar enforcement.
3. Revise timeout de sessão, exigência de MFA e opção Forçar SSO.
4. Consulte as tentativas bloqueadas recentes antes de encerrar a revisão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Timeout validado entre 15 e 1440 minutos; lista limitada a 50 entradas. O helper isIpAllowed aceita correspondência exata e trata entradas com barra como prefixo de três octetos; lista vazia permite. Não interprete isso como suporte CIDR geral nem como prova de enforcement em todo login.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/access-policy com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-a-politica-de-acesso.webp)
