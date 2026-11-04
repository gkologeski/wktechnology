# Devolver para a fila os contatos da ICP 012 barrados pela restrição da Meta

Estimativa: 10–15 min (porte P). Só altera dados, sem mudar código.

## O que encontrei
A campanha "ICP 012" está pausada: 399 enviados, 324 pendentes e 5 pulados. Entre os que aparecem como "enviados", a Meta recusou:
- **35 com erro 131031 "Business Account locked"** (conta bloqueada por restrição, entre 22:25 e 22:35 UTC). É a restrição de spam/conta citada no seu pedido. **Esses 35 voltam para a fila.**
- 26 com erro 131026 (número sem WhatsApp), 26 com 131049 (limite de engajamento) e 3 com 130472 (experimento da Meta). **Esses ficam como estão**: os bloqueios automáticos de 90 e de 7 dias já cuidam deles, e reenviar agora seria recusado de novo.

Não apareceu nenhum erro 131048 ("Spam Rate limit") nesta campanha.

## O que será feito
1. Voltar os 35 destinatários do erro 131031 para "pendente" na ICP 012, limpando o vínculo com a mensagem recusada, a data de envio e o erro. A mensagem recusada continua no histórico da conversa.
2. Conferir as novas contagens: devem ficar 359 pendentes e 364 enviados.
3. A campanha continua pausada. Nada será enviado agora.

## Atenção
Enquanto a conta comercial estiver bloqueada na Meta, qualquer novo envio vai falhar de novo. Antes de retomar, confira na Meta Business Suite se o bloqueio foi suspenso.
