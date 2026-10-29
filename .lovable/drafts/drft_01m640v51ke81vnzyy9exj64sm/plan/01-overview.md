# Acompanhamento da Bruna deve continuar a conversa

**Porte P/M · 45–75 min** (15 min de diagnóstico + 30–60 min de correção e testes). Depende do banco estar no ar: agora ele está fora do ar, então não consegui abrir a conversa do Michael Moraes.

## O que já conferi no código
- No acompanhamento, a IA recebe as últimas 30 mensagens da conversa e um aviso de que é uma "retomada automática (sem nova mensagem do cliente)".
- Nenhuma instrução diz como retomar. Não há nada como "retome o último combinado, por exemplo se o cliente viu a apresentação" nem "não se apresente de novo".

## Causa provável (ainda não confirmada)
Uma destas duas, ou as duas juntas:
1. **Histórico incompleto.** Talvez a conversa de ontem não esteja gravada no chat dessa conversa. Pode ter sido perdida no erro de gravação de 28/10, que já corrigimos, ou pode estar em outra conversa, do número da Lia. Nesse caso a IA viu uma conversa "vazia" e começou do zero.
2. **Falta de orientação.** Com o histórico completo, a IA voltou ao roteiro de qualificação porque ninguém pediu que ela retomasse o combinado.

## Passos
1. **Diagnóstico.** Abrir a conversa do Michael Moraes e o registro do acompanhamento de hoje, e ver quais mensagens a IA realmente recebeu. Esse passo decide a causa.
2. **Se o histórico estiver incompleto:** recuperar as mensagens que faltam e corrigir o ponto em que elas se perdem. Se a conversa estiver dividida entre os números da Lia e da Bruna, juntar o histórico do mesmo contato.
3. **Sempre:** acrescentar, por instrução à IA (sem regra fixa no código), uma orientação própria para acompanhamentos:
   - continuar do último assunto pendente: apresentação enviada, proposta, retorno prometido, reunião;
   - não se apresentar de novo e não repetir perguntas já respondidas;
   - ser curto e fazer uma única pergunta de retomada, por exemplo: "Conseguiu dar uma olhada na apresentação?".
4. **Testes.** Testes automáticos do texto da instrução, mais um teste real da IA com a conversa do Michael para mostrar a mensagem que ela geraria, sem enviar nada.

## Fora do escopo
- Não reenvio nada ao Michael.
- Não mudo os horários nem a quantidade de acompanhamentos.
