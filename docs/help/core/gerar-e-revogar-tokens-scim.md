---
module_key: core
slug: gerar-e-revogar-tokens-scim
title: Gerar e revogar tokens SCIM
summary: Gerar e revogar tokens SCIM.
article_type: howto
route_pattern: /settings/scim
min_permission: 
audience: internal
sort_order: 163
version: 1
is_published: true
---
# Gerar e revogar tokens SCIM

**Para que serve:** Gerar e revogar tokens SCIM, no contexto da tela `/settings/scim`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/scim`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/scim.
2. Consulte Base URL e endpoints Users e Groups.
3. Informe um nome para a integração e clique Gerar.
4. Copie o token uma única vez para um gerenciador de segredos.
5. Use a revogação quando a integração não deva mais acessar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O valor completo do token aparece uma única vez. A existência dos endpoints na tela não certifica compatibilidade completa com todo IdP; valide o conector sem expor credenciais.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/scim com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
