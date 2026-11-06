---
module_key: crm
slug: manter-templates-de-e-mail
title: Manter templates de e-mail
summary: Manter templates de e-mail.
article_type: howto
route_pattern: /settings/email-templates
min_permission: 
audience: internal
sort_order: 122
version: 1
is_published: true
---
# Manter templates de e-mail

**Para que serve:** Manter templates de e-mail, no contexto da tela `/settings/email-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.automation.email_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/email-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Templates de email nas configurações.
2. Consulte os modelos e abra a criação ou edição disponível.
3. Revise o conteúdo antes de salvar ou excluir um modelo.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Usa system.automation.email_templates. Um modelo salvo não configura a conexão de e-mail nem garante envio.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/email-templates com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
