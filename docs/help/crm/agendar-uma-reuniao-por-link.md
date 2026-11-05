---
module_key: crm
slug: agendar-uma-reuniao-por-link
title: Agendar uma reunião por link
summary: Agendar uma reunião por link.
article_type: howto
route_pattern: /book/$slug
min_permission: 
audience: internal
sort_order: 192
version: 1
is_published: true
---
# Agendar uma reunião por link

**Para que serve:** Agendar uma reunião por link, no contexto da tela `/book/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/book/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de agendamento.
2. Escolha um horário disponível.
3. Preencha Nome completo e E-mail, e os demais campos solicitados.
4. Confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Disponibilidade depende do calendário configurado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /book/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
