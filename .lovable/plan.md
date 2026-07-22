## Contexto

Os cargos de sistema (`job_roles.is_system = true`) hoje só têm bundles configurados para `system`, `techsales` e `techhire`. Nenhum cargo tem permissões seed para **TechPeople, TechContracts, TechService, TechFinance e TechProjects** — por isso, ao abrir `/settings/permissions` e filtrar por esses módulos, tudo aparece desmarcado.

Como cargos de sistema são read-only na UI (trigger bloqueia edição), o seed precisa vir por migration.

## Proposta de defaults por cargo × módulo

Escopo: `view/create.own` = próprio, `.workspace` = todo o workspace.

| Cargo | techcontracts | techservice | techfinance | techprojects | techpeople |
|---|---|---|---|---|---|
| **Workspace Owner** | full (todas ações .workspace) | full | full | full | full |
| **Workspace Admin** | full | full | full | full | full |
| **Diretor** | view/create/update/approve .workspace | view/manage .workspace | view/approve/manage .workspace | view/update/manage .workspace | view/update/approve .workspace |
| **Auditor** | view.workspace + export | view.workspace | view.workspace + export | view.workspace + export | view.workspace + export |
| **Financeiro** | view.workspace | view.workspace | full (todas) | view.workspace | view.workspace (people + timesheet approve) |
| **Gerente Comercial** | view/create/update/approve .workspace | view/create/update/manage .workspace | view.workspace | view/update .workspace | view.workspace (people, timesheet, allocations) |
| **Vendedor** | contracts.view.own + create.own + clauses.view | tickets.view.own + create.own | — | projects.view.own + tasks.view.own/create.own | — |
| **Head de RH** | view.workspace | — | view.workspace | view.workspace | full (todas ações .workspace) |
| **Recrutador** | — | — | — | — | view.workspace (people, onboarding, documents) |
| **External Collaborator** | contracts.view.own | tickets.view.own/create.own | — | tasks.view.own/update.own + time_entries.create.own/view.own | — |

## Implementação

**Uma migration idempotente** que:

1. Para cada `job_role` do sistema, garante existência do bundle (`permission_sets` com `module='__bundle__'`, `owner_id = job_roles.owner_id`, ligado via `job_role_sets`).
2. `INSERT ... ON CONFLICT DO NOTHING` em `permission_set_items` com todas as chaves da tabela acima, resolvidas a partir de `public.permissions.key`.
3. Não toca chaves já existentes (`techsales`, `techhire`, `system`) — só adiciona os 5 módulos faltantes.
4. Não cria/altera cargos, apenas popula bundles existentes.

Depois de aplicar, `/settings/permissions` filtrado por cada módulo mostra os cargos com marcações corretas.

## Fora do escopo

- Cargos customizados (usuário duplica/cria pela UI se quiser variantes).
- Alterar UI da matriz.
- Alterar RLS/tabelas.

## Validação

- Reabrir `/settings/permissions`, alternar filtro por módulo e conferir que cada cargo de sistema tem as marcações da tabela acima.
- `SELECT` de contagem por `role × module` deve mostrar linhas para os 5 novos módulos.
