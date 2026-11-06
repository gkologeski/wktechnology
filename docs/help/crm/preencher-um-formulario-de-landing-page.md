---
module_key: crm
slug: preencher-um-formulario-de-landing-page
title: Preencher um formulário de landing page
summary: Preencher um formulário de landing page.
article_type: howto
route_pattern: /lp/$slug
min_permission: 
audience: internal
sort_order: 200
version: 1
is_published: true
---
# Preencher um formulário de landing page

**Para que serve:** Preencher um formulário de landing page, no contexto da tela `/lp/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/lp/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a landing page publicada.
2. Leia o conteúdo e preencha os campos do formulário exibido.
3. Use a ação de envio apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Campos e conteúdo dependem dos blocos da página; não há formulário único para todas as landing pages.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /lp/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
