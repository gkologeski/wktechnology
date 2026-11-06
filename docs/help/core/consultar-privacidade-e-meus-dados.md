---
module_key: core
slug: consultar-privacidade-e-meus-dados
title: Consultar privacidade e meus dados
summary: Consultar privacidade e meus dados.
article_type: howto
route_pattern: /settings/privacy
min_permission: 
audience: internal
sort_order: 156
version: 2
is_published: true
---
# Consultar privacidade e meus dados

**Para que serve:** Consultar privacidade e meus dados, no contexto da tela `/settings/privacy`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/privacy`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Privacidade & Meus Dados.
2. Leia as opções de exercício de direitos e tratamento de dados.
3. Revise as consequências antes de solicitar uma ação disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Ações de LGPD não equivalem a autorização para exportar todos os dados do workspace; pedidos devem ser tratados no escopo da conta.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/privacy com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-privacidade-e-meus-dados.webp)
