# Expediente em dois períodos e recusa de horários da Lia

## 1. Expediente com dois períodos por dia
Hoje a aba "Habilidades e ferramentas" mostra só um "De/Até" por dia, mas a agenda já aceita mais de um período por dia.

- Cada dia terá **dois períodos**: "De 09:00 até 12:00" e "De 13:00 até 17:00", por exemplo.
- O segundo período pode ficar vazio, quando houver só um intervalo no dia.
- Validações na tela, com mensagem clara:
  - o fim deve ser depois do início;
  - os dois períodos não podem se sobrepor;
  - o segundo período deve vir depois do primeiro.
- Para a Lia, o padrão sugerido será 09:00–12:00 e 13:00–17:00 de segunda a sexta. A configuração atual (09:00–17:00) só muda quando você salvar.
- A agenda já respeita mais de um período por dia: os horários oferecidos ficam dentro dos períodos, nunca no intervalo entre eles.

## 2. Quando o cliente recusa os horários
- Novo comportamento: quando o cliente recusa as opções, a Lia **não manda outros 3 horários de imediato**. Ela registra a recusa e pergunta **qual dia e qual turno** (manhã ou tarde) ele prefere.
- Com a resposta, ela consulta a agenda só naquele dia e turno e oferece até 3 horários livres, sem repetir os já recusados.
- Se o dia ou o turno não tiver horário livre, ela avisa e oferece o mais próximo depois, no mesmo turno.
- Se a resposta for vaga ("semana que vem", "qualquer dia de manhã"), ela consulta o turno pedido nos próximos dias. Se não der para entender, pergunta de novo, uma coisa por vez.
- Dia sem ano ou ambíguo: continua pedindo esclarecimento antes de consultar.

## 3. Regras que continuam iguais
Agenda real do anfitrião, trava contra horário duplicado, confirmação só depois que o Google confirma, nenhum link de autoagendamento.

## Publicação
- O ajuste do expediente vai para o **rascunho** da Lia (v8, a partir da v7 publicada) e só passa a valer quando você publicar.
- A mudança de comportamento na recusa exige publicar o site. Só farei isso com o seu aceite.

## Validação
- Testes automáticos:
  - dois períodos por dia, sem horário no intervalo entre eles;
  - período sobreposto recusado;
  - após recusa, a ferramenta não devolve novos horários e pede dia e turno;
  - dia e turno pedidos devolvem horários só daquele turno;
  - turno sem horário devolve a alternativa mais próxima.
- Conversa simulada no painel de teste: pedir horários, recusar, responder "quinta à tarde" e escolher.
- Verificação completa e versão de produção, com os resultados reais.

## Detalhes técnicos
- `sdr-skills-panel.tsx`: editor de até 2 janelas por dia em `working_hours[wd]`, já `{start,end}[]`. Validação de ordem e sobreposição no cliente e no `zod` de `catalog.ts`.
- `dispatcher.ts › calendar.availability`: com `rejected_previous=true` e sem `date`/`part_of_day`, marca as opções como recusadas e devolve `status: "ask_preference"` com a instrução de perguntar dia e turno. Com `date`+`part_of_day` (ou só `part_of_day`), filtra por turno, exclui os recusados e devolve até 3 horários.
- Prompt em `agent.server.ts` (regra 7) e descrição da ferramenta em `catalog.ts`, atualizados para esse fluxo.
- Sem migration: a configuração continua em `sdr_agent_versions.tool_config`.
