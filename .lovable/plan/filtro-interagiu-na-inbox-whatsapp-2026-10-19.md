# Filtro "Interagiu" na Inbox WhatsApp

## O que muda
Na barra Minhas / Sem dono / Todas da Inbox WhatsApp, entra uma quarta opção **Interagiu**, com contador, que mostra só as conversas em que o cliente mandou pelo menos uma mensagem para nós (mensagem recebida, sem contar as nossas, as da Lia nem as de campanha).

## Como vai funcionar
- Conta como interação qualquer mensagem recebida do cliente: texto, áudio, imagem, documento ou outro tipo.
- Respostas automáticas de robô do cliente (atendimento automático) também contam, porque chegaram de fora; dá para refinar depois, se preferir.
- A busca, a rolagem com mais conversas e a atualização em tempo real continuam como hoje.
- O que cada pessoa pode ver continua igual: o filtro só reduz a lista.

## Detalhes técnicos
- Adicionar `"interacted"` em `AssigneeFilter` (`src/lib/inbox/channel-page.ts`), no z.enum de `channel-page.functions.ts` e um contador `interacted` em `ChannelCounts`.
- Migration aditiva que atualiza `get_inbox_channel_page` (canal whatsapp): aceita `interacted` com `EXISTS` (whatsapp_messages com direction inbound na conversa) e devolve `counts.interacted`. Mantém a mesma assinatura, SECURITY INVOKER e RLS. Confirmo antes que existe índice em (conversation_id, direction); se não existir, crio um.
- `inbox.whatsapp.tsx`: novo `TabsTrigger value="interacted"` com o mesmo estilo dos outros.
- Validação: teste unitário do parse dos contadores, typecheck, lint, build e Playwright na aba nova, comparando com a contagem direto no banco. Nada publicado sem autorização.
