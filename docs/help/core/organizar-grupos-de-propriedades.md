---
module_key: core
slug: organizar-grupos-de-propriedades
title: Organizar grupos de propriedades
summary: Organizar grupos de propriedades.
article_type: howto
route_pattern: /settings/property-groups
min_permission: 
audience: internal
sort_order: 157
version: 1
is_published: true
---
# Organizar grupos de propriedades

**Para que serve:** Organizar grupos de propriedades, no contexto da tela `/settings/property-groups`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/property-groups`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/property-groups.
2. Consulte os grupos.
3. Informe Novo nome para a alteração desejada e use o controle disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Grupos organizam propriedades; não são grupos de usuários e não concedem permissão sobre os campos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /settings/property-groups com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
