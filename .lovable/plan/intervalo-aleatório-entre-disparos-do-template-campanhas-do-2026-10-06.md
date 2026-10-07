# Intervalo aleatório entre disparos do template (campanhas do SDR)

## O que muda para o usuário
- Em Agente SDR › Configuração aparecem dois campos para o workspace: **"Intervalo entre disparos: de X a Y segundos"**.
- Em cada campanha de WhatsApp, a cada destinatário o sistema sorteia um tempo entre X e Y. O próximo template só sai depois desse tempo. A cadência fica irregular, parecida com envio humano, e reduz o risco de bloqueio pela Meta.
- Vale só para o **disparo inicial do template** das campanhas. As respostas do SDR dentro da conversa não mudam.
- A campanha pode usar o padrão do workspace ou valores próprios, no formulário da campanha.
- Validação: 0 ≤ X ≤ Y ≤ 3600 segundos. Padrão sugerido: 30–120 s. Com X = Y = 0 nada muda: vale só o "envios por minuto" atual.
- O limite "envios por minuto" continua valendo junto. Prevalece o que for mais lento.
- Na lista de campanhas: "Próximo disparo em ~N s" e a previsão de término, calculada com a média entre X e Y.
- O sorteio é o **intervalo mínimo garantido**. Como a fila roda em ciclos, um disparo pode atrasar além do sorteado (até cerca de 1 minuto quando Y é curto). A tela avisa isso.

## Como funciona

```text
rotina de campanhas (já existente)
  -> trava a campanha (evita duas execuções simultâneas)
  -> se agora < próximo_disparo: não envia nada
  -> envia 1 destinatário (template aprovado, vínculo SDR como hoje)
  -> sorteia intervalo entre X e Y e grava próximo_disparo
  -> se o próximo vence dentro da janela desta execução: espera e repete
  -> senão encerra; a próxima execução continua de onde parou
```

## Etapas
1. **Banco (aditivo):**
   - `sdr_workspace_settings`: `template_interval_min_s`, `template_interval_max_s` (padrão 0, checagem min ≤ max ≤ 3600).
   - `whatsapp_campaigns`: `send_interval_min_s` e `send_interval_max_s` (nulos = usar o padrão do workspace), `next_send_at` e `dispatch_lease_until`.
   - Função `wa_campaign_claim_dispatch(campanha)`: trava a campanha com lease curto, para duas rotinas nunca dispararem a mesma campanha ao mesmo tempo.
2. **Rotina de campanhas:**
   - Quando há intervalo configurado, envia um destinatário por vez, espera o tempo sorteado e repete enquanto couber num orçamento de ~45 s por execução.
   - Grava `next_send_at` depois de cada envio, para o espaçamento valer também entre execuções.
   - Sem intervalo, o comportamento atual em lotes fica intacto.
   - O sorteio é feito no servidor; uma falha da Meta conta como tentativa e também respeita o intervalo.
3. **Telas:**
   - Configuração do SDR: campos X/Y com validação e explicação.
   - Formulário da campanha: "Usar padrão do workspace" ou X/Y próprios.
   - Lista de campanhas: próximo disparo e previsão de término.
   - Todas as alterações exigem as permissões atuais de campanha ou do SDR no servidor.
4. **Testes:**
   - O sorteio fica sempre entre X e Y.
   - Nenhum envio antes de `next_send_at`.
   - Duas execuções simultâneas da mesma campanha não geram envio em dobro nem quebram o intervalo.
   - X = Y = 0 mantém os lotes atuais.
   - "Envios por minuto" continua respeitado.
   - Falha da Meta não interrompe o espaçamento.
   - O padrão do workspace é aplicado quando a campanha não define valores.
   - Também: typecheck, lint, build e conferência das telas no navegador.

## Fora do escopo
- Não envia mensagens reais nem ativa campanhas ou o SDR.
- Não publica.
- Não muda a frequência da rotina de campanhas, que continua a cada 2 minutos.

## Detalhes técnicos
- Arquivos: `src/routes/api/public/hooks/whatsapp-campaign-tick.ts` (laço com espera dentro do orçamento), `src/lib/whatsapp-campaigns.functions.ts` (validação zod e permissão), `src/lib/prospecting/sdr.functions.ts` (padrão do workspace), `sdr-console.tsx` e o formulário/lista de campanhas.
- O sorteio é uma função pura `randomIntervalSeconds(min, max, rng)` em `src/lib/whatsapp/campaign-pacing.ts`, testável e usada só no servidor.
- O lease da campanha usa `UPDATE ... WHERE dispatch_lease_until < now() RETURNING`. O `next_send_at` é gravado na mesma atualização que marca o destinatário como enviado.
- A espera dentro da execução usa `setTimeout` com teto de ~45 s, e a chamada agendada dessa rotina recebe um tempo limite compatível. Se a execução for interrompida, o `next_send_at` já gravado mantém o espaçamento.
- A regra nova vai para `AGENTS.md`: o ritmo de disparo das campanhas é controlado por `next_send_at`, sob lease por campanha.
