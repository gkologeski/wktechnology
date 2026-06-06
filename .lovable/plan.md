# Release 7 — Concluída ✅

Última atualização: 2026-06-06

## Resumo

**Release 7: 4 / 4 itens concluídos ✅**

## Status por item

| # | Item | Status | Notas |
|---|---|---|---|
| 1 | useMyTools em mais botões | ✅ Concluído | Botões Importar/Exportar/Excluir em massa gated em `/contacts`, `/companies`, `/leads`, `/tickets` via `useMyTools().can(...)`. |
| 2 | CSAT/NPS de tickets | ✅ Concluído | Página pública `/survey/$token` (já existia) + dashboard em `/settings/surveys` com média/NPS, taxa de resposta e novo card de breakdown por responsável (join tickets → profiles). |
| 3 | Macros em tickets | ✅ Concluído | Componente `TicketMacrosButton` no header do ticket: filtra macros ativas, registra uma activity de nota com o body da macro e copia para o clipboard. |
| 4 | Automation builder visual | ✅ Concluído | Substituídos inputs de UUID por pickers (membros do workspace, regras de rotação, sequências). Adicionado bloco "Fluxo" com cards encadeados (gatilho → condições → ações) dentro do `WorkflowBuilder`. |

## Histórico

- **Release 6 (8/8)** ✅
- **Hardening pós-R6** ✅ — calendar_accounts, email_accounts, workspace_invites
- **Hardening round 2** ✅ — push_subscriptions, esign_signers, esign_audit, survey_responses, contacts.portal_token

## Próximos candidatos (Release 8 — a definir)

- **Marketplace de templates** (workflows, forms, dashboards prontos para importar).
- **Mobile-first polish** das telas críticas (`/contacts`, `/deals`, `/tickets`, `/leads`) em viewport ≤ 414px.
- **Editor de fluxo em canvas** (react-flow) caso queira evoluir o workflow builder além do preview vertical atual.
- **Aplicar macros direto em respostas de email/WhatsApp** (hoje só em activity/nota).
