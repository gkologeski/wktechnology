# Operações & Runbook — WK Technology CRM

Última atualização: Release 5.

## 1. Visão geral

- **Stack:** TanStack Start (React 19) sobre Cloudflare Workers, Lovable Cloud (Supabase).
- **Domínio principal:** `crm.wktechnology.com.br`.
- **Domínio publicado:** `wktechnology.lovable.app`.
- **Status URL (admin):** `/admin/status` (saúde de crons, integrações, alertas recentes).
- **Configuração de alertas:** `/admin/alerts` (regras de cron atrasado, falhas, DLQ).

## 2. Observabilidade

| Sinal                 | Onde olhar                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Erros 5xx             | Server Logs (Cloud → Logs). Wrapper SSR em `src/server.ts` faz console.error de erros catastróficos. |
| Falhas de cron        | `/admin/status` (job, schedule, last_start, status).                                                 |
| Queue DLQ (e-mail)    | `email_send_log` (rows com `status='dlq'`); `email_send_state` para throughput.                      |
| Webhooks de pagamento | `payment_webhook_events` (signature_valid, processed, payload).                                      |
| Alertas disparados    | `platform_alert_events` (lidos por `/admin/status`).                                                 |

### Regras de alerta sugeridas (criar em `/admin/alerts`)

1. **Cron atrasado** — `rule_type=cron_late`, `threshold_mins=60`, alvo: cada job crítico (`process-email-queue`, `audit-export-tick`, `platform-alerts-tick`).
2. **DLQ crescendo** — `rule_type=dlq_count`, `threshold=10` por hora.
3. **Webhook inválido** — `rule_type=webhook_invalid_sig`, `threshold=5` por hora, alvo: cada gateway.
4. **Erros 5xx** — `rule_type=error_5xx_rate`, `threshold_pct=2`.

Canal padrão: e-mail para `ops@wktechnology.com.br` (configurar em cada regra).

## 3. Backups e Recuperação

### O que é coberto pelo Lovable Cloud

- **Snapshots automáticos diários** do Postgres (retenção conforme plano do Cloud).
- **Point-in-time recovery (PITR)** disponível conforme o tier do projeto.

### RPO / RTO alvos

| Métrica                     | Alvo   | Notas                                                                    |
| --------------------------- | ------ | ------------------------------------------------------------------------ |
| RPO (perda máxima de dados) | ≤ 24 h | Limitado pelo backup diário. PITR reduz para minutos quando habilitado.  |
| RTO (tempo de restauração)  | ≤ 4 h  | Restaurar via Cloud → Database → Backups; reapontar app só se URL mudar. |

### Backups manuais antes de mudanças críticas

Antes de migrations destrutivas, exportar tabelas-chave via Cloud → Database → Tables → Download CSV:
`workspaces`, `workspace_members`, `workspace_subscriptions`, `profiles`, `customer_invoices`, `customer_payments`, `quotes`, `quote_line_items`, `deals`, `contacts`, `companies`, `leads`, `tickets`.

### Procedimento de restauração

1. Cloud → Database → Backups → selecionar snapshot.
2. Restaurar para o mesmo projeto (substitui dados) ou para um novo projeto (recuperação parcial via export/import).
3. Após restore, rodar `/admin/status` e validar contagens-chave (workspaces, faturas, cotações).
4. Reabilitar pg_cron se necessário (`select cron.schedule(...)`).

## 4. E-mail transacional

- Provedor: Lovable Email. Domínio recomendado: subdomínio de `wktechnology.com.br` (ex.: `notify.wktechnology.com.br`) para evitar conflito de DNS com o domínio raiz.
- DNS gerenciado por Lovable após delegação (SPF, DKIM, DMARC, MX) — propagação até 72 h.
- Fila: pgmq `auth_emails` (alta prioridade) e `transactional_emails`, processadas a cada 5 s.
- Templates: `/lovable/email/queue/process` consome ambas as filas.

### Quando emails não chegam

1. Cloud → Emails → ver status do domínio.
2. `select * from email_send_log order by created_at desc limit 50;` — procurar `status='dlq'` ou `last_error`.
3. Conferir se o cron `process-email-queue` está rodando em `/admin/status`.
4. Se cron sumiu, chamar `email_domain--setup_email_infra` (idempotente).

## 5. Domínio próprio (custom domain)

- Já configurado: `crm.wktechnology.com.br` (SSL automático).
- Para mover a outro projeto: Project Settings → Domains → ⋯ → Remove, depois reconectar no destino.

## 6. Help Center

- Rota pública: `/kb` (lista) e `/kb/:slug` (artigo).
- Admin: `/settings/kb` — botão **Popular base inicial (12 artigos)** cria 4 categorias e 12 artigos essenciais (idempotente por slug).

## 7. Cron jobs registrados

Listar: `select jobname, schedule, active from cron.job;`

Críticos:

| Job                    | Schedule                     | Endpoint                                 |
| ---------------------- | ---------------------------- | ---------------------------------------- |
| `process-email-queue`  | `*/5 * * * * *` (a cada 5 s) | `/lovable/email/queue/process`           |
| `platform-alerts-tick` | a cada 5 min                 | `/api/public/hooks/platform-alerts-tick` |
| `audit-export-tick`    | de hora em hora              | `/api/public/hooks/audit-export-tick`    |

Autenticação de webhooks: cron usa `apikey` (anon) ou `CRON_SECRET` (rotas com `requireCronAuth`). Twilio/Stripe/Meta/gateways BR verificam assinatura HMAC.

## 8. Contatos de plantão

- **Suporte plataforma:** suporte@wktechnology.com.br
- **Engenharia (24x7):** definir lista no DPA / contrato.
- **Status público:** publicar incidentes em `/kb` na categoria "Status".

## 9. Integração Unipile (API v2)

A integração LinkedIn/mensageria usa exclusivamente a **API v2** da Unipile. Apenas duas variáveis de ambiente são suportadas:

| Variável               | Obrigatória | Descrição                                                                                                |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `UNIPILE_API_KEY`      | Sim         | Chave de API da Unipile (header `X-API-KEY`).                                                            |
| `UNIPILE_API_BASE_URL` | Não         | Override da base da API. Padrão: `https://api.unipile.com/v2`. Use somente em testes/ambientes isolados. |

Variáveis descontinuadas e **removidas** do ambiente:

- `UNIPILE_DSN` — o DSN por tenant não existe na v2 (base fixa).
- `UNIPILE_API_VERSION` — não há mais seleção de versão; o cliente fala apenas v2.

Se qualquer uma delas for recriada, será ignorada pelo código.
