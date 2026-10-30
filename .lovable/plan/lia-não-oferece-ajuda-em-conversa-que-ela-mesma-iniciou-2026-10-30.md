# Lia não oferece "ajuda" em conversa que ela mesma iniciou

Porte P, cerca de 20–30 minutos.

## Problema
Na conversa com Fernanda Torres, a Lia abriu a prospecção perguntando se ela é a responsável por TI. Fernanda respondeu só "Olá boa tarde" e a Lia devolveu "Como posso ajudar você hoje?", como se fosse atendimento receptivo.

## Correção (via instruções da IA, sem regra fixa no código)
Acrescentar às instruções gerais da Lia (mesmo bloco das regras de indicação):
- Em conversa iniciada pela WK (prospecção/campanha), nunca perguntar "como posso ajudar", "em que posso ajudar" ou equivalentes.
- Se o cliente só cumprimentar ou responder algo vago, cumprimentar de volta e retomar a última pergunta feita (ex.: "Boa tarde, Fernanda! Você é a responsável pela área de TI na sua empresa?").

## Validação
- Teste novo garantindo que a regra está nas instruções.
- Rodar os testes da Lia.
- Rodar a conversa da Fernanda com a IA real (sem enviar nada) e conferir que ela retoma a pergunta.
- Nada será publicado nem reenviado.

## Detalhes técnicos
- Arquivo: `src/lib/prospecting/sdr/agent.server.ts` (lista de regras próxima às linhas 117–118) e um teste em `src/lib/prospecting/sdr/`.
