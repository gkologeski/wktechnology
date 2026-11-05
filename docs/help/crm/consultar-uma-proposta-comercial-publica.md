---
module_key: crm
slug: consultar-uma-proposta-comercial-publica
title: Consultar uma proposta comercial pública
summary: Consultar uma proposta comercial pública.
article_type: howto
route_pattern: /proposal/$token
min_permission: 
audience: internal
sort_order: 205
version: 1
is_published: true
---
# Consultar uma proposta comercial pública

**Para que serve:** Consultar uma proposta comercial pública, no contexto da tela `/proposal/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/proposal/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira o documento da proposta e seus dados.
3. Use somente as ações apresentadas no documento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Documento é carregado pela fonte única loadProposalDocument; não é editor livre e não usa cláusulas como modelo de proposta.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /proposal/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
