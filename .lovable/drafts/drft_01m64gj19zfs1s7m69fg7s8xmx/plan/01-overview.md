# Bruna insiste com o contato errado depois de uma indicação

## O que aconteceu (conferido)
- 28/10 14:43 — Rodrigo Paiola disse que cuida de desenvolvimento/teste/produto e indicou **Sr. Bruno, bruno@dsin.com.br**, para infraestrutura.
- 14:43 — Bruna ignorou a indicação e perguntou a Rodrigo sobre "a principal dor no desenvolvimento".
- 29/10 13:44 — a retomada automática mandou praticamente **a mesma pergunta** de novo.

## Por que aconteceu (no código)
1. A Lia/Bruna só registra uma indicação quando vem com **telefone** escrito. Indicação só por **e-mail** (ou só pelo nome) é descartada, e a conversa continua aberta, como se nada tivesse acontecido.
2. A conversa continua aberta, então as retomadas automáticas seguem e reaproveitam a última pergunta.
3. A retomada não confere se está repetindo a última mensagem enviada.

## O que vou mudar
1. **Indicação por e-mail ou nome também conta.** Registrar a pessoa indicada (nome, e-mail, telefone se houver) com a mensagem do cliente como prova, mantendo a regra de nunca inventar dado: o e-mail precisa estar escrito pelo cliente.
2. **Depois de uma indicação, para de insistir.** Cancela as retomadas automáticas para quem indicou. Bruna agradece e, se fizer sentido, pergunta só se pode citar o nome dele ao contatar a pessoa indicada; não volta a qualificar o Rodrigo.
3. **Criar a pessoa indicada no CRM como sugestão para revisão humana** (mesmo caminho atual de indicação por telefone); nada é enviado ao Bruno automaticamente, pois não há WhatsApp dele.
4. **Retomada não repete mensagem.** Se o texto ficar quase igual ao último enviado, a retomada é cancelada com motivo registrado.
5. **Ajuste no prompt:** reforçar que, quando o cliente indica outra pessoa, a resposta deve tratar da indicação.
6. **Rodrigo Paiola:** cancelar retomadas pendentes desta conversa e registrar a indicação do Bruno (com seu aceite, é dado real).

## Estimativa
Porte **M**, cerca de 1h30–2h. Sem mudança no banco previsto (usa o estado da conversa que já existe).

## Validação
Testes novos: indicação por e-mail, só por nome, com telefone (atual), e retomada repetida bloqueada. Teste com o prompt real em 3 mensagens. `permissions:check`, typecheck e testes do SDR. Nada publicado sem seu aceite.
