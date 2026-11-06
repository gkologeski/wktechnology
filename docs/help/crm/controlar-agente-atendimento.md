---
module_key: crm
slug: controlar-agente-atendimento
title: Controlar o agente no atendimento
summary: Assumir um atendimento do agente e devolver a conversa após a revisão.
article_type: howto
route_pattern: /inbox/chat
min_permission:
audience: internal
sort_order: 303
version: 1
is_published: true
---
# Controlar o agente no atendimento
**Para que serve:** Alternar entre atendimento humano e automático (chat e e-mail).
**Quem pode fazer:** Membros autorizados a controlar o atendimento. Confirmar identidade exige `system.channels.approve.workspace`.
**Onde fica:** Menu > TechSales > Inbox unificada > Chat ao vivo (`/inbox/chat`) ou Email (`/inbox/email`).
**Antes de começar:** Abra uma conversa com agente ativo.

## Passo a passo
1. Veja se o painel mostra "Agente atendendo" ou "Atendimento humano".
2. Para interromper o agente, clique em "Assumir atendimento".
3. Revise o histórico.
4. Se houver entrega incerta, faça a revisão pedida.
5. Para retomar, clique em "Devolver ao agente".
6. Após verificar a pessoa, clique em "Confirmar identidade da pessoa associada".
<!-- screenshot: painel Agente deste atendimento -->

## Resultado esperado
O painel mostra quem atende. "Identidade confirmada para este atendimento.".

## Regras e limites
- Controlar o agente é diferente de atribuir responsável.
- A devolução pode ficar bloqueada até revisar entrega incerta.
- "Contexto privado do CRM bloqueado": contexto ainda não aprovado. Não confirme identidade só para liberar.

## Erros comuns
- "Não foi possível consultar o estado do agente.": clique em "Tentar novamente".
- Botão de confirmação ausente: falta `system.channels.approve.workspace`.

## Relacionados
- [Atender o chat ao vivo](/ajuda/crm/atender-chat-ao-vivo)
- [Responder e-mails na Inbox](/ajuda/crm/responder-emails-inbox)
