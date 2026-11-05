---
module_key: core
slug: revisar-pais-padrao-e-telefones-legados
title: Revisar país padrão e telefones legados
summary: Revisar país padrão e telefones legados.
article_type: howto
route_pattern: /settings/phones
min_permission: 
audience: internal
sort_order: 153
version: 1
is_published: true
---
# Revisar país padrão e telefones legados

**Para que serve:** Revisar país padrão e telefones legados, no contexto da tela `/settings/phones`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.phone_normalization`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/phones`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Telefones.
2. Consulte o país padrão e ajuste-o somente com autorização de gerenciamento.
3. Abra os registros de revisão de telefones legados.
4. Confira cada sugestão antes de aplicar uma resolução.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O gate da rota usa system.phone_normalization, mas o menu usa system.language. Cadastro de telefone segue E.164; não invente país para corrigir números ambíguos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/phones com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
