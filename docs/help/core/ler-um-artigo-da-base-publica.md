---
module_key: core
slug: ler-um-artigo-da-base-publica
title: Ler um artigo da base pública
summary: Ler um artigo da base pública.
article_type: howto
route_pattern: /kb/$slug
min_permission: 
audience: internal
sort_order: 198
version: 1
is_published: true
---
# Ler um artigo da base pública

**Para que serve:** Ler um artigo da base pública, no contexto da tela `/kb/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/kb/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra um artigo a partir de /kb.
2. Leia o conteúdo disponível para o slug.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A base pública não expõe automaticamente help_articles. Slug inexistente não deve ser substituído por token ou identificador de outro recurso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /kb/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
