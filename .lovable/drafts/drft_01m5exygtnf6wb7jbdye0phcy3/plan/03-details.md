## Validação
- Testes automáticos com as frases reais de cada caso, mais casos de controle para não encerrar conversas boas. Exemplos de controle: "sou eu", "saí da reunião".
- Simulação no painel de teste da Lia.
- Playwright: aviso de desassociação aparece na conversa do Paulo, sem aplicar a troca.
- Checagem de tipos, checagem de código, testes e compilação, com os resultados reais.

## Detalhes técnicos
- **Diagnóstico:** ler `whatsapp_messages`, `sdr_enrollments` e os registros de execução e de chamadas de ferramenta da Lia para os 11 casos.
- **Caso 1:** em `conversation-guards.ts`, reconhecer "sou um(a) do(a)s" e "um dos responsáveis" como responsável confirmado.
- **Casos 2–6:** conferir no ingest a nova chamada de `suggestCompanyLeft` e ampliar os padrões de `third-party.ts`: "não trabalho na X" (sem "mais"), "não conheço essa empresa", "nunca trabalhei". Gerar as sugestões que faltam com idempotência pela chave única `(message_id, kind)`.
- **Caso 7:** verificar se a ferramenta de agenda estava disponível na versão publicada e se a intenção de agendar foi bloqueada por alguma proteção.
- **Casos 8–9:** em `policy.ts`, "número particular" passa a ser um sinal próprio com desculpa obrigatória. Uma pergunta de alguém fora do público-alvo recebe a resposta fixa "não, obrigado" e a despedida.
- **Caso 10:** conferir a detecção de opt-out e se a confirmação é enviada antes de encerrar. A gravação do opt-out para o Ricardo Oliveira é uma escrita pontual.
- **Caso 11:** auditar o agendador de retomadas: jobs criados, leases, horário silencioso e a regra de parar após contato. Corrigir a causa encontrada.
- **Banco:** só se faltar alguma coluna, com migração aditiva aplicada no aceite do rascunho.
