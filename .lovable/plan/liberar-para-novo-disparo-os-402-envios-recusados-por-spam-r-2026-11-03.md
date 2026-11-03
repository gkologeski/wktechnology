# Liberar para novo disparo os 402 envios recusados por "Spam Rate limit hit" (ICP 011)

## O que encontrei
- 402 mensagens da campanha **ICP 011** (hoje está pausada) foram recusadas pela Meta com o erro 131048 "Spam Rate limit hit", entre 15:22 e 16:42 (horário de Brasília).
- Na lista da campanha, as 402 pessoas aparecem como **enviado**. Por isso a campanha não tentaria mandar de novo para elas.

## O que vou fazer
1. Voltar essas 402 pessoas da ICP 011 para **pendente**: apagar a data de envio, o código da mensagem e o erro. Só vale para quem tem a recusa 131048 e nenhuma outra mensagem entregue depois.
2. Manter a mensagem recusada na conversa, com a etiqueta vermelha. O histórico continua igual.
3. Conferir que a regra de "não reenviar a quem recebeu há pouco" não conta mensagem recusada. Se contar, marco essas pessoas com a liberação manual, para que não fiquem barradas.
4. Deixar a campanha **pausada**. Nada é disparado agora. Quando você clicar em retomar, essas pessoas entram de novo na fila, no ritmo com intervalo aleatório.

## Recomendação
Esse erro aparece quando a Meta acha que muitas mensagens de marketing saíram rápido demais pelo número. Antes de retomar, vale aumentar o intervalo entre os envios ou mandar menos por dia. Esta mudança não altera nenhuma configuração.

## Detalhes técnicos
- Atualizo `whatsapp_campaign_recipients` (`status='pending'`, `sent_at`, `wa_message_id`, `error`, `quota_reserved_until` = null) usando join com `whatsapp_messages` por `wa_message_id` e `error_code='131048'`.
- Antes e depois da mudança, confiro a contagem: espero 402.
- Leio `recent-contact.ts` para confirmar se ele filtra por status `failed`.

**Porte:** P. **Estimativa:** 15–20 min.
