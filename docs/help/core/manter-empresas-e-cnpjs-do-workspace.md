---
module_key: core
slug: manter-empresas-e-cnpjs-do-workspace
title: Manter empresas e CNPJs do workspace
summary: Manter empresas e CNPJs do workspace.
article_type: howto
route_pattern: /settings/legal-entities
min_permission: system.legal_entities.view.workspace
audience: internal
sort_order: 138
version: 1
is_published: true
---
# Manter empresas e CNPJs do workspace

**Para que serve:** Manter empresas e CNPJs do workspace, no contexto da tela `/settings/legal-entities`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/legal-entities`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Empresas (CNPJs).
2. Consulte as empresas e selecione o cadastro desejado.
3. Revise os campos do formulário antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Cadastro compartilhado de pessoas jurídicas com componente da área financeira; não é a lista de empresas do CRM nem uma lista de workspaces.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/legal-entities com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
