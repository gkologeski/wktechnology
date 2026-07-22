# Área unificada de Gestão de Permissões (todos os módulos)

## Objetivo

Consolidar o RBAC em **uma tela unificada** com editor visual Cargo × Recurso × Ação × Escopo, cobrindo **todos os módulos existentes**: TechSales, TechHire, TechPeople, TechContracts, TechService, TechFinance, TechProjects e Sistema. Reutiliza as tabelas atuais (`permissions`, `permission_sets`, `permission_set_items`, `job_roles`, `job_role_sets`, `user_job_roles`, `access_audit_log`) e apenas **expande o catálogo `permissions`** para os módulos que ainda não estão lá.

Hoje o catálogo `permissions` só tem `techsales`, `techhire` e `system`. Falta cadastrar entradas para `techpeople`, `techcontracts`, `techservice`, `techfinance`, `techprojects`.

## Rota

Nova: `/_authenticated/settings/permissions`.
`/home/access` e `/settings/roles*` redirecionam para ela. `/settings/my-permissions` permanece como visão do próprio usuário.

## Migration (única alteração de schema/dados)

Um `INSERT ... ON CONFLICT DO NOTHING` em `public.permissions` com as chaves faltantes. Formato `<module>.<resource>.<action>.<scope>`, escopos `own|team|workspace`, ações padrão por recurso:

| Módulo | Recursos | Ações padrão |
|---|---|---|
| techpeople | people, allocations, timesheet, reviews, one_on_ones, goals, incidents, documents, benefits, onboarding | ver, criar, atualizar, excluir, exportar, aprovar |
| techcontracts | contracts, clauses, approvals, esign | ver, criar, atualizar, excluir, aprovar, publicar |
| techservice | tickets, kb, sla, macros | ver, criar, atualizar, excluir, atribuir, exportar |
| techfinance | entries, payments, invoices, recurrences, legal_entities, cost_centers, banking, dunning, nfse | ver, criar, atualizar, excluir, exportar, importar, aprovar |
| techprojects | projects, tasks, milestones, time_entries, spaces, folders, lists | ver, criar, atualizar, excluir, atribuir, exportar |

Cada linha ganha as três variantes `own | team | workspace` **apenas quando fizer sentido** (ex.: `importar/exportar/publicar/aprovar` só em `workspace`).
Rótulos PT-BR em `label_pt` seguindo o padrão já existente. `docs/rbac-mvp.md` é atualizado com o novo total.

Sem novas policies RLS, sem alterar tabelas — só INSERTs idempotentes no catálogo.

## Modelo de edição

- Cada cargo tem, sob o capô, um `permission_set` "bundle do cargo" (`is_system=false`, nome `__role_bundle:<role_id>`), vinculado via `job_role_sets`. A UI só edita esse bundle; pacotes públicos existentes ficam intactos.
- Marcar/desmarcar célula → `upsert/delete` em `permission_set_items` do bundle.
- Cargos `is_system=true` são somente leitura; botão "Duplicar cargo" cria cópia editável.

## Layout

```text
[Header] Permissões · Configure quem pode ler, criar, atualizar, excluir, aprovar, exportar por escopo

[Filtros] Módulo (Todos | TechSales | TechHire | TechPeople | TechContracts | TechService | TechFinance | TechProjects | Sistema)
          Busca recurso...   [+ Novo cargo] [Duplicar] [Exportar CSV]

[Aba 1: Matriz]  ← padrão
  Recurso ▸ Ação    │ Sales Rep │ Recruiter │ Finance │ PM │ … cargos como colunas
  ─────────────────
  TechSales · Contatos
    Ler        │ [own ▾] │ [—] │ [—] │ [ws ▾] │
    Criar      │ [own ▾] │ [—] │ [—] │ [ws ▾] │
    …
  TechPeople · Pessoas
    Ler        │ [—] │ [ws ▾] │ [—] │ [team ▾] │
    …
  TechFinance · Lançamentos
    …
  Célula = dropdown [—, own, team, workspace]; opção não catalogada fica desabilitada com tooltip.

[Aba 2: Cargos]     Cards de cargos + membros
[Aba 3: Membros]    Filtro + atribuição em massa de cargo
[Aba 4: Campos]     Regras de campo sensíveis (reaproveita FieldsTab)
[Aba 5: Auditoria]  Reaproveita AuditTab
```

## Arquivos

Novos:

- `src/routes/_authenticated/settings.permissions.tsx` — rota + `PageHeader` + tabs
- `src/components/access-control/permissions-matrix.tsx` — matriz editável
- `src/components/access-control/permissions-matrix-cell.tsx` — dropdown de escopo por célula
- `src/lib/access-control/role-bundle.functions.ts`:
  - `ensureRoleBundle(role_id)` — cria/retorna bundle do cargo
  - `setRolePermission({ role_id, permission_key, granted })`
  - `bulkSetRolePermissions(role_id, keys[], mode)` — linha, coluna ou limpar
  - Todas com `assertPermission("system.roles.manage.workspace")` + `logAudit`

Alterados:

- `src/lib/access-control/access.functions.ts` — expor `MODULE_META` extendido (labels PT-BR: TechPeople, TechContracts, TechService, TechFinance, TechProjects)
- `src/routes/_authenticated/home.access.tsx` → redireciona para `/settings/permissions`
- `src/routes/_authenticated/settings.roles.tsx` → redireciona para `/settings/permissions`
- `src/components/settings-menu.tsx` (ou equivalente) — item "Permissões"; oculta duplicados
- `docs/rbac-mvp.md` — atualiza tabela de módulos/recursos

Migration:

- `public.permissions` — INSERTs idempotentes para os 5 módulos faltantes

Preservado sem alteração:

- Todas as tabelas de RBAC, RLS, policies, simulador, regras de campo.

## Guardas

- Toda mutação exige `assertPermission("system.roles.manage.workspace")`.
- Cargos `is_system=true` bloqueiam edição.
- Cada save grava em `access_audit_log`.

## Fora de escopo

- Novas RLS policies consultando `user_has_permission()` nos CRUDs cliente-direto (segue como pendência em `docs/rbac-mvp.md`).
- Escopo `custom` (filtros por pipeline/unidade).
- Enforcement server-side de novas chaves além dos fluxos que já usam `assertPermission`.

## Como validar

1. `/settings/permissions` abre com aba **Matriz** e mostra todos os módulos no filtro.
2. Filtrar por "TechFinance" mostra linhas de lançamentos, pagamentos, faturas, recorrências, CNPJs, centros de custo, banking, dunning, NFS-e.
3. Filtrar por "TechPeople" mostra pessoas, alocações, timesheet, reviews, 1:1s, metas, incidentes, documentos, benefícios, onboarding.
4. Alterar `Sales Rep · Contatos · Ler` de `own → workspace` reflete na aba Cargos e em `/settings/my-permissions` do usuário.
5. Cargo `Admin` (`is_system`) fica cinza; "Duplicar" cria cópia editável.
6. Registro aparece em **Auditoria**.
7. `/home/access` e `/settings/roles` redirecionam para `/settings/permissions`.
