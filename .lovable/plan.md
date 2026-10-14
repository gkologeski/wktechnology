# Lia: juntar mensagens seguidas e nunca confirmar reunião sem criar o evento

## O que foi confirmado no histórico real (conversa de hoje, 12:51–12:52 UTC)
- 12:51 a Lia consultou a agenda de verdade e ofereceu quarta, quinta e sexta às 14h.
- 12:52 você respondeu "6a". A Lia escreveu "Sexta-feira às 14h está confirmada" e, depois do e-mail, "Agendado". **Nenhuma marcação foi feita**: no registro de ferramentas não existe nenhuma chamada de reserva depois da consulta. Ela só escreveu o texto, por isso não há nada na agenda.
- A regra de mensagens seguidas hoje descarta o turno anterior quando chega outro. O turno mais novo já lê o histórico inteiro, mas o turno antigo é marcado como "descartado" e pode perder o que estava fazendo.

## 1. Mensagens seguidas são juntadas, não descartadas
- Quando chegam várias mensagens em sequência, o sistema espera um pouco (alguns segundos) e responde **uma vez, considerando todas juntas**.
- O turno antigo deixa de ser "descartado": é marcado como "agrupado" no turno novo, que leva explicitamente todas as mensagens pendentes do cliente desde a última resposta da Lia.
- Se um turno já estiver respondendo quando chega mensagem nova, ele termina e o próximo turno considera a mensagem nova, sem repetir a mesma resposta.
- O histórico mostra "Mensagens agrupadas" em vez de "descartado".

## 2. Confirmação só com reserva real
- Se a resposta da Lia disser que algo foi agendado, marcado, confirmado ou remarcado, e nesse turno não houve reserva confirmada pela agenda, **a resposta não é enviada**. O turno é refeito obrigando a Lia a chamar a reserva; se ainda assim não houver reserva, ela pede confirmação do horário ao cliente, sem dizer que está marcado.
- Escolhas curtas como "6a", "sexta", "a segunda", "a última" passam a ser reconhecidas como escolha de uma das opções vigentes e levam à reserva.
- Pedido de e-mail para convite acontece **antes** da reserva quando o e-mail ainda não é conhecido, para o convite já sair com o evento.

## 3. Sua conversa de hoje
- Não vou marcar nada sozinho. Proposta: depois de publicado, a Lia avisa na conversa que a reunião ainda não foi registrada e pergunta se confirma sexta 16/10 às 14h; com o "sim", ela cria o evento de verdade. Se preferir, você marca manualmente.

## Validação
- Testes automáticos: três mensagens seguidas geram uma resposta só com as três no contexto; texto "agendado" sem reserva é bloqueado; "6a" resolve para a opção de sexta e chama a reserva; e-mail pedido antes da reserva.
- Conversa simulada no painel de teste (agenda simulada) reproduzindo o caso de hoje.
- Verificação completa e versão de produção, com resultados reais.
- Publicar o site só com o seu aceite.

## Detalhes técnicos
- `worker.server.ts` (linhas ~278–293): trocar descarte por debounce (`run_after` deslocado ~8s no enfileiramento) + ao processar, marcar jobs irmãos `queued` como `merged` (status `discarded` com `error: "merged_into:<id>"` se o enum não aceitar novo valor) e montar `pending_inbound` com todas as inbound após a última outbound.
- Novo guarda em `time-guard.ts` (ou `booking-guard.ts`): regex PT-BR de confirmação (agendad|marcad|confirmad|reservad|remarcad) × `toolCalls` do turno com `calendar.book/reschedule` `ok` e status confirmado; falha → uma nova rodada com instrução de sistema, depois fallback seguro.
- `scheduling.ts`: resolver de seleção para abreviações de dia ("6a", "sex", "sexta-feira") contra `sdr_slot_offers` vigentes.
- Prompt (`agent.server.ts` regra de agenda): nunca afirmar marcação sem resultado da ferramenta; coletar e-mail antes de reservar.
- Sem migration prevista (se novo status for necessário, migration aditiva).
