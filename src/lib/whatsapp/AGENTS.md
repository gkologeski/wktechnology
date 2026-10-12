# whatsapp

- Ritmo do disparo de template das campanhas WhatsApp é controlado por `whatsapp_campaigns.next_send_at` sob lease `wa_campaign_claim_dispatch`, com sorteio em `src/lib/whatsapp/campaign-pacing.ts`; por quê: o espaçamento vale entre execuções e nunca há disparo duplo.
