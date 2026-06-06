# Release 6 — Status de implementação

Última atualização: 2026-06-06

## Resumo

**Release 6: 8 / 8 itens concluídos ✅**
Itens de segurança pós-release: 3 findings corrigidas, 1 aceita (exports bucket via service-role).

## Status por item

| # | Item | Status | Notas |
|---|---|---|---|
| 1 | Tickets — pipeline próprio (UI/back) | ✅ Concluído | Pipelines por entidade `tickets`, board/list com seletor de pipeline, stage tracker, SLA timer. |
| 2 | Tickets — automações básicas | ✅ Concluído | Round-robin por fila, auto-assign por canal, mudança de stage por evento via `workflows-tick` + `rotation`. |
| 3 | Email 1:1 com tracking | ✅ Concluído | Tracking (pixel + click) unificado na timeline; relatório por contato/lead/deal. |
| 4 | Forms builder + embed | ✅ Concluído | Editor visual em `/settings/forms`, embed JS, honeypot + anti-spam. |
| 5 | Quotes + Stripe payment link | ✅ Concluído | Geração de payment link via connector Stripe, webhook `/api/public/payments/webhook` marca quote como paga. |
| 6 | Custom reports builder | ✅ Concluído | `/reports` com query builder (entidade, filtros, agrupamento, métrica) salvando em `custom_reports`. |
| 7 | Roles & permissões granulares | ✅ Concluído | Engine `permissions.server.ts` (`requireTool`, `getUserScope`, `assertCanAct`); hook `useMyTools` para UI gating; enforcement em workflows, csv-import e scheduled-exports. |
| 8 | Two-way sync HubSpot (completo) | ✅ Concluído | Push de contacts/companies/deals; detecção de mudanças por `updated_at` vs `hs_lastmodifieddate`; resolução de conflitos (local_wins / remote_wins); auto-push opcional no `hubspot-tick`; UI em `/settings/integrations` (HubspotTwoWaySync). |

## Hardening de segurança (pós-Release 6)

| Finding | Status |
|---|---|
| `calendar_accounts` — peers podiam reescrever OAuth tokens | ✅ Corrigido (UPDATE/DELETE restritos a `owner_id = auth.uid()`) |
| `email_accounts` — peers podiam reescrever Gmail OAuth tokens | ✅ Corrigido (UPDATE/DELETE restritos a `owner_id = auth.uid()`) |
| `workspace_invites` — admins podiam ler tokens de outros admins | ✅ Corrigido (SELECT/UPDATE/DELETE escopados a `invited_by = auth.uid()`) |
| `exports` bucket — sem políticas INSERT/DELETE | ✅ Aceito (escrita exclusiva via service-role; sem caminho client-side) |

## Próximos passos sugeridos (Release 7 — a definir)

Candidatos prováveis caso queira continuar evoluindo o produto:
- **Aplicar `useMyTools` em mais botões da UI** (esconder Importar/Exportar conforme perfil) — polimento do Item 7.
- **CSAT/NPS para tickets** — survey já tem tabela `survey_responses` + trigger `create_ticket_survey`; falta UI pública de resposta e relatório.
- **Macros e respostas rápidas em tickets** — tabela `macros` já existe; falta UI de aplicação no detalhe do ticket.
- **Automation builder visual** — hoje workflows são criados via JSON; um editor visual destravaria adoção.
- **Marketplace de templates** (workflows, forms, dashboards) — distribuição de boas práticas.
- **Mobile-first polish** — revisar telas críticas (`/contacts`, `/deals`, `/tickets`, `/leads`) em viewport ≤ 414px.

Confirma se quer publicar a Release 6 ou já abrir a Release 7 com um destes recortes?
