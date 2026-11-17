## Detalhes técnicos
- Nova função pura `resolveCampaignChannelAgent` (em `src/lib/whatsapp/`) que, a partir de conta (`service_channel_accounts` por `source_key` = phone_number_id) e vínculo (`service_channel_bindings`: `enabled`, `campaigns`, `agent_id`), devolve `locked | none | free`. Mesma regra que `channel-runtime.server.ts` já usa no disparo.
- Leitura para a tela: reutilizar `listServiceChannels` (já filtrado por workspace/RLS) no formulário `campaigns.whatsapp.tsx`; efeito ao trocar `sender` define `sdrPlaybook` e desabilita o `Select`.
- Servidor: create/update da campanha WhatsApp validam com o cliente do usuário e recusam divergência.
- Permissões: sem chave nova — reutiliza a permissão já exigida para salvar campanhas; registrar classificação no contrato de permissões.
- Testes: unidade da regra (travado, sem agente, livre, canal desativado, campanhas=false) e do bloqueio no salvamento; `permissions:check`; validação Playwright do formulário.
- Ajuda: atualizar o artigo de campanhas WhatsApp (bump de versão) explicando o agente definido pelo número.
- Registrar regra no `src/lib/whatsapp/AGENTS.md`.
