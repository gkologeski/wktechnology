---
module_key: ats
slug: consultar-um-link-publico-de-entrevista
title: Consultar um link público de entrevista
summary: Consultar um link público de entrevista.
article_type: howto
route_pattern: /interview/$token
min_permission: 
audience: internal
sort_order: 196
version: 1
is_published: true
---
# Consultar um link público de entrevista

**Para que serve:** Consultar um link público de entrevista, no contexto da tela `/interview/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/interview/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Confira os horários ou a confirmação apresentados.
3. Siga as opções de entrevista em vídeo quando disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Token indisponível deve ser revisado pela equipe de recrutamento.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /interview/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
