## Gestão de Workspaces (Platform Admin)

Centralizar criar/editar/excluir workspaces em `/admin/workspaces`, restrito a **Platform Admin**. Admin comum do workspace continua apenas com branding/membros/módulos.

### Escopo

**Criar** — já existe (`createWorkspaceAdmin`). Apenas revisar UX do dialog atual em `/admin/workspaces`.

**Editar** — expor UI usando a função `updateWorkspaceAdmin` já existente. Campos editáveis:
- Nome
- Slug
- Status (`active` / `suspended` / `deleted`)
- Plano
- Domínio custom (se aplicável no schema)

**Excluir (dois níveis)**:
1. **Soft-delete** (padrão) — botão "Excluir". Marca `status = 'deleted'` + `deleted_at = now()`. Workspace some das listagens normais, dados preservados, membros perdem acesso.
2. **Hard-delete / Purge** — só aparece para workspaces já em `status = 'deleted'`. Botão "Excluir definitivamente" com confirmação dupla (digitar o nome do workspace). Remove workspace e todos os dados em cascata via `ON DELETE CASCADE` já existente ou cleanup dedicado.

**Restaurar** — para workspaces em `status = 'deleted'` que ainda não foram purgados, botão "Restaurar" que volta `status = 'active'` e limpa `deleted_at`.

### Alterações técnicas

**Banco (migration)**:
- Adicionar coluna `deleted_at timestamptz` em `public.workspaces` (se não existir).
- Índice parcial `WHERE status = 'deleted'` para lixeira.
- Função `soft_delete_workspace(ws_id uuid)` e `purge_workspace(ws_id uuid)` como SECURITY DEFINER, validando `is_platform_admin(auth.uid())` no início.
- Bloquear acesso: `has_workspace_access` / `workspace_members` policies devem tratar `status = 'deleted'` como sem acesso (revisar policies existentes que já filtram por status).

**Server functions** (`src/lib/admin/workspaces.functions.ts`):
- `updateWorkspaceAdmin` — já existe, confirmar campos aceitos e uso.
- `softDeleteWorkspaceAdmin({ id })` — chama RPC `soft_delete_workspace`.
- `restoreWorkspaceAdmin({ id })` — status volta para `active`, `deleted_at = null`.
- `purgeWorkspaceAdmin({ id, confirmName })` — valida nome digitado antes de chamar RPC `purge_workspace`.
- Todas com `.middleware([requireSupabaseAuth])` + checagem `has_role(userId, 'platform_admin')` no handler antes de importar `supabaseAdmin`.

**UI**:
- `/admin/workspaces` (listagem): adicionar filtro "Ativos / Suspensos / Excluídos", ações por linha (Editar, Suspender/Ativar, Excluir, Restaurar, Excluir definitivamente conforme status).
- `/admin/workspaces/$id` (detalhe existente): adicionar seção "Zona de perigo" com botões conforme status atual + dialog de edição de metadados.
- Componentes: `EditWorkspaceDialog`, `DeleteWorkspaceDialog` (soft, com aviso), `PurgeWorkspaceDialog` (com input de confirmação do nome).

**UX/Design system**:
- Usar `PageHeader`, `DataTable`, `StatusBadge` (verde=active, amarelo=suspended, cinza=deleted), `AlertDialog` para confirmações destrutivas.
- Toasts pós-ação + `queryClient.invalidateQueries(['admin', 'workspaces'])`.
- Loading/empty/error states.

### Segurança
- Todas as operações validam platform admin via `context.supabase.rpc('has_role', ...)` — nunca confiar só na UI.
- Purge exige digitar o nome exato do workspace (defesa contra clique acidental).
- Auditoria: inserir registro em `access_audit_log` (soft-delete, restore, purge) com `actor_id`, `workspace_id`, `action`.
- RLS de workspaces em `deleted` bloqueia leitura para não-admin.

### Fora do escopo
- Não mudar quem é workspace admin.
- Não criar tela `/settings/workspace` para admin comum do workspace editar o próprio.
- Não mexer em membros/branding/módulos existentes.
- Sem export automático de dados antes do purge (podem usar Cloud → Export data manualmente).

### Validação manual
1. Como platform admin, criar workspace → aparece na lista.
2. Editar nome/slug → persiste.
3. Soft-delete → some da lista padrão, aparece no filtro "Excluídos", membros deste workspace deslogados perdem acesso.
4. Restaurar → volta para ativo.
5. Purge com nome errado → rejeita. Com nome correto → workspace e dados sumem.
6. Como usuário comum de workspace, tentar chamar as funções → 403.
