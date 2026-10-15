# Campanha "ICP 001": 2º disparo atrasado

## O que aconteceu (verificado no banco)
- 1º envio às 18:29. O 2º estava previsto para 18:30:57, mas só saiu às 18:34:04. Ficou cerca de 3 minutos atrasado.
- A campanha continua com status "enviando" (running) no banco. A pausa não foi gravada. A rotina segue disparando: hoje há 2 enviados e 157 pendentes.
- A trava de execução da campanha nunca é liberada ao fim de cada rodada. Isso indica que a rotina é interrompida no meio. O sistema que chama a rotina a cada 2 minutos encerra a chamada em poucos segundos. Como a rotina espera de 30 a 60 s entre um envio e outro, ela é cortada durante essa espera.
- Consequência: cada rodada envia no máximo 1 mensagem, e só quando o horário já venceu. Na rodada das 18:32 nem isso aconteceu, porque a rodada foi cortada antes do envio. Na prática, o intervalo de "30–60 s" vira de 2 a 4 minutos. A previsão de "~0 s" na tela fica errada.

## Correção
1. **Agora (com seu aceite):** pausar de verdade a "ICP 001" no banco, para respeitar a sua intenção. Ela fica pausada até você retomar.
2. **Rotina de disparo:** parar de esperar dentro da chamada. Ela responde na hora e continua o trabalho em segundo plano, dentro do limite permitido (até ~30 s após responder). Nesse tempo envia o que estiver vencido e grava o próximo horário. A trava passa a ser liberada sempre, inclusive quando a rotina é cortada, porque vira um prazo curto que expira sozinho.
3. **Cadência:** passar a rotina de campanhas de 2 min para 1 min. Isso só vale enquanto houver campanha enviando. Assim o atraso máximo cai para cerca de 1 min. Custo: mais execuções por hora enquanto houver campanha ativa.
4. **Tela:** "próximo disparo" mostra o horário real previsto e um aviso quando estiver atrasado ("aguardando próxima rodada").
5. **Status:** conferir por que o botão Pausar não gravou o status e corrigir, se for falha.

## Validação
- Testes: o laço não espera além do limite, a trava é liberada, não há envio duplo entre rodadas e a pausa é respeitada.
- Typecheck, lint e build, com os resultados reais.
- Sem envio real: verificar com uma campanha de teste sem destinatários válidos, ou só com o seu número, se você autorizar.

## Detalhes técnicos
- `whatsapp-campaign-tick.ts`: `processPaced` usa `sleep` dentro do handler. Trocar para `waitUntil` do runtime (ou um orçamento menor que o tempo limite da chamada), com o lease curto em `wa_campaign_claim_dispatch`.
- A cadência do cron é ajustada pelas ferramentas de agendamento, não por migration.
- Regra registrada em `src/lib/whatsapp/AGENTS.md`.
