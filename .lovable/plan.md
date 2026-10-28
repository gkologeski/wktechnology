Recriar o histórico de WhatsApp enviado (últimos 10 dias)

Porte P/M, cerca de 40–60 min. Só o workspace WK. Nenhuma mensagem é enviada.

## O que a consulta mostrou
- 1.663 mensagens enviadas entre 19/10 e 28/10 estão nas conversas, mas não aparecem no histórico do contato. São 1.090 contatos.
- 1.111 foram enviadas por pessoas pela Inbox.
- 552 vieram de campanhas ou de agentes. Elas não guardam quem enviou.
- Todas as 1.663 serão registradas.

## O que será feito
1. Prévia sem gravar nada: contagem por origem (pessoa, campanha, agente), por dia, mais exemplos.
2. Cópia de segurança: a lista exata do que será criado, com uma marca de recuperação que permite desfazer tudo de uma vez.
3. Criar um registro "WhatsApp enviado" por mensagem no contato da conversa:
   - com a data e hora originais;
   - com o texto (ou o nome do modelo);
   - com a origem: "Inbox", "Campanha <nome>" ou "Agente <nome>".
4. Quem fica como autor e responsável:
   - Pessoa: quem enviou.
   - Campanha: quem criou a campanha.
   - Agente: o responsável da conversa.
   - Se nenhum desses for membro ativo, o registro fica sem responsável. Ninguém é atribuído à força.
5. Sem duplicar: o código da mensagem é conferido. Pode rodar de novo com segurança.
6. Conferência: as contagens finais devem bater com a prévia. Depois, Playwright em fichas de contato com os três tipos de envio.

## Também incluído
- Verificar se campanhas e agentes registram cada envio no histórico a partir de agora. Se não registrarem, corrigir (mesma regra de autor) e cobrir com teste.

## Fora do escopo
- Outros workspaces.
- Alterar as conversas, os contatos ou os responsáveis.
- Publicar.

## Detalhes técnicos
- Inserção única em `activities`, a partir de `whatsapp_messages` (outbound) ligada a `whatsapp_conversations.contact_id`. A origem vem de `raw.source` / `sent_by` / `campaign_id` / indicação de turno SDR.
- `created_at` e `outcome_set_at` recebem o horário original. Em `external_ids` vão `wa_message_id`, `conversation_id`, `origin` e `backfill='wa_outbound_2026_10_28'`. Desfazer = apagar por essa marca.
- Caminhos futuros a auditar: o executor de campanhas e o envio do agente SDR (`src/lib/prospecting/sdr/*`, campanhas WhatsApp).
