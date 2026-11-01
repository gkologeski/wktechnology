# Ligação da Lia/Bruna + WhatsApp de apoio + teste no seu celular

Porte: **M** — estimativa **3 a 4 horas** (código + testes + ligação de teste real). Depende de: Vapi ativo (confirmado antes), seu número de celular e um template WhatsApp aprovado para o "não atendeu".

## O que você vai ganhar
1. **Roteiro piloto "Lia — Ligação"** (e uma cópia "Bruna — Ligação") em Roteiros, criado a partir da persona atual do WhatsApp, reescrito para fala: frases curtas, sem emojis/links, abertura de 10 segundos, pedido de permissão para falar, contorno de objeções e fechamento combinando o envio do material/horários pelo WhatsApp.
2. **WhatsApp automático depois da ligação**:
   - Atendeu e aceitou → mensagem com horários/material.
   - Não atendeu, ocupado ou caixa postal → "Tentei te ligar agora…" usando template aprovado (fora da janela de 24 h a regra da Meta exige template; dentro dela, texto livre).
   - Mensagem sai pelo mesmo remetente do agente (Lia ou Bruna), uma vez por lead por campanha, registrada na timeline.
3. **Campanha "teste wolf"** vinculada ao roteiro da Lia, com um lead de teste contendo o seu celular, e um botão **"Ligar para teste agora"** na campanha para você disparar e ouvir.

## Etapas
1. Gerar o roteiro de fala a partir do prompt atual da Lia/Bruna e salvar em Roteiros (revisável antes de usar).
2. Configuração por campanha: agente de WhatsApp de apoio + template "não atendeu" + liga/desliga do envio pós-ligação.
3. Retorno da ligação dispara o WhatsApp conforme o resultado, sem duplicar e respeitando opt-out e a regra das 24 h.
4. Preparar "teste wolf": vincular roteiro, criar lead de teste com seu número (marcado como teste), deixar a campanha pronta (pausada).
5. Você clica "Ligar para teste agora"; eu confiro a tentativa, o resultado e a mensagem de WhatsApp.

## Permissões
- Disparo continua exigindo `techsales.prospecting_voice` (criar) já existente; configurar o WhatsApp de apoio exige a mesma chave + permissão de envio de WhatsApp. Sem conceder a outros cargos. Contrato de permissões com os 5 cenários.

## Detalhes técnicos
- Roteiro: `prospecting_scripts` via `upsertScript`; texto derivado do system prompt do agente SDR.
- Pós-chamada: em `src/routes/api/public/hooks/vapi.ts` (já autenticado), ao `ended`/`end-of-call-report`, chamar novo helper server-only `prospecting-call-followup.server.ts` que usa o envio WhatsApp existente (checagem 24 h + template `APPROVED`, opt-out, `buildOutboundWhatsAppActivity`); idempotência por `attempt_id`.
- Campos novos na campanha (migration aditiva): `followup_agent_id`, `followup_template_name`, `followup_enabled` — com GRANT/RLS preservados.
- Botão de teste usa `dialLeadNow` existente.
- Testes: escolha da mensagem por resultado, idempotência, janela 24 h, negação de permissão.

## Preciso de você
- Seu número de celular para o lead de teste.
- Qual template WhatsApp aprovado usar no "não atendeu" (ou criamos um novo, que depende de aprovação da Meta).
