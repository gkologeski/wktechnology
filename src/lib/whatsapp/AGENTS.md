# whatsapp

- Ritmo do disparo de template das campanhas WhatsApp é controlado por `whatsapp_campaigns.next_send_at` sob lease `wa_campaign_claim_dispatch`, com sorteio em `src/lib/whatsapp/campaign-pacing.ts`; por quê: o espaçamento vale entre execuções e nunca há disparo duplo.

- Todo compositor de WhatsApp (Inbox, Inbox unificada, ficha/timeline, campanhas) decide janela de 24 h e catálogo por `composer-policy.ts` + `use-whatsapp-composer.ts`, e o servidor revalida janela, modelo aprovado e variáveis completas antes do envio. Por quê: uma única regra evita texto livre fora da janela e distingue erro de catálogo vazio.
