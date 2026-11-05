---
module_key: ats
slug: validar-um-perfil-de-vaga-pelo-link
title: Validar um perfil de vaga pelo link
summary: Validar um perfil de vaga pelo link.
article_type: howto
route_pattern: /role-profile/$token
min_permission: 
audience: internal
sort_order: 210
version: 1
is_published: true
---
# Validar um perfil de vaga pelo link

**Para que serve:** Validar um perfil de vaga pelo link, no contexto da tela `/role-profile/$token`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/role-profile/$token`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link recebido.
2. Leia o perfil de vaga.
3. Use os controles de validação disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Validação de perfil do recrutamento não é edição do cadastro compartilhado de cargos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /role-profile/$token com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
