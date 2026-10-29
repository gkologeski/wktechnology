## Detalhes técnicos

- `whatsapp-campaign-tick.ts`: `processCampaign(camp, 1)` no modo espaçado passa a buscar pequenos lotes de pendentes e continuar após `skipped` até 1 envio real (`sent`/`failed`), fila vazia, pausa ou fim de `PACING_RUN_BUDGET_MS`. `runPacedLoop` só aplica `sleep`/`next_send_at` quando houve envio real (retorno com `sent+failed>0`). Teste em `campaign-pacing.test.ts`.
- `updateWhatsAppCampaign` (rascunho/pausada, sem recalcular público): reaplicar `applyRecentGuard` e `applyCommercialGuard` sobre os `pending` e marcar como `skipped` com o mesmo texto de motivo do disparo; `total` não muda (contador já mostra ignorados).
- Permissão: reutiliza `techsales.marketing.campaigns` edit (mesma ação); contrato de permissão atualizado com hash. Testes: pacing (ignorado não espera), guarda no salvar (permitido/negado/outro workspace via fronteira existente).
- Validação: testes WhatsApp, `permissions:check`, lint; Playwright na tela de campanhas.
