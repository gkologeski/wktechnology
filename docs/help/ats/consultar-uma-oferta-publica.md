---
module_key: ats
slug: consultar-uma-oferta-publica
title: Consultar uma oferta pública
summary: Consultar uma oferta pública.
article_type: howto
route_pattern: /offer/$token
min_permission: 
audience: internal
sort_order: 202
version: 1
is_published: true
---
# Consultar uma oferta pública

**Para que serve:** Consultar uma oferta pública, no contexto da tela `/offer/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/offer/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de oferta recebido.
2. Revise a oferta e as ações disponíveis.
3. Confira as condições antes de responder.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Oferta de recrutamento do TechHire não é proposta comercial do TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /offer/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
