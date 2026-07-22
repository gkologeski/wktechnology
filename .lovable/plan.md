## Opção C — RLS + assertPermission nos 5 módulos PSA

Replicar o padrão canônico do TechSales (RLS por `user_has_permission` no banco + `assertPermission` nas server functions) nos módulos hoje sem cobertura de escopo real.

Permissões já semeadas em `public.permissions` (verifiquei — todas presentes). O trabalho é só ligar as chaves ao runtime.

### Escopo por módulo

**TechHire** — `ats_jobs`, `ats_candidates`, `ats_applications`, `ats_interviews`, `ats_offers`, `ats_scorecards`

**TechPeople** — `people`, `people_documents`, `people_goals`, `people_reviews`, `people_incidents`, `people_psychosocial_assessments`, `people_allocations`, `people_one_on_ones`, `people_benefits`, `project_time_entries` (timesheet), `people_onboarding_plans`, `people_onboarding_tasks`

**TechContracts** — `contracts`, `contract_approvals`, `proposal_clauses`, `esign_documents`, `esign_signers`

**TechService** — `services`, `service_catalog`, `sla_policies`, `macros`, `kb_articles` (leitura publicada continua anon; escrita muda), `kb_categories`

**TechProjects** — `project_spaces`, `project_folders`, `project_lists`, `projects`, `project_tasks`, `project_milestones`, `project_time_entries` (compartilha com Timesheet)

### Fase 1 — Migrations RLS (uma por módulo, 5 no total)

Para cada tabela, replicar o shape usado em `techsales.activities` / `techsales.tickets`:

```sql
-- SELECT: workspace scope OU own scope + ownership
CREATE POLICY "<t>_ws_select" ON public.<t> FOR SELECT USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.user_has_permission(auth.uid(), workspace_id, '<mod>.<obj>.view.workspace')
    OR (public.user_has_permission(auth.uid(), workspace_id, '<mod>.<obj>.view.own')
        AND owner_id = auth.uid())
  )
);

-- INSERT: create.own
CREATE POLICY "<t>_ws_insert" ON public.<t> FOR INSERT WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND owner_id = auth.uid()
  AND public.user_has_permission(auth.uid(), workspace_id, '<mod>.<obj>.create.own')
);

-- UPDATE: workspace ou own+ownership
-- DELETE: delete.workspace (por padrão) ou delete.own quando existir a chave
```

Preserva as policies existentes de admin/service_role. Onde a tabela tem `assignee_id` (tickets, tasks, one_on_ones), o predicado `own` também aceita `assignee_id = auth.uid()`, seguindo o padrão de `techsales.tickets`.

Cargos do sistema (10) já têm cobertura via seed anterior — nada quebra, apenas passa a ser enforçado no banco.

### Fase 2 — assertPermission em server functions de escrita

Aplicar em todas as mutations (create/update/delete/approve/export) de:
- `src/lib/ats/*.functions.ts` (jobs, candidates, applications, interviews, offers, scorecards)
- `src/lib/people/*.functions.ts` (people, documents, goals, reviews, incidents, allocations, one_on_ones, benefits, timesheet, onboarding)
- `src/lib/contracts/*.functions.ts` (contracts, approvals, clauses, esign)
- `src/lib/services/*.functions.ts` + `src/lib/tickets/*.functions.ts` + `src/lib/kb/*.functions.ts` + `src/lib/macros/*.functions.ts` + `src/lib/sla/*.functions.ts`
- `src/lib/projects/*.functions.ts` (spaces, folders, lists, projects, tasks, milestones, time_entries)

Padrão fixo (igual a `webhooks.functions.ts`):

```ts
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
// dentro do .handler:
const ws = await getActiveWorkspaceId(supabase, userId);
await assertPermission(supabase, userId, ws, "techpeople.people.create.own");
```

Leituras (list/get) permanecem contando só com RLS — como no TechSales.

### Fase 3 — Verificação

1. `supabase--linter` para detectar policies redundantes/conflitantes.
2. Login manual como cargo "Vendedor" (sem permissões TechPeople) → confirmar 403 ao criar pessoa via UI e 401/permission_denied via chamada direta.
3. Login como "RH" → confirmar create/update/delete em `people` funcionando.
4. `access_audit_log` recebe registros `permission_denied` em cada negação (já implementado em `enforce.server.ts`).

### Detalhes técnicos

- **Sem alteração de schema**: só CREATE POLICY + DROP POLICY das legadas amplas quando redundantes.
- **Sem breaking change de UI**: `usePermissions` já lê as mesmas chaves; cargos default já cobrem tudo.
- **Ordem de execução**: Fase 1 (migration por módulo, com aprovação) → Fase 2 (código) → Fase 3 (verificação).
- **Escopo `.team`**: onde já existir estrutura de time (`user_groups`), incluir predicado `team`; caso contrário só `own` e `workspace` (mesma decisão do TechSales hoje).
- **Não altero**: `platform_admins`, `is_workspace_admin_v2`, service_role — mantém governança.

### Riscos

- Uma tabela sem `owner_id` na coluna esperada falha o predicado `own`; vou auditar cada tabela antes da migration. Timesheet e time_entries já usam `owner_id`; verificarei `assignee_id` para one_on_ones/tasks.
- Se algum cargo customizado do cliente estiver sem uma chave que hoje passa por cobertura ampla, o usuário perde acesso. Mitigação: matriz `/settings/permissions` deixa o admin corrigir na hora, e o log em `access_audit_log` mostra o que foi negado.

Volume estimado: **5 migrations + ~15 arquivos de server functions editados**. Sem breaking change de UI, sem novas dependências.