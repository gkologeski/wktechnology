---
module_key: crm
slug: revisar-lembretes-de-reuniao
title: Revisar lembretes de reunião
summary: Revisar lembretes de reunião.
article_type: howto
route_pattern: /settings/meeting-reminders
min_permission: 
audience: internal
sort_order: 143
version: 2
is_published: true
---
# Revisar lembretes de reunião

**Para que serve:** Revisar lembretes de reunião, no contexto da tela `/settings/meeting-reminders`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.meeting_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/meeting-reminders`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/meeting-reminders.
2. Revise os lembretes e opções de WhatsApp apresentados.
3. Confira a configuração antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.meeting_settings. Envio WhatsApp continua sujeito à janela de 24 horas e a templates aprovados quando exigidos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/meeting-reminders com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/revisar-lembretes-de-reuniao.webp)
