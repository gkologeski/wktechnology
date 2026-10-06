# Intervalo aleatório entre envios do SDR

## O que muda para o usuário
Em Agente SDR › Configuração, dois campos novos: "Intervalo mínimo (s)" e "Intervalo máximo (s)". A cada envio, o sistema sorteia um tempo entre X e Y. Dois envios do SDR nunca saem com intervalo menor que esse tempo, mesmo para clientes diferentes do workspace.
- Vale para o envio automático e para rascunhos aprovados por humano. Aprovar coloca a mensagem na fila, e a supervisão mostra "Agendado para hh:mm:ss".
- Enquanto está na fila, a mensagem pode ser cancelada ("Cancelar envio"). Se um humano assumir a conversa, ou o cliente recusar ou responder de novo, ela é descartada antes de sair.
- Validação: 0 ≤ X ≤ Y ≤ 3600. Padrão sugerido: 20–90 s. Com X = Y = 0 o espaçamento fica desligado e o comportamento é o atual.
- O intervalo sorteado é o **mínimo garantido**. Como a fila é processada em ciclos, o tempo real pode passar do sorteado em até cerca de 1 minuto. A tela informa isso.

## Como funciona

```text
aprovar / envio automático
   -> reserva atômica do próximo horário do workspace
      (último horário reservado + sorteio entre X e Y)
   -> trabalho fica "agendado" com send_after
despachante (acordado ao agendar, desligado quando a fila esvazia)
   -> pega envios vencidos, um por vez por workspace
   -> rechecagem: dono da conversa, versão, recusa, janela de 24h, limite diário
   -> envia; só marca "enviado" após confirmação da Meta
```

## Etapas
1. **Banco (aditivo):**
   - `sdr_workspace_settings` ganha `send_interval_min_s` e `send_interval_max_s` (padrão 0, com checagem min ≤ max ≤ 3600) e `next_send_slot_at`.
   - `sdr_turn_jobs` ganha `send_after` e `scheduled_text`, e passa a aceitar o status `scheduled`.
   - Nova função `sdr_reserve_send_slot(workspace)`: trava a linha do workspace, sorteia no servidor e devolve o horário reservado.
2. **Servidor:**
   - `approveSdrDraft` e o envio automático do worker passam a agendar em vez de enviar na hora quando o intervalo está ligado.
   - Novo despachante `dispatchScheduledSends` reaproveita `sendSdrMessage` com todas as rechecagens atuais (o rascunho aprovado fica congelado em `scheduled_text`).
   - `cancelScheduledSend` exige permissão de supervisão.
   - Takeover, recusa e nova mensagem do cliente descartam os envios agendados daquela conversa.
3. **Despacho:**
   - Rota `/api/public/hooks/sdr-send-tick`, protegida pelo mesmo segredo do cron.
   - Ela processa os envios vencidos e espera dentro da própria execução os que vencem nos próximos ~20 s.
   - Agendar um envio liga uma rotina por minuto; ela se desliga sozinha quando não há mais nada na fila. Sem envios agendados, nada roda e não há custo.
   - Enquanto houver fila, a rotina roda no máximo 1.440 vezes por dia.
   - Até a publicação, essa rotina fica no mesmo estado suspenso do `sdr-tick`.
4. **Tela:**
   - Campos X/Y com validação e explicação na Configuração.
   - Na Supervisão: estado "Agendado para…", contagem regressiva e botão "Cancelar envio" com confirmação.
   - Nos Resultados: métrica "Envios agendados".
5. **Testes:**
   - O sorteio respeita os limites.
   - Duas reservas simultâneas não ficam a menos de X uma da outra.
   - Aprovar agenda e não chama a Meta.
   - O despachante envia só o que venceu.
   - Takeover, recusa ou nova mensagem durante a espera descartam sem enviar.
   - Falha da Meta no despacho não confirma o envio.
   - X = Y = 0 mantém o envio imediato.
   - Também: typecheck, lint, build e conferência no navegador.

## Fora do escopo
- Não liga o SDR nem campanhas.
- Não publica.
- Não altera intervalos de campanhas de template já existentes.

## Detalhes técnicos
- O sorteio usa `random()` no Postgres dentro de `sdr_reserve_send_slot`, com `SELECT ... FOR UPDATE` na linha de configurações. O slot é `greatest(now(), next_send_slot_at) + interval sorteado`, e isso garante o espaçamento entre workers concorrentes.
- O despachante usa lease em `sdr_turn_jobs` (`status='scheduled'` → `running`) e chama `sdr_guard` antes de enviar, para que um trabalho obsoleto nunca envie.
- A rotina de acordar é criada por `pg_net`/`pg_cron` no agendamento e removida quando a fila fica vazia (sem varredura permanente). Ela entra no `reschedule_lovable_cron`, que preserva o estado ativo/suspenso.
- A regra nova vai para `AGENTS.md`: todo envio do SDR passa pela reserva de horário do workspace.
