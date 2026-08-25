# QA — Guia rápido de execução

Esta pasta contém a suíte oficial de casos de teste para o TechSales CRM.

## Arquivos

- `test-cases.md` — suíte completa (595 casos, 23 módulos) navegável por módulo.
- `qa-test-cases.xlsx` (entregue em `/mnt/documents/`) — mesma suíte como planilha para importar em Jira/Zephyr/TestRail/Excel/Sheets. Possui uma aba por módulo, abas `Index`, `Smoke` (regressão rápida ~84 casos) e `Todos`.

## Convenções

- **ID**: `QA-<MOD>-<NNN>` (ex.: `QA-LEAD-012`).
- **Prioridade**: P0 bloqueante · P1 alta · P2 média · P3 baixa.
- **Tipo**: Funcional · UI · UX · Segurança · Permissão · Integração · Performance · Acessibilidade · Compliance · SEO · Resiliência.
- **Smoke**: subset P0/P1 para regressão diária — coluna `Smoke = Sim`.

## Ambientes sugeridos

| Ambiente    | URL                                         | Uso                        |
| ----------- | ------------------------------------------- | -------------------------- |
| Dev/Preview | `https://id-preview--<project>.lovable.app` | testes durante build       |
| Staging     | `project--<id>-dev.lovable.app`             | regressão antes do release |
| Produção    | `https://crm.wktechnology.com.br`           | smoke + monitoria          |

## Dados de teste recomendados

Crie em staging:

- **Workspaces**: `qa-ws-a` (plano Free), `qa-ws-b` (Bronze), `qa-ws-c` (Prata), `qa-ws-d` (Ouro). Mesmo usuário convidado em A e B para testar isolamento RLS.
- **Usuários por role**: `owner@qa`, `admin@qa`, `manager@qa`, `sales@qa`, `support@qa`, `viewer@qa`, `platformadmin@qa` (acesso a `/admin/*`).
- **Massa**: 1.000 leads, 500 contatos, 100 deals distribuídos em 2 pipelines, 50 tarefas, 20 templates de e-mail/WhatsApp.
- **Integrações sandbox**:
  - Twilio test account SID + Auth Token.
  - Stripe test mode (cartão `4242 4242 4242 4242`, PIX simulado).
  - Meta WhatsApp Business número de teste + webhook verify token.
  - Google Calendar com conta dedicada `qa.calendar@`.
  - HubSpot dev portal.
  - SCIM bearer token de teste.
- **Secrets verificáveis**: `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `META_VERIFY_TOKEN`, `TWILIO_AUTH_TOKEN`.

## Fluxo de execução

1. **Smoke diário** (~84 casos, ~1h) — bloqueia deploy se falhar.
2. **Regressão por módulo** a cada release menor.
3. **Regressão completa** antes de release maior ou de qualquer mudança em billing/permissões/integrações.
4. **Pentest leve** (módulo 21) a cada trimestre.
5. Bugs encontrados devem ser reportados em `/my-bug-reports` com print + ID do caso.

## Cobertura por módulo

Consulte a aba `Index` da planilha ou o índice no topo de `test-cases.md`.

## Manutenção

- Ao adicionar nova feature, acrescente casos no módulo correspondente e renumere apenas o módulo afetado.
- Casos obsoletos: marcar como `DEPRECATED` no título e mover para o final do módulo (não reciclar IDs).
- A planilha é gerada por `/tmp/build_qa_cases.py` (script versionável se desejarem trazer para `scripts/`).
