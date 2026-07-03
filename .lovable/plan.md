# Hierarquia completa de edição: admin, líder de time, dono

## Objetivo
Admin/owner edita tudo no workspace. **Líder de time** (Head de RH, Head de Vendas etc.) edita registros dos membros do seu time. Dono edita o próprio. Regra aplicada de forma uniforme em todas as tabelas de negócio.

## Modelo (usa o que já existe)
- Admin/owner: `workspaces.created_by = auth.uid()` **ou** `workspace_members.role IN ('owner','admin')`.
- Líder / membro de time: `user_groups` + `user_group_members`. Dois usuários no mesmo grupo = mesmo time. (Sem flag de "líder" no schema — todos os membros de um grupo têm o mesmo poder sobre o time. Head de RH e recrutador ficam no grupo "RH"; Head de Vendas e vendedor no grupo "Vendas".)
- Escopo do cargo: `job_roles.data_scope` (`workspace | team | custom | own`) — já usado em `user_data_scope`. O líder recebe cargo com `data_scope = 'team'` e o subordinado `own`. Sem cargo → cai em `own`.

## Novos helpers SQL (SECURITY DEFINER, search_path=public)
1. `public.is_workspace_admin_of(_owner uuid, _user uuid) returns boolean` — true se `_user` for created_by ou owner/admin do workspace ao qual `_owner` pertence.
2. `public.shares_team_with(_owner uuid, _user uuid) returns boolean` — true se ambos pertencem ao mesmo `user_group`.
3. `public.can_write_owner(_owner uuid, _user uuid) returns boolean` — retorna true se:
   - `_owner = _user`, **ou**
   - `is_workspace_admin_of(_owner, _user)`, **ou**
   - `shares_team_with(_owner, _user)` **e** `_user` tem cargo com `data_scope IN ('workspace','team','custom')` no workspace do `_owner`.

Assim: recrutador (own) que compartilha grupo com Head de RH (team) **não** ganha poder sobre o Head — só o Head ganha sobre o recrutador. Simétrico com `user_data_scope`.

## Aplicação nas policies (todas as tabelas de negócio)
Para cada tabela abaixo, substituir a policy `ALL … USING (owner_id = auth.uid())` por três PERMISSIVE:
- `*_owner_write` — `owner_id = auth.uid()` (INSERT/UPDATE/DELETE)
- `*_admin_write` — `is_workspace_admin_of(owner_id, auth.uid())` (UPDATE/DELETE)
- `*_team_write`  — `can_write_owner(owner_id, auth.uid())` (UPDATE/DELETE)

INSERT continua exigindo `owner_id = auth.uid()` (evita atribuir registros a terceiros por engano) — admin/líder que precise transferir dono usa a UI de "Proprietário", que roda com contexto do próprio usuário e depois transfere via UPDATE (já coberto).

SELECT: onde a policy atual usa `shares_workspace_with`, mantém. Onde ainda é `owner_id = auth.uid()`, adicionar `*_admin_select` e `*_team_select` equivalentes para líderes enxergarem.

### Tabelas incluídas (todas de negócio)
ATS: `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`, `ats_offers`, `ats_job_postings`, `ats_pipelines`, `ats_scorecards`, `ats_scorecard_responses`, `ats_talent_pools`, `ats_talent_pool_members`, `ats_referrals`, `ats_referral_programs`, `ats_sourcing_sequences`, `ats_sourcing_enrollments`, `ats_stage_emails`, `ats_interview_kits`, `ats_interviewer_pools`, `ats_hunting_templates`.

CRM/Sales: `deals`, `contacts`, `companies`, `leads`, `activities`, `meetings`, `calendar_events`, `email_threads`, `email_messages`, `email_broadcasts`, `email_templates`, `email_snippets`, `sequences`, `sequence_enrollments`, `quotes`, `quote_line_items`, `quote_templates`, `proposals`, `products`, `pipelines`.

Suporte/Ops: `tickets`, `sla_policies`, `macros`, `notifications` (só do próprio), `saved_views`, `dashboards`, `dashboard_widgets`, `custom_reports`, `custom_properties`, `custom_objects`, `custom_object_records`, `forms`, `form_submissions`, `landing_pages`, `workflows`, `workflow_runs`, `outbound_webhooks`, `webhook_deliveries`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_campaigns`, `wa_*`.

Fora: tabelas auth/roles (`user_roles`, `workspace_members`, `job_roles`, `permission_*`, `user_job_roles`, `user_permission_sets`, `user_groups`, `user_group_members`), `platform_*`, `plans`, `subscriptions` (billing tem regra própria), tabelas de log (`audit_logs`, `access_audit_log`, `ip_access_log`, `*_log`), `search_recent`/`search_pinned`, `notifications` fica só do próprio, `push_subscriptions`, `copilot_*`, `credit_*`.

## Correção pontual do bug atual (mesmo lote)
`src/lib/ats/linkedin-job-config.functions.ts` → `updateLinkedinJobConfig`:
- validar acesso à vaga via SELECT autenticado (`.maybeSingle()` com erro claro);
- UPDATE via `supabaseAdmin`, preservando `owner_id` original;
- retorno com `.maybeSingle()`.

Depois das novas policies, o UPDATE pelo cliente autenticado também passaria — mas manter o server function usando admin evita depender da propagação instantânea das RLS e mantém consistência com `publishJobToProvider`.

## Como configurar Head de X
Na tela `/home/access`:
1. Criar grupo (ex.: "RH") e adicionar Head + recrutadores.
2. Criar/associar cargo com `data_scope='team'` ao Head; cargo `data_scope='own'` aos recrutadores.
3. Mesmo padrão para "Vendas", "Suporte" etc. Multiplo grupo = múltiplos times.

## Validação
- Typecheck/build.
- Admin salva config da vaga da Priscila.
- Head de RH edita candidato/entrevista criado pelo recrutador do mesmo grupo.
- Recrutador **não** edita dados do Head nem de outro recrutador de outro grupo.
- Head de Vendas edita deal de vendedor do time; não edita do outro time.
- Dono comum continua editando só o próprio.
- Cross-workspace continua bloqueado.

## Riscos e mitigação
- Policies PERMISSIVE só somam acesso — nada é removido de forma destrutiva. Se um helper falhar, cai no comportamento antigo (`owner_id = auth.uid()`).
- Migration grande; separar em blocos por domínio (ATS, CRM, Ops) dentro da mesma migração para facilitar rollback e revisão.
- `job_roles.data_scope` é a fonte da hierarquia. Grupos sem membro com `data_scope IN ('workspace','team','custom')` continuam sem líder — comportamento intencional.

## Fora de escopo (agora dentro do escopo desta tarefa, exceto)
- Substituir `is_workspace_admin_of` por permissão granular (`crm.write.any`, `ats.write.any`) do RBAC de `permissions` — trocar depois é uma linha por policy; fica para uma segunda onda.
- Flag explícita de "líder do grupo" em `user_group_members` — hoje resolvido via `data_scope` do cargo.
