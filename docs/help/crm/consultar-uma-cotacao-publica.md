---
module_key: crm
slug: consultar-uma-cotacao-publica
title: Consultar uma cotação pública
summary: Consultar uma cotação pública.
article_type: howto
route_pattern: /quote/$token
min_permission: 
audience: internal
sort_order: 206
version: 1
is_published: true
---
# Consultar uma cotação pública

**Para que serve:** Consultar uma cotação pública, no contexto da tela `/quote/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/quote/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de cotação recebido.
2. Revise o conteúdo e as ações apresentadas.
3. Confira os termos antes de responder.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cotação, proposta e contrato são documentos distintos; a existência de link não executa conversão automática.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /quote/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
