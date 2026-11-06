---
module_key: ats
slug: indicar-talento-por-link-publico
title: Indicar talento por link público
summary: Indicar talento por link público.
article_type: howto
route_pattern: /refer/$slug
min_permission: 
audience: internal
sort_order: 207
version: 1
is_published: true
---
# Indicar talento por link público

**Para que serve:** Indicar talento por link público, no contexto da tela `/refer/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/refer/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de indicação.
2. Preencha os dados solicitados no formulário.
3. Confira o resultado do envio.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Indicação do TechHire; não é criação direta de pessoa no TechPeople.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /refer/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
