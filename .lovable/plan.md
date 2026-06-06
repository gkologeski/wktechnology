# Release 7 — Em andamento

Última atualização: 2026-06-06

## Escopo aprovado

| # | Item | Status | Notas |
|---|---|---|---|
| 1 | useMyTools em mais botões | 🟡 Em andamento | Esconder Importar/Exportar/Excluir em massa nas telas `/contacts`, `/companies`, `/leads`, `/deals`, `/tickets` conforme `access_profile_tools`. |
| 2 | CSAT/NPS de tickets (UI + relatório) | ⬜ A fazer | Página pública `/survey/$token` para resposta (1-5 + comentário), reaproveitar tabela `survey_responses`; dashboard de CSAT/NPS por agente/período. |
| 3 | Macros em tickets | ⬜ A fazer | Botão "Aplicar macro" no detalhe do ticket; execução do template (texto, status, tags) usando tabela `macros`. |
| 4 | Automation builder visual | ⬜ A fazer | Editor de nodes (trigger → condition → action) substituindo JSON cru em `/settings/workflows`. |

## Histórico

- **Release 6 (8/8)** ✅ concluída.
- **Hardening de segurança pós-R6** ✅ — calendar_accounts, email_accounts, workspace_invites.
- **Hardening de segurança (round 2)** ✅ — push_subscriptions, esign_signers, esign_audit, survey_responses, contacts.portal_token.
