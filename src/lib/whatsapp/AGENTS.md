# whatsapp

- Ritmo do disparo de template das campanhas WhatsApp é controlado por `whatsapp_campaigns.next_send_at` sob lease `wa_campaign_claim_dispatch`, com sorteio em `src/lib/whatsapp/campaign-pacing.ts`; por quê: o espaçamento vale entre execuções e nunca há disparo duplo.

- Todo compositor de WhatsApp (Inbox, Inbox unificada, ficha/timeline, campanhas) decide janela de 24 h e catálogo por `composer-policy.ts` + `use-whatsapp-composer.ts`, e o servidor revalida janela, modelo aprovado e variáveis completas antes do envio. Por quê: uma única regra evita texto livre fora da janela e distingue erro de catálogo vazio.

- Público das campanhas WhatsApp (fila de prospecção ou filtro próprio) e variáveis do modelo são resolvidos no servidor ao salvar, por lista branca de campos em `campaign-audience.ts`, e gravados em `whatsapp_campaign_recipients.variables`; por quê: o disparo continua igual e nenhum campo fora da lista entra na mensagem.
