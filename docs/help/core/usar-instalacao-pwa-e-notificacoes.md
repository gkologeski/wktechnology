---
module_key: core
slug: usar-instalacao-pwa-e-notificacoes
title: Usar instalação PWA e notificações
summary: Usar instalação PWA e notificações.
article_type: howto
route_pattern: /settings/mobile
min_permission: 
audience: internal
sort_order: 144
version: 1
is_published: true
---
# Usar instalação PWA e notificações

**Para que serve:** Usar instalação PWA e notificações, no contexto da tela `/settings/mobile`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/mobile`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/mobile.
2. Confira a opção Instalar agora quando disponível no navegador.
3. Revise as opções de notificações e o estado de permissão do navegador.
4. Leia a orientação de Modo offline.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Instalação e push dependem do navegador. Não prometa que todas as operações do ERP funcionem offline.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/mobile com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
