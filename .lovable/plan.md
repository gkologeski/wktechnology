# Bruna: entender "eu mesmo" como confirmação do responsável (só no prompt)

## O que aconteceu (conferido no banco)
- A abertura perguntou: "É com você mesmo ou tem alguém mais indicado?". O Gustavo respondeu "tudo e vc? eu mesmo".
- A Bruna v4 não entendeu a resposta como confirmação e perguntou de novo se ele era o responsável.
- Depois que ele respondeu "TI", ela foi direto para "vocês têm alguma demanda?", sem explicar o motivo do contato.

## O que muda (somente o prompt; nenhuma regra no código)
Vou publicar uma nova versão da Bruna (v5), com estas instruções acrescentadas à persona:
1. Se a mensagem anterior perguntou se a pessoa é o responsável e ela respondeu afirmando ("eu mesmo", "sou eu", "é comigo", "sim", "isso", "eu cuido"), mesmo misturado com um cumprimento, isso já é a confirmação. Ela não pode perguntar de novo.
2. Antes de falar de demanda, a Bruna responde ao cumprimento, agradece, explica em uma frase quem somos e por que entrou em contato, e só então pergunta sobre demandas.
3. Ela nunca repete uma pergunta que o cliente já respondeu na conversa.

O restante do prompt fica como está. A Lia já tem a orientação de contexto da v18 em diante e recebe apenas o item 1 e o item 3, numa nova versão (v21).

## Validação
- No simulador do agente, que não grava nada, vou testar estas respostas: "tudo e vc? eu mesmo", "sou eu sim" e "não, fala com o Luiz". Confirmo que nos dois primeiros casos ela não pergunta de novo e explica o motivo do contato, e que no terceiro pede ou registra a indicação.
- Não vou reenviar nada ao Gustavo.

## Detalhes técnicos
- As versões são publicadas pela RPC `sdr_publish_agent_version` (rascunho → publicada), sem migration e sem alterar código ou permissões.
- O prompt passa a valer na hora, sem publicar o app.

## Estimativa
Porte P, cerca de 20 a 30 minutos.
