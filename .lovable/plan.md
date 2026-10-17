# Notificação de WhatsApp abre a conversa clicada

## Situação atual
- Quando chega uma mensagem, a notificação é gravada pela função `notify_assigned_inbox_message` com o link fixo `/inbox/whatsapp`. Ela já guarda o ID da conversa (`entity = inbox_conversation`, `entity_id` preenchido).
- Hoje, ao abrir a Inbox, a tela começa sem conversa nenhuma selecionada (`useState(null)`) e não lê a conversa a partir do endereço.

## O que muda
1. **Inbox WhatsApp aceita a conversa no endereço:** `/inbox/whatsapp?conversation=<id>`. Ao carregar, a conversa abre selecionada mesmo que esteja fora da página atual da lista, rola até a mensagem mais recente e marca como lida, como já faz ao clicar. Se a conversa não existir ou se a pessoa não tiver acesso, aparece um aviso e a Inbox abre normalmente.
2. **No sino, ao clicar:** quando a notificação é `inbox_conversation`, o link passa a ser `/inbox/whatsapp?conversation=<entity_id>`. Isso corrige as notificações antigas sem mexer nos dados.
3. **Notificações novas:** uma migration ajusta `notify_assigned_inbox_message` para já gravar o link com a conversa. Nada mais na função muda: quem recebe e o agrupamento continuam iguais.
4. Se a pessoa já estiver na Inbox e clicar em outra notificação, a seleção acompanha a mudança no endereço. Clicar em uma conversa na lista também atualiza o endereço, que então pode ser compartilhado.

## Detalhes técnicos
- `validateSearch` (zod, `conversation` uuid opcional) na rota `inbox.whatsapp.tsx`, sincronizado com `selected`. A conversa vem por um snapshot quando não está na lista (`selectedSnapshot` já existe) e é lida com o cliente do usuário, então a RLS continua valendo.
- Helper `notificationHref(n)` em `notifications-bell.tsx`.
- Migration com `CREATE OR REPLACE` só do link. A RLS não é alterada.
- Testes: unitário do helper e Playwright clicando na notificação para conferir que a conversa abre.
