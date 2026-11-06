---
module_key: core
slug: manter-grupos-empresariais
title: Manter grupos empresariais
summary: Manter grupos empresariais.
article_type: howto
route_pattern: /settings/legal-entity-groups
min_permission: system.legal_entity_groups.view.workspace
audience: internal
sort_order: 139
version: 2
is_published: true
---
# Manter grupos empresariais

**Para que serve:** Manter grupos empresariais, no contexto da tela `/settings/legal-entity-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/legal-entity-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > Grupos empresariais.
2. Consulte os grupos cadastrados.
3. Revise os vínculos de empresas antes de salvar alterações.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Grupo empresarial não é time de usuários, cargo de acesso nem agrupamento de workspaces.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/legal-entity-groups com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/manter-grupos-empresariais.webp)
