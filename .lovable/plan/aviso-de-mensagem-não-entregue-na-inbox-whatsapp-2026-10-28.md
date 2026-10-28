# Aviso de mensagem não entregue na Inbox WhatsApp

Porte P — estimativa ~20–30 min.

## O que muda
Abaixo do balão de uma mensagem enviada com status "Falhou" ou "Não entregue", aparece uma pequena etiqueta vermelha com letras brancas (fundo `destructive`, texto `destructive-foreground`, fonte 11px, cantos arredondados, alinhada à direita), por exemplo:
- "Não entregue: número sem WhatsApp ou inativo" (131026)
- "Não entregue: bloqueada pela Meta para preservar o engajamento" (131049)
- "Não entregue: pendência de pagamento na conta Meta" (131042)
- "Não entregue: número em teste restrito da Meta" (130472)
- "Não entregue: fora da janela de 24h — use um modelo aprovado" (131047)
- "Não entregue: número não autorizado no ambiente de teste" (63015)
- Código desconhecido: "Não entregue: <mensagem original da Meta>" ou "motivo não informado".

Passar o mouse mostra o código técnico e o texto original da Meta. Mensagens recebidas e entregues não mudam.

## Técnico
- Novo `src/lib/whatsapp/delivery-error.ts`: `describeDeliveryError(code, message)` → texto PT-BR (função pura) + teste unitário com os códigos acima.
- `InboxMessageBubble` (inbox-workspace.tsx) ganha prop opcional `failureReason`; renderiza a etiqueta com `role="status"`.
- `inbox.whatsapp.tsx` passa `error_code`/`error_message` (confirmar que já estão no select do histórico; se não, adicionar às colunas lidas).
- Sem mudança de banco, RLS ou permissões (apresentação de dado já visível ao usuário); classificar no `permission-contracts` como apresentação.
- Validar: teste unitário, Playwright numa conversa com falha (ex.: Wellington Franca), modo claro/escuro.
