# Corrigir sugestão de cliente que não muda ao trocar de conversa na Inbox

## Causa (confirmada no código)
O quadro "Cliente associado" guarda o tipo (Contato/Lead) e o registro escolhido só quando aparece pela primeira vez. Ao trocar de conversa, ele continua na tela e mantém o registro da conversa anterior, sem ler o da nova.

## O que será feito
1. No quadro "Cliente associado", voltar o tipo e o registro escolhido para os da conversa aberta sempre que a conversa ou o vínculo dela mudar.
2. Reforço: nas três telas que usam o quadro (WhatsApp, E-mail e Chat), recriá-lo a cada troca de conversa, para que nenhum estado da conversa anterior fique para trás.

## Fora do escopo
Sem mudanças no banco, nas permissões ou na regra de associação.

## Validação
- Teste automático do quadro: trocar de conversa mostra o vínculo da nova; conversa sem vínculo fica vazia.
- Playwright em `/inbox/whatsapp`: associar na conversa A, abrir a conversa B e conferir que a sugestão é a de B.
- Verificação de tipos, lint e testes.

## Detalhes técnicos
- `src/components/inbox/inbox-identity-linker.tsx`: `useEffect` em `[conversationId, contactId, leadId]` reajustando `entityType`/`entityId`.
- `inbox.whatsapp.tsx`, `inbox.email.tsx`, `inbox.chat.tsx`: `key={conversationId}` no `<InboxIdentityLinker>`.
