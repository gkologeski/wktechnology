---
module_key: crm
slug: entrar-em-uma-sala-publica-de-video
title: Entrar em uma sala pública de vídeo
summary: Entrar em uma sala pública de vídeo.
article_type: howto
route_pattern: /meet/$token
min_permission: 
audience: internal
sort_order: 201
version: 1
is_published: true
---
# Entrar em uma sala pública de vídeo

**Para que serve:** Entrar em uma sala pública de vídeo, no contexto da tela `/meet/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/meet/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link da reunião.
2. Informe Seu nome e E-mail opcional.
3. Use a ação de entrada apresentada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O token e o estado da reunião condicionam a entrada; falha de acesso não se resolve compartilhando credenciais internas.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /meet/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
