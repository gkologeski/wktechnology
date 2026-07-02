# Mapa de Permissões Multi-Módulo — TechERP

> Correção: o ERP se chama **TechERP**. TechHire é o módulo de ATS. TechSales é o módulo de CRM. Este plano trata do sistema de acessos do TechERP.

## Modelo escolhido (padrão de mercado)

Combinação vencedora Salesforce + Odoo + Dynamics 365:
**RBAC hierárquico + Permission Sets aditivos + Scope ABAC + Field-Level Security**.

### 4 camadas

```text
1. MODULES      TechSales(CRM) │ TechHire(ATS) │ Contratos │ Financeiro │ Projetos
2. RESOURCES    leads, deals, jobs, candidates, contracts, invoices...
3. PERMISSIONS  <module>.<resource>.<action>.<scope>
                ex: techhire.jobs.update.team
4. ROLES        Job Role (cargo) = N Permission Sets  +  Field-Level rules
```

### Conceitos

- **Module** — TechSales, TechHire, Contratos, Financeiro, Projetos
- **Resource** — entidade (`techhire.jobs`, `techsales.deals`)
- **Action** — `view | create | update | delete | export | approve | assign`
- **Scope (ABAC)** — `own | team | workspace | org`
- **Permission** — `<module>.<resource>.<action>.<scope>`
- **Permission Set** — pacote reutilizável (ex: "TechHire Recruiter Base")
- **Job Role** — cargo que agrega Permission Sets (ex: "Recrutador Sênior")
- **Field Rule** — mask/hide/readonly de campo específico por role (ex: esconder `candidate.expected_salary` de não-Managers)
- **User Assignment** — 1 Job Role principal + N Sets extras (aditivo)

### Roles padrão por módulo

Viewer · User · Manager · Admin (padrão Odoo/Dynamics)

Cross-module: Workspace Owner · Workspace Admin · Auditor · External Collaborator

## Fases de implementação (executar direto, sem parar)

### Fase 1 — Catálogo + UI de leitura
- Migration: tabelas `permissions`, `permission_sets`, `permission_set_items`, `job_roles`, `job_role_sets`, `user_job_roles`, `user_permission_sets`, `field_permission_rules`
- Seed: catálogo canônico de permissions para TechSales + TechHire (todas ações atuais)
- Seed: Permission Sets padrão Viewer/User/Manager/Admin por módulo
- Seed: Job Roles templates (Vendedor, Gerente Comercial, Recrutador, Head de RH, Financeiro, Diretor, Auditor, Workspace Owner/Admin)
- UI `/home/settings/access` (só leitura): tabs Papéis · Permission Sets · Matriz · Membros

### Fase 2 — CRUD + atribuição
- CRUD de Job Roles e Permission Sets (workspace-level)
- Tela Membros: atribuir Job Role principal + Sets extras + escopo padrão
- Field Rules editor: por role, marcar campos como `hidden | masked | readonly`
- Simulador "Ver como…" (impersonate read-only)

### Fase 3 — Enforcement backend
- Função SQL `public.user_has_permission(_user, _perm, _owner, _team) → boolean` (SECURITY DEFINER, stable)
- Função SQL `public.user_field_visibility(_user, _resource, _field) → text` (`full|masked|hidden`)
- Helper server-fn `requirePermission(context, perm, row)` e `maskFields(row, rules)`
- Manter `has_role()` como shim durante migração

### Fase 4 — Migração módulo TechSales (CRM)
- Refatorar RLS de leads/deals/contacts/companies/tickets para `user_has_permission`
- Aplicar field masking em campos sensíveis (ex: `deal.value` para Viewer)

### Fase 5 — Migração módulo TechHire (ATS)
- Refatorar RLS de jobs/candidates/interviews/offers
- Field masking: `candidate.expected_salary`, `offer.amount`, `candidate.email/phone` para roles restritas

### Fase 6 — Auditoria
- Audit log de mudanças em roles/sets/atribuições
- Página de auditoria de acessos por usuário
- Matriz exportável (CSV)

## Detalhes técnicos

### Schema resumido

```sql
-- Catálogo canônico
permissions (key PK, module, resource, action, scope, label_pt, description, is_system)
permission_sets (id, workspace_id NULL=system, module, name, description, is_system)
permission_set_items (set_id, permission_key)

-- Cargos
job_roles (id, workspace_id NULL=system, name, description, is_system)
job_role_sets (role_id, set_id)

-- Atribuições
user_job_roles (user_id, workspace_id, role_id, is_primary)
user_permission_sets (user_id, workspace_id, set_id)

-- Field-level
field_permission_rules (id, role_id NULL, set_id NULL, resource, field, mode)
  -- mode: 'hidden' | 'masked' | 'readonly'

-- Cache (opcional)
user_permission_cache (user_id, workspace_id, permissions text[], updated_at)
```

Todas com GRANT ao `authenticated`+`service_role`, RLS habilitado, políticas escopadas por `workspace_id` + `has_role('admin')` para escrita.

### Convenção de keys

- `techsales.leads.view.own`
- `techsales.deals.update.team`
- `techhire.jobs.delete.workspace`
- `techhire.candidates.export.workspace`
- `finance.invoices.approve.team` (futuro)
- `system.members.manage.workspace`
- `system.billing.manage.workspace`

### Field masking no frontend

- Hook `useFieldVisibility(resource)` → `{ isHidden, isMasked, isReadonly }`
- Componente `<MaskedValue value={...} field="candidate.expected_salary" />`
- Backend sempre é fonte da verdade: server fns aplicam `maskFields()` antes de retornar

### Migração de dados atuais

- Script mapeia `user_roles` (admin/manager/user) → Job Roles equivalentes por workspace
- Mantém `has_role()` funcionando (não quebra RLS existente)
- Migração módulo-a-módulo, com feature flag `use_new_permissions_v2` por módulo

## Nomenclatura confirmada
Vendedor · Gerente Comercial · Recrutador · Head de RH · Financeiro · Diretor · Auditor · Workspace Owner · Workspace Admin · External Collaborator

## Field-Level MVP (Fase 2+)

Campos sensíveis já mapeados:
- **TechHire**: `candidates.expected_salary`, `candidates.email`, `candidates.phone`, `offers.amount`, `offers.equity`, `interviews.private_notes`
- **TechSales**: `deals.value`, `deals.probability`, `contacts.email`, `contacts.phone`, `leads.score`
- **Sistema**: `profiles.email`, `workspace_members.role`

Modo `masked` renderiza `••••` ou `R$ ***`; `hidden` remove do payload; `readonly` desabilita edição.

## Como validar (ao final)
- `/home/settings/access` mostra Papéis, Sets, Matriz e Membros
- Criar role customizado, atribuir a um usuário teste, usar "Ver como…" para conferir efeito
- Verificar que campos sensíveis aparecem mascarados para role Viewer no TechHire/TechSales
- Auditoria mostra histórico de atribuições
