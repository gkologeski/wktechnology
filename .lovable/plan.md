
## Objetivo

Entregar um controle de acesso mínimo viável, funcionalmente equivalente ao HubSpot: cada Cargo (Role) concede um conjunto explícito de permissões — visualizar, criar, editar, excluir, exportar, aprovar, atribuir — por objeto (Contatos, Empresas, Negócios, Leads, Tickets, Vagas, Candidatos, Ofertas, etc.) e por ferramenta transversal (Comunicar, Importar, Exportar, Excluir em massa, Workflows, Pipelines, Propriedades, Integrações, Billing, Usuários).

Escopo confirmado pelo usuário:
1. Consolidar tudo no modelo novo (`permission_sets` + `user_permission_sets`).
2. Bloqueio em server functions + esconder/desabilitar na UI. RLS atual (workspace + owner/admin) permanece como perímetro de segurança.
3. Semear o pacote HubSpot-like completo (9 cargos).

Fora de escopo (fica para depois): reescrever RLS por scope (own/team/workspace), field-level rules, permissões em `custom_objects`, delegação temporária, SCIM auto-role.

## Espelho do modelo HubSpot

HubSpot expõe, por usuário: (a) uma "Preset role" opcional, (b) permissões por objeto CRM com escopos View/Edit/Delete = Everything | Team only | Owned only | None, (c) toggles de tools (Communicate, Bulk delete, Import, Export, Edit property settings, Workflows, etc.), e (d) permissões de conta (Users, Integrations, Billing, Reports). Estamos replicando essa forma: `permissions` (36 chaves `module.resource.action.scope`) → `permission_sets` (Cargo) → `user_permission_sets` (atribuição). Já temos toda essa estrutura no banco; falta popular, atribuir e usar.

## Fase 1 — Seed dos 9 Cargos preset

Migration idempotente que garante, no schema `public`, um `permission_set` `is_system=true` por Cargo, com os `permission_set_items` corretos. Se já existir com o mesmo nome, apenas ressincroniza os itens.

```text
Super Admin      → todas as 36 permissions
Admin            → tudo exceto system.billing.manage e system.roles.manage
Sales Manager    → techsales.* view.workspace / update.team / delete.workspace / export / approve.team
                  + system.members.view + system.audit.view
Sales Rep        → techsales.* view.team / create.own / update.own
                  (sem delete, sem export, sem approve)
Marketing        → techsales.contacts/companies/leads view.workspace + create.own + update.own
                  + system.integrations.manage
Service Rep      → techsales.tickets view.workspace / create.own / update.own
                  + techsales.contacts view.workspace
Recruiter        → techhire.jobs view.own / create.own / update.own
                  + techhire.candidates view.workspace / create.own / update.workspace
                  + techhire.interviews view.workspace / schedule / score
Hiring Manager   → techhire.jobs view.workspace / update.workspace / publish
                  + techhire.candidates view.workspace / assign
                  + techhire.offers view.workspace / create / approve
Read-Only        → todas as *.view.* e nada mais
```

Também popula `access_profiles` correspondentes (mesmo nome, `is_system=true`) para as telas antigas ficarem coerentes até serem removidas na Fase 5.

## Fase 2 — Migração dos usuários existentes

Migration: para cada linha de `team_members` com `access_profile_id` preenchido, insere `user_permission_sets(user_id, owner_id, set_id)` mapeando o profile atual para o preset mais próximo (Admin/Sales Rep/Read-Only conforme `base_role`). Nunca sobrescreve atribuições já existentes. O workspace owner é considerado Super Admin implícito — não recebe linha, o `assertPermission` já retorna `true` para ele.

Também backfill: quem estiver em `workspace_members` mas não em `user_permission_sets` recebe "Read-Only" para evitar downgrade acidental de acesso amplo.

## Fase 3 — Enforcement em server functions

Auditar todas as `src/lib/*.functions.ts` que fazem `insert/update/delete/export/import` sobre os recursos cobertos por `permissions`. Adicionar no topo do `.handler`, depois do `requireSupabaseAuth`:

```ts
await assertPermission(context.supabase, context.userId, workspaceId,
  "techsales.deals.update.workspace");
```

Mapa alvo (arquivos-chave):

```text
contacts.functions.ts          → techsales.contacts.{create,update,delete,export}
companies.functions.ts         → techsales.companies.{view,manage}
deals.functions.ts             → techsales.deals.{create,update,delete,export,approve}
leads.functions.ts             → techsales.leads.{create,update,delete,export}
tickets.functions.ts           → techsales.tickets.{create,update,delete}
ats/jobs.functions.ts          → techhire.jobs.{create,update,delete,publish}
ats/candidates.functions.ts    → techhire.candidates.{create,update,delete,assign,export}
ats/interviews.functions.ts    → techhire.interviews.{schedule,score}
ats/offers.functions.ts        → techhire.offers.{create,approve}
csv-import.functions.ts        → *.create.* (já parcial, revisar)
scheduled-exports.functions.ts → *.export.* (já parcial, revisar)
workflows.functions.ts         → mantém requireTool atual, ajustar chave
custom-fields.functions.ts     → system.settings.manage
pipelines.functions.ts         → system.settings.manage
integrations/*.functions.ts    → system.integrations.manage
billing.functions.ts           → system.billing.manage
team-members.functions.ts      → system.members.manage
```

Para escopos `own`/`team`, usar o RPC existente `user_can_act(user_id, resource, action, row_owner_id, row_assignee_id)` antes de mutations em linha específica. Se o usuário só tem `.own`, um update em registro de outro assignee dispara `PermissionDeniedError`.

Erro padrão: `PermissionDeniedError` (status 403), traduzido no client para toast "Permissão negada: seu Cargo não permite [ação] em [recurso]. Peça ao admin do workspace para revisar."

## Fase 4 — Gate visual na UI

Criar `src/components/access-control/Can.tsx`:

```tsx
<Can perm="techsales.deals.delete.workspace">
  <Button variant="destructive">Excluir</Button>
</Can>

<Can anyOf={["techsales.deals.update.own","techsales.deals.update.workspace"]}>
  <Button>Editar</Button>
</Can>
```

Usa o hook `usePermissions()` que já existe. Enquanto carrega, renderiza `null` (não flasheia botão). Variante `<Can mode="disable">` para desabilitar em vez de esconder — útil em barras de ferramentas.

Aplicar em:
- `contacts.tsx`, `companies.tsx`, `deals.tsx`, `leads.tsx`, `tickets.tsx` (botões Novo, Excluir, Exportar, Importar, ações em massa)
- `ats.jobs.tsx`, `ats.candidates.tsx` (Nova vaga, Publicar, Excluir, Atribuir)
- `settings.*` sensíveis (Billing, Integrations, Members, Custom properties, Workflows, Pipelines)
- Menu lateral: itens que exigem `system.settings.manage` ou `system.billing.manage` ficam ocultos para quem não tem

Nenhuma rota é bloqueada por `beforeLoad` neste MVP (evita loop de redirect) — a rota carrega e mostra `EmptyState` com "Você não tem permissão para ver este recurso" quando `getMyPermissions()` retorna vazio para o módulo.

## Fase 5 — Centro de Acesso `/home/access`

A tela já existe. Ajustes:
- Aba **Cargos**: destaca os 9 presets `is_system` (badge "Padrão"), não permite deletar; permite duplicar como base para cargos custom.
- Aba **Pacotes de Permissão**: passa a ser opcional (avançado). Um Cargo simples = 1 permission_set com itens diretos; o "Pacote" fica como agrupador reutilizável entre cargos custom.
- Aba **Membros**: passa a atribuir Cargo (permission_set) em vez de `access_profile`. Grava em `user_permission_sets` e mantém `team_members.access_profile_id` sincronizado por trigger para compat.
- Aba **Simulação**: já existe, apenas garantir que aponta para o novo RPC.
- Aba **Auditoria**: já existe; nada a mudar.

Rotas legadas `/settings/roles/*` continuam redirecionando para `/home/access`.

## Fase 6 — Documentação e QA

- Atualizar `docs/visibility-matrix.md` com a nova matriz por Cargo.
- Novo `docs/rbac-guide.md` com os 9 presets, o que cada um enxerga/faz, e como criar Cargos custom.
- Checklist manual de QA: logar como cada preset e conferir 3 fluxos-chave (criar, editar linha de outra pessoa, excluir, exportar, acessar Settings).

## Detalhes técnicos

- Todas as migrations são idempotentes (`ON CONFLICT DO UPDATE`) e reversíveis (down script comentado).
- `assertPermission` já resolve workspace pelo `owner_id` do membro; não muda contrato.
- Cache: `usePermissions` invalida em `SIGNED_IN`/atualização de Cargo (adicionar `queryClient.invalidateQueries(["my-permissions"])` no `saveMemberAssignment`).
- Sem novas dependências npm. Sem edição de client.ts/types.ts (types regeneram automático após migration).
- Nenhuma alteração em RLS, auth, storage, edge functions ou schemas protegidos.

## Riscos e mitigação

- **Rebaixamento acidental de acesso** de usuários hoje "livres" via RLS ampla → mitigado por backfill Read-Only + comunicado no changelog + botão "Ver como" (Simulação) antes de aplicar.
- **Regressão em fluxos que hoje passam sem checar permissão** → enforcement é aditivo: se `assertPermission` lançar, o toast identifica exatamente a chave faltante para o admin ajustar o Cargo.
- **Dessincronia entre `access_profiles` e `permission_sets`** durante a transição → trigger unidirecional (permission_set → access_profile) e telas legadas em read-only.

## Entregáveis

- 2 migrations (seed presets + backfill usuários + trigger de sync).
- 1 componente `<Can>` e ajustes no hook `usePermissions` para expor `can(key)`.
- ~20 `assertPermission` distribuídos nas server functions listadas.
- Ajustes em `/home/access` (aba Membros e badges).
- 2 docs.

## Próximo passo

Ao aprovar, começo pela Fase 1 (seed dos presets) e Fase 2 (backfill) em migrations separadas, seguido do `<Can>` e do enforcement — nessa ordem, para nenhum usuário perder acesso a algo que já usava antes das checagens entrarem no ar.
