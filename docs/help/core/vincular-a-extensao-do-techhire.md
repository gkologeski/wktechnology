---
module_key: core
slug: vincular-a-extensao-do-techhire
title: Vincular a extensão do TechHire
summary: Vincular a extensão do TechHire.
article_type: howto
route_pattern: /auth/extension-link
min_permission: 
audience: internal
sort_order: 100
version: 2
is_published: true
---
# Vincular a extensão do TechHire

**Para que serve:** Vincular a extensão do TechHire, no contexto da tela `/auth/extension-link`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/auth/extension-link`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a tela de vínculo a partir do fluxo da extensão.
2. Informe a URL do TechHire e a API key nos campos correspondentes.
3. Siga a ação de vínculo apresentada pela tela.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Trate a API key como segredo; não a inclua em chamados, capturas ou artigos. Esta conexão serve à extensão do TechHire, não cria um sétimo módulo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /auth/extension-link com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/vincular-a-extensao-do-techhire.webp)
