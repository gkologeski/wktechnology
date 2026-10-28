Recriar o histórico das respostas de WhatsApp (últimos 10 dias)

Porte P, cerca de 30–40 min. Só o workspace WK. Nenhuma mensagem é enviada.

## O que a consulta mostrou
- 1.663 mensagens enviadas entre 19/10 e 28/10 estão nas conversas, mas não aparecem no histórico do contato. São 1.090 contatos.
- 1.111 delas foram enviadas por uma pessoa pela Inbox. Essas são as "respostas".
- 552 não têm quem enviou registrado: são campanhas ou agente. Ficam de fora, a não ser que você peça para incluir.

## O que será feito
1. Prévia sem gravar nada: contagem por pessoa e por dia, mais 5 exemplos.
2. Cópia de segurança: a lista exata do que será criado, com uma marca de recuperação que permite desfazer tudo de uma vez.
3. Criar um registro "WhatsApp enviado" por mensagem no contato da conversa:
   - com a data e hora originais;
   - com o texto (ou o nome do modelo);
   - com quem enviou como autor e responsável.
4. Sem duplicar: o código da mensagem é conferido, e quem já tiver registro fica de fora. Pode rodar de novo com segurança.
5. Conferência: a contagem final deve bater com a prévia. Depois, Playwright em uma ficha de contato para ver os itens na linha do tempo.

## Fora do escopo
- Mensagens de campanha ou do agente (552).
- Outros workspaces.
- Alterar as conversas, os contatos ou os responsáveis.
- Publicar.

## Detalhes técnicos
- Inserção única em `activities`, a partir de `whatsapp_messages` (outbound, `sent_by` preenchido) ligada a `whatsapp_conversations.contact_id`. Campos: `owner_id`/`assigned_to`/`created_by` recebem `sent_by`; `created_at` e `outcome_set_at` recebem o envio original.
- Em `external_ids` vão `wa_message_id`, `conversation_id` e `backfill='wa_outbound_2026_10_28'`. Desfazer = apagar por essa marca.
- Antes de gravar, confirmar que todo `sent_by` é membro ativo. Quem não for vai para a lista de exceções e não é forçado.
