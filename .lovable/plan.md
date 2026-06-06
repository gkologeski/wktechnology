# Plano de releases

## Release 8 — Concluída

| # | Item | Status |
|---|---|---|
| 1 | SLA por prioridade/fila (tickets) | ✅ |
| 2 | Inbox unificada (e-mail + WhatsApp) | ✅ |
| 3 | Mobile polish | ✅ |
| 4 | Marketplace de integrações | ✅ |

## Release 9 — Concluída

| # | Item | Status |
|---|---|---|
| 1 | Notificações in-app de SLA em risco/violado | ✅ |
| 2 | Respostas inline na Inbox unificada | ✅ |
| 3 | Relatórios avançados de SLA | ✅ |
| 4 | Base de conhecimento pública (KB) | ✅ |
| 5 | Chat ao vivo (widget embedável) | ✅ |
| 6 | Portal do cliente | ✅ (já existia) |

### Resumo técnico
- **Notificações**: tabela `notifications` com Realtime, sininho global no header (`NotificationsBell`) com toast em tempo real, server fns `listMyNotifications`/`mark...`. O cron `sla-tick` agora cria notificações para o agente atribuído em três situações: SLA de 1ª resposta violado, SLA de resolução violado e "em risco" (faltam ≤30 min, dedupado por 30 min).
- **Inbox inline reply**: `/inbox` ganhou painel lateral com textarea de resposta que envia via `sendGmailEmail` (e-mail) ou `sendWhatsAppMessage` (WhatsApp) reutilizando as server fns existentes; resolve destinatário pelo último inbound do thread.
- **Relatórios SLA**: nova aba SLA em `/analytics` com `getSlaSummary` (cumprimento %, tempo médio 1ª resposta/resolução) e `getSlaOffenders` (top agentes e filas com mais violações).
- **Base de conhecimento**: tabelas `kb_categories`/`kb_articles` (RLS: workspace gerencia, anônimo lê apenas publicados), CRUD em `/settings/kb`, rotas públicas `/kb` (lista + busca) e `/kb/$slug` (artigo) com incremento de views.
- **Chat ao vivo**: tabelas `live_chat_sessions`/`live_chat_messages`, rotas públicas `/api/public/widget/session` (cria sessão), `/api/public/widget/messages` (poll/enviar), `/api/public/widget/script` (serve `widget.js`), página pública `/widget/$workspaceId` que roda dentro de iframe. `/settings/widget` mostra snippet para colar no site. Operadores atendem em `/inbox/chat` com Realtime.
- **Portal do cliente**: já implementado em release anterior (`/settings/portal` + `/portal/$token`).

## Release 10 — Concluída

| # | Item | Status |
|---|---|---|
| 1 | Sugestão de artigos da KB no ticket | ✅ |
| 2 | AI assist (rascunho) na Inbox unificada | ✅ |
| 3 | Converter sessão de chat ao vivo em ticket | ✅ |

### Resumo técnico
- **KB no ticket**: nova server fn `suggestKbArticles` (workspace-scoped, ranqueia por overlap de tokens em title/excerpt/body de artigos publicados). Componente `KbSuggestions` renderiza top 5 em `/tickets/$id` com botões "copiar link" e "abrir artigo".
- **AI na Inbox**: botão **IA** ao lado de Enviar em `/inbox` chama `smartCompose` (modo `reply`, canal e-mail/WhatsApp) e injeta o rascunho gerado na textarea.
- **Chat → Ticket**: server fn `convertChatSessionToTicket` cria ticket com transcrição completa (origem, e-mail, mensagens com timestamp), atribui ao operador atual e fecha a sessão. Botão "Virar ticket" em `/inbox/chat` redireciona para o ticket criado.

## Release 11 — Candidatas
- Web Push real (VAPID + service worker) para alertas de SLA e chat
- Anexos no chat ao vivo (upload via storage)
- Classificação automática de tickets (prioridade/fila/sentimento) por IA na criação
- Resumo automático de threads longas de e-mail/WhatsApp

