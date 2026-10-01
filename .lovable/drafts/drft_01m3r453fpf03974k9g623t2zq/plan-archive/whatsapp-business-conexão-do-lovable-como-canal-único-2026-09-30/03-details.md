## Fora do escopo
- Criar ou editar modelos de mensagem (fase seguinte).
- Importar conversas antigas do celular.
- Apagar as tabelas antigas do banco.
- Mudanças em telefonia, e-mail ou agenda.

## Depende de você
- Em Conectores › WhatsApp › Mensagens recebidas, escolher este projeto. Sem isso, as respostas não chegam ao TechERP.
- A estrutura nova do banco só passa a valer quando você aceitar este rascunho. Antes disso, dá para testar o envio, mas não o recebimento.
- O painel é tela nova: vou mostrar um mockup para você aprovar antes de construir.

## Detalhes técnicos
- Novo `src/lib/whatsapp/gateway-channel.server.ts`: faz o envio de texto, mídia e template e marca mensagens como lidas pelo endereço `https://connector-gateway.lovable.dev/whatsapp/messages`. Usa `LOVABLE_API_KEY` + `WHATSAPP_API_KEY`, lidos dentro das funções. Sem a chave, devolve o aviso "WhatsApp não conectado".
- `meta-channel.server.ts` é reduzido às funções utilitárias (telefone, janela de 24h, template posicional). `resolveWaNumber` passa a ler a conexão, e `graphFetch` e a leitura de token saem. Os chamadores (`whatsapp.functions.ts`, `whatsapp-send.server.ts`, `whatsapp-campaign-tick.ts`) mantêm a mesma assinatura.
- Remoção do legado:
  - funções de conectar WABA, token e sincronizar números em `whatsapp-meta.functions.ts`;
  - `/api/public/meta/whatsapp-webhook`;
  - componente do guia e prints;
  - formulário de `settings.whatsapp.tsx`.
  - Antes de apagar, busco por `rg` quem ainda usa cada peça, e catálogo, links de anúncio (`wa.$slug`) e templates que dependem de WABA são ajustados para a conexão ou marcados como pendência.
- `channel-availability.functions.ts`: WhatsApp pronto quando `WHATSAPP_API_KEY` está presente e a consulta de `/phone_number` responde.
- Painel: nova server function `getWhatsAppConnectionStatus`, autenticada e só para admins do workspace. Chama `GET /whatsapp/phone_number?fields=display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app` e devolve "não conectado", "conectado" ou "falha", com a mensagem da Meta. Componente `WhatsAppConnectionPanel` com `PageHeader`/`SectionHeader`/`StatusBadge`, estados de carregamento, vazio e erro, modo escuro e celular.
- Migração aditiva preparada no rascunho: `whatsapp_webhook_events` (delivery_id único, event, payload, received_at, processed_at, processing_error, attempts), com GRANT só para `service_role`, RLS ligada e leitura para admins do workspace. Nenhuma tabela é apagada.
- Novo `src/routes/api/public/whatsapp/webhook.ts`:
  - verificação com `verifyWebhookRequest` (`@lovable.dev/webhooks-js`, `maxBodyBytes` de 4 MB);
  - grava o evento antes de processar e responde 5xx se a gravação falhar;
  - `whatsapp.message`: conversa e mensagem de entrada, com deduplicação por id;
  - `whatsapp.status`: reconcilia por `wa_message_id`, sem regredir e preservando `errors[]`; status adiantados ficam pendentes e são retomados em lote limitado.
- Envio grava `wa_message_id` com status `accepted`; falha imediata grava `failed` com o erro.
- Workspace das conversas recebidas: o workspace ativo que usa o WhatsApp. Se houver vários, será preciso definir o workspace da conexão, e isso fica documentado como pendência.
- Validação: `bunx tsgo --noEmit`, `bunx eslint`, `bunx vitest run` (mapeamento de payload e regra de status). Depois, envio real para o seu número e conferência da conversa na tela.
