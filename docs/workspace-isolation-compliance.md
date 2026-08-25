# Conformidade de isolamento por workspace (Fase 4)

Documento de acompanhamento do isolamento multi-cliente (workspace) e do
licenciamento por módulo. Atualize o snapshot ao rodar a consulta novamente.

## 1. Consulta de conformidade

Roda no banco (somente leitura). Lista as tabelas do schema `public` que ainda
não têm `workspace_id` **nem** política de acesso que mencione `workspace_id`,
além de apontar tabelas sem RLS ou sem nenhuma política.

```sql
with tabs as (
  select c.relname as t, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
ws as (
  select table_name from information_schema.columns
  where table_schema = 'public' and column_name = 'workspace_id'
),
pol as (
  select tablename from pg_policies
  where schemaname = 'public'
    and (qual ilike '%workspace_id%' or with_check ilike '%workspace_id%')
  group by tablename
),
anypol as (
  select tablename from pg_policies where schemaname = 'public' group by tablename
)
select t                        as tabela,
       rls                      as rls_habilitada,
       (a.tablename is not null) as tem_policy,
       (w.table_name is not null) as tem_coluna_workspace,
       (p.tablename is not null)  as tem_policy_workspace
from tabs
left join ws     w on w.table_name = t
left join pol    p on p.tablename = t
left join anypol a on a.tablename = t
where rls = false
   or a.tablename is null
   or (w.table_name is null and p.tablename is null)
order by rls, tem_coluna_workspace, t;
```

## 2. Snapshot (18/08/2026 — após padronização final)

| Indicador                                | Valor                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Tabelas em `public`                      | 312                                                                           |
| Sem RLS habilitada                       | 0                                                                             |
| Sem nenhuma política                     | 1 (`payment_webhook_events` — fechada de propósito, gravada só pelo servidor) |
| Pendências reais de isolamento (grupo c) | 0                                                                             |

Órfãos de backfill verificados: `ats_jobs`, `ats_interviews`, `user_files`,
`message_drafts`, `prospecting_questionnaires`, `people` e as 12 tabelas do
último lote → **0** registros sem `workspace_id` e **0** divergências entre
`workspace_id` e `owner_id`.

### Classificação das tabelas sem `workspace_id`

**a) Globais/plataforma — não devem ter `workspace_id`** (catálogo, plataforma,
observabilidade): `modules`, `plans`, `plan_entitlements`, `permissions`,
`permission_set_items`, `job_role_default_permissions`, `job_role_sets`,
`access_profiles`, `access_profile_permissions`, `access_profile_tools`,
`field_permission_rules`, `app_settings`, `marketplace_apps`,
`platform_admins`, `platform_alert_rules`, `platform_alert_events`,
`platform_sandboxes`, `security_scan_runs`, `security_scan_findings`,
`cron_run_logs`, `domain_events`, `audit_logs`, `email_send_log`,
`email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`,
`usage_counters`, `workflow_time_cursors`, `unipile_rate_buckets`,
`unipile_request_log`, `unipile_message_log`, `ml_scoring_models`,
`ml_forecast_scores`, `meet_recording_index`.

**b) Do usuário (escopo pessoal, isolado por `user_id`)**: `profiles`,
`notifications`, `user_roles`, `user_job_roles`, `user_permission_sets`,
`user_grid_preferences`, `search_recent`, `search_pinned`, `team_members`,
`unipile_accounts`, `copilot_sessions`, `copilot_messages`,
`workflow_subscriptions`, `workflow_approvals`, `bug_reports`,
`bug_report_analyses`, `chat_conversations`, `chat_conversation_members`,
`chat_messages`, `chat_message_attachments`, `workspaces`,
`workspace_subscriptions`.

**c) Pendências reais: nenhuma.**

Padronizadas em 18/08/2026 (lote 1): `people`, `people_events`,
`people_psychosocial_assessments`.

Padronizadas em 18/08/2026 (lote 2, encerra o grupo c): `ads_accounts`,
`ads_audiences`, `ads_lead_forms`, `ab_tests`, `ab_test_events`,
`attribution_touchpoints`, `landing_pages`, `landing_page_events`,
`live_chat_sessions`, `live_chat_messages`, `kb_categories`,
`ats_sourcing_step_log`. Todas ganharam `workspace_id` (NOT NULL, FK +
índice), trigger `trg_<tabela>_sync_workspace` (função
`public.sync_workspace_owner_id`, que mantém `workspace_id` e `owner_id`
sincronizados) e políticas no padrão
`workspace_id IN (SELECT current_user_workspaces())` combinado com a exigência
de papel que já existia (membro; administrador do workspace em `ads_accounts`
e nas escritas de `landing_pages`), mais bypass de administrador de plataforma.
O atalho inseguro `owner_id = auth.uid()` foi removido de
`ats_sourcing_step_log`. O grant residual de `anon` foi revogado nas 12 tabelas
(nenhuma tinha política anônima).

**Exceção documentada**: `payment_webhook_events` já possui `workspace_id`,
mantém RLS habilitada **sem políticas** e sem grant para `authenticated` — é
gravada e lida apenas pelo servidor (chave de serviço). Não é uma pendência.

A leitura pública de landing page publicada continua via server function com
cliente administrativo e projeção mínima, sem política anônima.

## 3. Licenciamento por módulo

- `workspace_modules`: 7 linhas, 7 habilitadas no workspace atual.
- Gate aplicado em `src/routes/_authenticated.tsx` (tela "Módulo não
  contratado"), no `ModuleSwitcher` e no menu, via
  `src/lib/modules/licenses.functions.ts` + `src/hooks/use-module-licenses.ts`.
- Ativar/desativar módulo e trocar plano exigem administrador do workspace
  (`src/lib/workspace/admin-guard.server.ts`).

## 4. Teste manual multi-workspace

Hoje existe **1 workspace** e **0 usuários** em mais de um workspace, então o
cenário multi-cliente não pode ser observado com dados reais. Para validar:

1. Criar um segundo workspace (cliente B) e convidar um usuário já membro do
   cliente A.
2. Com esse usuário, alternar o workspace no menu e conferir que listas,
   dashboards e Kanban mudam por completo (leads, vagas, entrevistas, pessoas,
   arquivos, prospecção).
3. Confirmar que um administrador de plataforma continua vendo os dois.
4. Desativar um módulo no cliente B: ele deve sair do switcher e a rota deve
   exibir "Módulo não contratado".
5. Tentar ativar/desativar módulo com usuário não administrador: deve ser
   recusado com mensagem de permissão.

## 5. Como reexecutar

Rode a consulta da seção 1 e atualize a tabela da seção 2. A meta é que o
grupo (c) chegue a zero; os grupos (a) e (b) permanecem por definição.
