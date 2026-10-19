# whatsapp

- Ritmo do disparo de template das campanhas WhatsApp é controlado por `whatsapp_campaigns.next_send_at` sob lease `wa_campaign_claim_dispatch`, com sorteio em `src/lib/whatsapp/campaign-pacing.ts`; por quê: o espaçamento vale entre execuções e nunca há disparo duplo.

- Todo compositor de WhatsApp (Inbox, Inbox unificada, ficha/timeline, campanhas) decide janela de 24 h e catálogo por `composer-policy.ts` + `use-whatsapp-composer.ts`, e o servidor revalida janela, modelo aprovado e variáveis completas antes do envio. Por quê: uma única regra evita texto livre fora da janela e distingue erro de catálogo vazio.

- Público das campanhas WhatsApp (fila de prospecção ou filtro próprio) e variáveis do modelo são resolvidos no servidor ao salvar, por lista branca de campos em `campaign-audience.ts`, e gravados em `whatsapp_campaign_recipients.variables`; por quê: o disparo continua igual e nenhum campo fora da lista entra na mensagem.

- Cada rodada do disparo espaçado espera no máximo `PACING_RUN_BUDGET_MS` (abaixo do tempo limite da chamada agendada) e relê o status da campanha antes de cada envio; por quê: esperas longas eram cortadas sem liberar o lease e uma pausa precisa valer na hora.

- Número de WhatsApp de Contatos/Leads vive em `whatsapp_e164` (E.164, só celular do Brasil +55 DDD 9XXXXXXXX; formato antigo de 8 dígitos 6–9 ganha o 9; fixo e estrangeiro são recusados), normalizado por gatilho no banco e por `src/lib/phone/whatsapp-e164.ts` no app; todo disparo escolhe WhatsApp → Celular → Telefone e nunca usa fixo; por quê: fixo quase nunca tem WhatsApp e gerava falhas em massa.

- Controle de reenvio recente das campanhas (WhatsApp e e-mail) usa `src/lib/campaigns/recent-contact.ts`: confere ao montar o público e de novo no disparo, só no mesmo canal, com liberação manual gravada em `override_recent`; por quê: não repetir mensagem a quem acabou de receber, sem bloquear exceções conscientes.
- Filtros de público com `suggest` mostram valores já existentes via `listAudienceFieldValues` (só colunas da lista branca, workspace ativo); por quê: o usuário vê as opções reais sem liberar leitura de colunas arbitrárias.
- Campanhas WhatsApp bloqueiam por padrão quem já é cliente (negócio ganho ou contrato ativo) e quem tem negociação aberta, via `src/lib/campaigns/commercial-status*.ts`, ao montar o público e de novo no disparo, com liberação manual em `override_commercial`; por quê: não abordar em massa quem já está em relação comercial.
- Áudios recebidos são transcritos no servidor (`ensureAudioTranscripts`) antes da Lia ler a conversa, gravando a transcrição no corpo da mensagem; por quê: a Lia responde ao conteúdo sem pedir que o cliente escreva.
