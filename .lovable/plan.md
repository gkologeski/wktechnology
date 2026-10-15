# Tempo de aguardo do cliente e Lia mais autônoma

## O que muda para você
1. **Novo campo "Tempo de aguardo do cliente (segundos)"** em `/agents/sdr`, na configuração de cada agente (aba Habilidades/Atendimento). Padrão: 20 s. Faixa permitida: 0 a 300 s (0 = responde na hora).
2. **Como funciona:** quando o cliente manda uma mensagem, a Lia espera esse tempo. Se chegar outra mensagem nesse intervalo, o relógio recomeça a contar a partir da última. Quando o cliente ficar quieto pelo tempo definido, a Lia lê **todas** as mensagens juntas e manda **uma única resposta**.
3. **Menos aprovação humana:** hoje qualquer aviso interno (por exemplo "resposta parecida com a anterior") faz a mensagem ficar parada em Supervisão. Passa a ser assim:
   - Avisos leves (repetição, texto longo demais, link removido, horário não confirmado): a Lia **reescreve sozinha** a resposta uma vez, corrigindo o problema, e envia.
   - Só fica para aprovação o que é realmente sensível: pedido explícito de humano, reclamação, negociação de preço/contrato, ou se a reescrita ainda falhar. Nesses casos a conversa também aparece como transferência ao responsável, não só como rascunho escondido.
   - O modo Supervisionado continua existindo para quem escolher; a Lia (modo automático) não é alterada além disso.

## O que não muda
- Regras de janela de 24h do WhatsApp, opt-out, cotas e horário de atendimento.
- Confirmação de reunião só com evento real na agenda.
- Rascunho pendente da Aline: não mexo sem sua ordem.
- Nada publicado sem seu aceite.

## Validação
- Testes automáticos: 3 mensagens em 10 s com aguardo de 20 s geram uma resposta só com as três; mensagem após o aguardo gera nova resposta; aguardo 0 responde na hora; aviso de repetição gera reescrita e envio; pedido de humano continua indo para aprovação/transferência.
- Teste no painel de teste do agente (simulado), Playwright no campo novo, typecheck, lint e build com resultados reais.

## Detalhes técnicos
- Migration aditiva: `sdr_turn_jobs.run_after timestamptz` (default now()) + índice `(status, run_after)`. Sem alterar RLS.
- Campo `customer_wait_seconds` (int 0–300) no `agentConfig` do agente (versão/rascunho), lido pelo worker; sem valor = 20.
- `ingest.server.ts`: ao enfileirar reply, se já houver job `queued` da conversa, atualizar seu `run_after = now() + wait` (reinicia o relógio) em vez de criar outro; senão criar com esse `run_after`.
- Claim do worker passa a filtrar `run_after <= now()`; o bloco de agrupamento existente (linhas ~281–300) continua como proteção para jobs concorrentes. O contexto já inclui todas as inbound após a última outbound.
- Cron a cada 2 min não basta para 20 s: o worker do tick processa em laço até ~50 s reaproveitando a chamada, e o webhook de entrada agenda um processamento atrasado quando o runtime permitir (`waitUntil`); limite documentado se não for possível.
- `worker.server.ts` (~686): separar `warnings` em leves/críticos; leves disparam uma nova geração com instrução corretiva; `autoAllowed` só cai para `drafted` com críticos ou após falha da reescrita; críticos também chamam a ferramenta de handoff existente.
