---
module_key: crm
slug: consultar-o-portal-do-cliente
title: Consultar o portal do cliente
summary: Consultar o portal do cliente.
article_type: howto
route_pattern: /portal/$token
min_permission: 
audience: internal
sort_order: 203
version: 1
is_published: true
---
# Consultar o portal do cliente

**Para que serve:** Consultar o portal do cliente, no contexto da tela `/portal/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/portal/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de portal recebido.
2. Consulte Suas solicitações.
3. Use a ação de criação disponível somente no contexto do portal.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Portal por token não libera acesso interno nem implica portal público de projetos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /portal/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
