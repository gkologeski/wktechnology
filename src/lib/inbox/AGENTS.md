# Inbox
- Histórico de conversas da Inbox sai de `listConversationMessages` (cursor `(created_at,id)`, página recente primeiro) via `useMessageHistory` + `MessageHistoryViewport`; tempo real sempre filtrado pela conversa e trata recusa vinda na mensagem "system"; por quê: conversas longas sem corte, sem baixar corpos de e-mail e sem canal global.
