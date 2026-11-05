---
module_key: core
slug: explorar-os-modulos-do-workspace
title: Explorar os módulos do workspace
summary: Explorar os módulos do workspace.
article_type: howto
route_pattern: /modules
min_permission: 
audience: internal
sort_order: 106
version: 1
is_published: true
---
# Explorar os módulos do workspace

**Para que serve:** Explorar os módulos do workspace, no contexto da tela `/modules`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/modules`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Módulos.
2. Consulte os módulos disponíveis no workspace.
3. Escolha um módulo liberado para navegar ou consulte Explorar mais.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Os seis módulos são crm, ats, people, contracts, projects e finance. Licença e permissões são controles distintos; services é identificador legado de TechContracts.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /modules com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
