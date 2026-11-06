---
module_key: core
slug: acompanhar-meus-chamados-de-suporte
title: Acompanhar meus chamados de suporte
summary: Acompanhar meus chamados de suporte.
article_type: howto
route_pattern: /settings/my-tickets
min_permission: 
audience: internal
sort_order: 146
version: 2
is_published: true
---
# Acompanhar meus chamados de suporte

**Para que serve:** Acompanhar meus chamados de suporte, no contexto da tela `/settings/my-tickets`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/my-tickets`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Meus chamados.
2. Consulte os chamados e abra o detalhe desejado.
3. Use os controles apresentados para acompanhar o tratamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Renderiza MyBugReportsPage. Não confunda chamados de produto com tickets de atendimento comercial em /tickets.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/my-tickets com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/acompanhar-meus-chamados-de-suporte.webp)
