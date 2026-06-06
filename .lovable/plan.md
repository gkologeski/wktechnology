# Release 6 — Plano de implementação

Com os 5 parciais da Release 5 entregues, a Release 6 mira os **próximos grandes (❌ → ✅)** segundo a prioridade de negócio listada em `docs/hubspot-feature-map.md`. Proponho fatiar em itens incrementais, do menor risco ao maior, todos sob feature flags/roles quando aplicável.

## Cronograma proposto

| # | Item | Esforço | Entrega |
|---|---|---|---|
| 1 | **Tickets — pipeline próprio (UI/back)** | M | Pipelines, stages, SLA hooks já existentes ligados em `/settings/pipelines` por entidade `tickets`. Board e lista reaproveitando `entity-board`/`entity-list`. |
| 2 | **Tickets — automações básicas** | P | Round-robin por fila, auto-assign por canal, mudança de stage por evento. Usa `workflows-tick` e `rotation`. |
| 3 | **Email 1:1 com tracking** | M | Compose dialog já existe (`send-email-dialog`); falta unificar tracking (pixel + click já presentes) na timeline + relatório por contato/lead/deal. |
| 4 | **Forms builder + embed** | M | Editor visual em `/settings/forms` (campos arrastáveis, mapeamento p/ leads), embed JS já existe (`forms/embed-js`). Validação anti-spam + honeypot. |
| 5 | **Quotes + Stripe payment link** | M | `deal-quotes` + `settings.quotes` já existem; falta gerar link Stripe (connector já presente) e marcar quote como paga via webhook. |
| 6 | **Custom reports builder** | M | Página `/reports` com query builder (entidade, filtros, agrupamento, métrica) sobre `filters.ts`; salvar em `saved_reports`. |
| 7 | **Roles & permissões granulares** | M | Já há `settings.roles`; falta matriz de permissão por recurso x ação e enforcement em server fns (helper `assertPermission`). |
| 8 | **Two-way sync HubSpot** | G | Estende `hubspot-tick` para push (create/update) com mapping reverso e resolução de conflitos por updated_at. Fica como último por ser o maior risco. |

> Itens 1–2 abrem o módulo Service. 3–5 fecham o loop comercial. 6–7 são fundação para escalar. 8 é o maior — só depois dos demais.

## Item 1 — Tickets pipeline (entrega desta rodada)

Começo já pelo **Item 1**, porque destrava tudo o resto do módulo Service e é o que mais entrega visualmente.

### Escopo
- Garantir que a entidade `tickets` aparece em `/settings/pipelines` (criar/editar pipelines e stages com cor, ordem, "won/lost equivalents" = resolved/closed).
- Board kanban e lista de tickets já existem (`tickets-board`, `tickets-split-view`). Ligar a seleção de **pipeline ativo** + filtro por stage.
- Stage tracker no detalhe do ticket (`tickets/$id`) usando `stage-tracker.tsx`.
- SLA: usar `settings.sla` já existente, exibindo timer no card do ticket quando há SLA aplicável.

### Mudanças técnicas previstas
- `src/lib/pipelines.functions.ts` — adicionar `entity: 'tickets'` nos validators (se já não suportar).
- `src/components/tickets/tickets-board.tsx` — receber `pipelineId` e filtrar/agrupar colunas por stages do pipeline.
- `src/routes/_authenticated/tickets.tsx` — seletor de pipeline no header.
- `src/routes/_authenticated/tickets.$id.tsx` — `<StageTracker entity="tickets" .../>`.
- Migration: garantir colunas `pipeline_id`, `stage_id` em `tickets` (se ainda não existirem) + índice + RLS.

### Fora deste item (vão para itens 2+)
- Round-robin/auto-assign, macros, automações, satisfação CSAT.

## Próximo passo
Confirma este plano para eu começar pelo **Item 1 — Tickets pipeline** já nesta rodada?
