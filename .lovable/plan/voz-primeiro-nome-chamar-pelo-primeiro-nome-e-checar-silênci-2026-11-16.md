# VOZ-PRIMEIRO-NOME — Chamar pelo primeiro nome e checar silêncio

Porte: P · Estimativa: 1h a 1h30

## O que muda para você
1. **Primeiro nome:** Lia e Bruna passam a chamar o cliente só pelo primeiro nome ("Oi, Joice"), na saudação e durante a conversa.
2. **Cliente em silêncio:** se o cliente ficar mais de 10 segundos sem responder, a IA pergunta "Você ainda está aí?". Se o silêncio continuar, ela repete no máximo 2 vezes e depois encerra com educação (como hoje, aos 20+ s).
3. **Orientações no prompt:** essas duas regras ficam escritas nas instruções de toda ligação, valendo para todos os roteiros (os atuais e os novos), sem precisar editar cada roteiro.

## Como fica garantido
- O nome entregue à IA nas variáveis do roteiro passa a ser o primeiro nome. Uma nova variável de nome completo continua disponível para quem precisar.
- A pergunta dos 10 segundos é configurada no próprio provedor de voz (aviso por inatividade), e não só pedida no texto — assim ela acontece mesmo se a IA "esquecer".
- O tempo de encerramento por silêncio sobe o suficiente para que a pergunta seja feita antes de desligar.
- Vale também para as ligações das cadências (sequências), se usarem o mesmo envio.

## Detalhes técnicos
- `src/lib/prospecting-vapi-call.server.ts`: `ctx.lead.name` = primeiro nome (fallback: primeiro token do nome; sem nome → vazio), `ctx.lead.full_name` = nome completo; anexar bloco fixo de regras de conversa ao `renderedPrompt` (primeiro nome; perguntar se ainda está aí após 10 s); `messagePlan: { idleMessages: ["Você ainda está aí?"], idleTimeoutSeconds: 10, idleMessageMaxSpokenCount: 2 }`; `silenceTimeoutSeconds` ajustado para ~35.
- Conferir `src/lib/prospecting/sequences/voice.server.ts` e aplicar as mesmas regras se montar assistente próprio.
- Regras puras (primeiro nome + bloco de prompt) em módulo testável com testes: "Joice Fidelis" → "Joice"; nome vazio; bloco contém as duas orientações.
- Ajuda: atualizar artigo de campanhas/roteiros de ligação (bump de versão); hashes em `permission-contracts.json` (sem novas permissões).
- Validação: testes, permissions:check, help:coverage; conferir no registro da próxima chamada que o pedido enviado contém primeiro nome e o aviso de 10 s. Teste real com ligação depende de você disparar uma chamada (consome minutos).
