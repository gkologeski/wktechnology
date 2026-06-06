# Plano de releases

## Release 8 — Concluída

| # | Item | Status |
|---|---|---|
| 1 | SLA por prioridade/fila (tickets) | ✅ Concluído |
| 2 | Inbox unificada (e-mail + WhatsApp) | ✅ Concluído |
| 3 | Mobile polish (toolbar/listas responsivas) | ✅ Concluído |
| 4 | Marketplace de integrações (catálogo + busca) | ✅ Concluído |

### Resumo técnico
- **SLA**: nova tabela `sla_policies`, colunas de SLA em `tickets`, trigger `tickets_apply_sla` que recalcula prazos quando muda prioridade/fila, função `find_sla_policy` (mais específica vence), página `/settings/sla` com CRUD de políticas, badge de SLA na lista de tickets, rota `/api/public/hooks/sla-tick` agendada a cada 5min via `reschedule_lovable_cron`.
- **Inbox unificada**: nova rota `/inbox` consolidando `email_threads` + `whatsapp_conversations` com busca, filtro por canal e atalho para o canal nativo.
- **Mobile**: ajustes de responsividade na toolbar de tickets e novas telas seguem padrão flex-wrap.
- **Marketplace**: `/integrations` ganhou busca por texto e filtro por categoria, mantendo o catálogo existente.

## Release 9 — Candidatas
- Notificações push/in-app para SLA em risco
- Macros estendidas (ações encadeadas: trocar status + atribuir + nota)
- Inbox unificada: responder inline (e-mail + WhatsApp) sem sair da página
- Relatórios de SLA (% no prazo, médio de 1ª resposta) na página de Analytics
