---
module_key: core
slug: configurar-a-identidade-visual
title: Configurar a identidade visual
summary: Configurar a identidade visual.
article_type: howto
route_pattern: /settings/branding
min_permission: system.branding.view.workspace
audience: internal
sort_order: 116
version: 2
is_published: true
---
# Configurar a identidade visual

**Para que serve:** Configurar a identidade visual, no contexto da tela `/settings/branding`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.branding`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/branding`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Workspace > White-label.
2. Revise a aba Workspace (ERP).
3. Escolha a aba do módulo desejado ou Convite para personalizar o contexto correspondente.
4. Confira a prévia e salve pelo controle do formulário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A identidade do workspace e a identidade por módulo são contextos diferentes. Arquétipos trocam estilo preservando identidade e assets; não prometa mudança de host ou licença ao trocar o tema.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/branding com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/configurar-a-identidade-visual.webp)
