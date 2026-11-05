---
module_key: ats
slug: consultar-vagas-publicas
title: Consultar vagas públicas
summary: Consultar vagas públicas.
article_type: howto
route_pattern: /careers
min_permission: 
audience: internal
sort_order: 193
version: 1
is_published: true
---
# Consultar vagas públicas

**Para que serve:** Consultar vagas públicas, no contexto da tela `/careers`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/careers`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /careers.
2. Consulte as vagas publicadas.
3. Abra a vaga desejada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Não é a lista interna de vagas nem libera acesso ao ATS.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /careers com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
