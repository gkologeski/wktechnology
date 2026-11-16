# INBOX-SO-WHATSAPP — aba WhatsApp mostra só WhatsApp

Porte P, estimativa 1h30–2h.

## Problema
Na Inbox › WhatsApp aparecem conversas que são só ligações (prévia "📞 Ligação · ..."). Hoje cada ligação grava a prévia e o horário da conversa, então ela sobe para o topo e conversas criadas apenas por ligação aparecem como se fossem WhatsApp.

## O que muda
- **Aba WhatsApp:** lista só conversas com pelo menos uma mensagem de WhatsApp real. Prévia, horário e ordem usam a última mensagem de WhatsApp, nunca a ligação.
- **Dentro da conversa (aba WhatsApp):** o histórico mostra só mensagens de WhatsApp; as ligações ficam fora.
- **Contadores** (Abertas/Fechadas/Minhas/Sem dono/Interagiu) contam só conversas de WhatsApp.
- **Aba Ligações e Inbox unificada:** continuam mostrando as ligações como hoje.
- Ajuda da Inbox WhatsApp atualizada.

## Detalhes técnicos
- Migração aditiva: colunas `last_wa_message_at` e `last_wa_message_preview` em `whatsapp_conversations`, preenchidas por backfill a partir de `whatsapp_messages` com `call_attempt_id is null`, mantidas por gatilho no insert de mensagem não-ligação. Índice parcial para a paginação.
- `call-inbox.server.ts` continua atualizando `last_message_*` (usados pela unificada); a lista WhatsApp (`channel-page`/consulta da rota) passa a filtrar `last_wa_message_at is not null` e ordenar por ele.
- Histórico da rota WhatsApp filtra `call_attempt_id is null`.
- Sem mudança de permissão (mesma leitura/RLS); contrato de permissão atualizado com hash; testes de regra da lista.
