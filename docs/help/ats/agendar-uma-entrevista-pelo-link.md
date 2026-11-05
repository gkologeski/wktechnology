---
module_key: ats
slug: agendar-uma-entrevista-pelo-link
title: Agendar uma entrevista pelo link
summary: Agendar uma entrevista pelo link.
article_type: howto
route_pattern: /schedule/$token
min_permission: 
audience: internal
sort_order: 212
version: 1
is_published: true
---
# Agendar uma entrevista pelo link

**Para que serve:** Agendar uma entrevista pelo link, no contexto da tela `/schedule/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/schedule/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de agendamento recebido.
2. Consulte as opções de horário.
3. Selecione uma opção disponível e confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Agendamento de entrevista do TechHire; não confunda com /book/$slug de reuniões comerciais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /schedule/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
