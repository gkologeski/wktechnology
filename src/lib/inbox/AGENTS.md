# Inbox

- Histórico de conversas da Inbox sai de `listConversationMessages` (cursor `(created_at,id)`, página recente primeiro) via `useMessageHistory` + `MessageHistoryViewport`; tempo real sempre filtrado pela conversa e trata recusa vinda na mensagem "system"; por quê: conversas longas sem corte, sem baixar corpos de e-mail e sem canal global.

# Inbox

- Chat ao vivo: servidor exige `techsales.inbox.chat.<ação>` e a RLS limita sessões/mensagens ao escopo via `my_perm_workspaces`; por quê: sem leitura ou envio em conversas de terceiros.
