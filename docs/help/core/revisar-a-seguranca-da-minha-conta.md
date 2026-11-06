---
module_key: core
slug: revisar-a-seguranca-da-minha-conta
title: Revisar a segurança da minha conta
summary: Revisar a segurança da minha conta.
article_type: howto
route_pattern: /settings/security
min_permission: 
audience: internal
sort_order: 165
version: 2
is_published: true
---
# Revisar a segurança da minha conta

**Para que serve:** Revisar a segurança da minha conta, no contexto da tela `/settings/security`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/security`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Minha conta > Segurança (2FA).
2. Consulte o estado e as opções de autenticação multifator.
3. Siga o fluxo de configuração e validação apresentado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Segurança pessoal não substitui a política de acesso do workspace. Não publique QR codes, segredos de MFA ou códigos de recuperação.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/security com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-a-seguranca-da-minha-conta.webp)
