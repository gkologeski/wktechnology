# Release 8 — Plano

Escopo aprovado: 4 itens. Implementação na ordem abaixo, de menor para maior risco.

## 1. SLA por prioridade/fila (tickets)
- Nova tabela `sla_policies` (workspace_id, name, queue_id nullable, priority, first_response_mins, resolution_mins, business_hours jsonb, active) com RLS por owner_id/workspace.
- Adicionar em `tickets`: `sla_policy_id`, `sla_first_response_due_at`, `sla_resolution_due_at`, `sla_first_response_breached`, `sla_resolution_breached`.
- Trigger ao criar/atualizar prioridade/fila do ticket: aplica policy mais específica (queue+priority > priority > default) e calcula due_at.
- Cron `/api/public/hooks/sla-check` (a cada 5 min) marca breaches e cria atividade `sla_breach`.
- UI:
  - `/settings/sla` — CRUD de políticas.
  - Badge de SLA no card/linha do ticket (verde/âmbar/vermelho) e na página de detalhe.
  - Filtro "SLA em risco/violado" na lista de tickets.

## 2. Inbox unificada (e-mail + WhatsApp)
- Rota `/inbox` consolidando `email_threads` + `whatsapp_conversations` em uma timeline única.
- Colunas: canal, contato, último snippet, atribuído, status, SLA.
- Filtros: canal, atribuído (eu / não atribuído / todos), status (aberto/pendente/resolvido), busca.
- Detalhe lateral: thread completa com responder inline (e-mail via `email_messages` insert + envio; WhatsApp via fluxo existente).
- Ações em massa: atribuir, marcar resolvido, converter em ticket.
- Reutiliza componentes existentes de email/whatsapp; sem mudanças de schema (apenas views/queries no client + server fn `getInboxItems`).

## 3. Mobile polish
Foco nas rotas mais usadas em campo:
- `/inbox`, `/tickets`, `/tickets/$id`, `/contacts`, `/contacts/$id`, `/deals`.
- Header colapsável; tabelas viram cards em <768px; ações primárias em FAB.
- Drawer lateral substitui painéis fixos; gestos de swipe para resolver/arquivar em listas.
- Revisar áreas de toque (mínimo 44px), tipografia e safe-area iOS.
- Sem mudanças de lógica de negócio.

## 4. Marketplace de integrações
- Rota `/integrations` (já existe parcialmente em `/settings/integrations`) reformulada como catálogo.
- Cards por integração (WhatsApp Cloud, Gmail, Outlook, Slack, Meta Ads, HubSpot Sync, Stripe, Twilio, Webhooks, Zapier-like outbound).
- Estado por card: Disponível / Conectado / Em breve. Ação "Conectar" abre fluxo específico (já existente) ou modal de credenciais.
- Categorias (Mensageria, E-mail, Vendas, Pagamentos, Dev) e busca.
- Sem novas integrações de runtime — apenas reorganização + entradas "em breve" para roadmap.

## Detalhes técnicos
- Migrations: 1 para SLA (tabela + colunas em tickets + trigger + grants + RLS).
- Server fns novas: `getInboxItems`, `getSlaPolicies`, `upsertSlaPolicy`, `deleteSlaPolicy`, `runSlaCheck` (chamada pelo cron público).
- Cron: registrar via `supabase--insert` apontando para `project--68dcfa85-...lovable.app/api/public/hooks/sla-check` com header `apikey`.
- Sem dependências novas no package.json.

## Validação
- Build limpo + smoke test manual: criar policy, criar ticket, ver due_at calculado; mandar e-mail e WhatsApp e ver na `/inbox`; abrir `/integrations` no mobile.

Atualizo `.lovable/plan.md` com Release 8 marcada como "Em andamento" antes de começar.
