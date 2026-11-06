# Bruna: entender "eu mesmo" como confirmação do responsável

## O que aconteceu (conferido no banco)
- A abertura perguntou: "É com você mesmo ou tem alguém mais indicado?". O Gustavo respondeu "tudo e vc? eu mesmo".
- Na Bruna v4, o turno não gravou a confirmação (estado da conversa ficou vazio) e a resposta perguntou de novo se ele era o responsável.
- Depois que ele respondeu "TI", a Bruna foi direto para "vocês têm alguma demanda?", sem explicar o motivo do contato. É o mesmo erro já corrigido na Lia (v18+).

## O que muda
1. **Detector de confirmação (regra fixa, sem IA):** quando a última mensagem nossa pergunta se a pessoa é o responsável ("é com você", "é você mesmo", "você cuida", "você é o responsável") e o cliente responde afirmando ("eu mesmo", "sou eu", "é comigo", "sim", "isso", "eu cuido", inclusive misturado com cumprimento), o sistema grava a confirmação do responsável com a mensagem como prova. Negações e indicações ("não, é o fulano", "mas quem cuida é…") continuam fora.
2. **Auditoria antes do envio:** com o responsável já confirmado, a mensagem que voltar a perguntar se ele é o responsável é recusada e refeita (até as tentativas já existentes). Se ainda falhar, a conversa vai para humano.
3. **Prompt da Bruna (nova versão publicada):** entra a mesma orientação da Lia. A resposta afirmativa ao "é com você?" vale como confirmação. Depois disso, ela agradece, explica em uma frase quem somos e por que entrou em contato, e só então pergunta sobre demandas.
4. **Gustavo:** não vou reenviar nada a ele. A conversa segue normalmente na próxima mensagem dele.

## Testes
- "tudo e vc? eu mesmo", "sou eu sim", "é comigo" e "isso" confirmam. "não, fala com o Luiz" e "mas quem cuida é a Ana" não confirmam.
- A auditoria recusa a pergunta repetida quando a confirmação já está gravada.
- Os testes atuais do agente continuam passando.

## Detalhes técnicos
- Nova função pura `detectDecisionMakerAffirmation` em `src/lib/prospecting/sdr/`. Ela é usada em `conversation-state.ts` (aplica `decision_maker_confirmed` com `message_id` quando a IA não marcou) e no pipeline de `audit-outcome.ts`, com o motivo novo `repeat_responsibility_question`.
- A Bruna é publicada pela RPC `sdr_publish_agent_version`, com o texto alinhado à Lia v20.
- Não há migration nem mudança de permissões.

## Estimativa
Porte P, cerca de 1h a 1h30: código e testes ~45 min, prompt e publicação da versão ~15 min, validação no simulador ~15 min. Para a correção valer no app publicado, depende de você publicar.
