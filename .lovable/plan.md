## Causa
As policies das tabelas `user_job_roles` e `user_permission_sets` exigem `workspace_id = auth.uid()` (owner-scoped). O fix anterior passou a gravar `workspace_id` = UUID real do workspace (`workspaces.id`), que é diferente de `auth.uid()` → o INSERT viola RLS e aparece o toast.

Do outro lado, `getAccessBundle` também estava lendo com o UUID real do workspace, então reverter a gravação sozinha faria o grid não atualizar (bug original).

## Correção
Alinhar tudo ao contrato atual do RLS (`workspace_id = auth.uid()`) em `access-control`:

1. `src/lib/access-control/access-mutations.functions.ts` — `setMemberAssignments`:
   - Manter a resolução do workspace real só para validar a associação (`workspace_members` / `workspaces.created_by`).
   - Voltar a usar `workspace_id: userId` (owner autenticado) no DELETE e no INSERT de `user_job_roles` e `user_permission_sets`.

2. `src/lib/access-control/access.functions.ts` — `getAccessBundle`:
   - Ler `user_job_roles` e `user_permission_sets` filtrando por `workspace_id = userId` (owner), não pelo UUID real do workspace.
   - Manter a lista de membros vinda de `workspace_members` (para nomes/emails/UIDs a exibir), apenas mudar o filtro das duas tabelas de atribuição.

Sem alterações em RLS, schema, outras server functions, ou UI. Nada fora de `access-control`.

## Validação manual
- Atribuir cargo a si mesmo → salvar sem erro e aparecer no grid.
- Atribuir cargo a outro membro (ex.: aline@…) → salvar e aparecer no grid.
- Remover cargo → refletir no grid.
- Recarregar a página `/home/access` e conferir persistência.

## Riscos
Baixos. Restaura o comportamento pré-fix nas gravações e ajusta somente a leitura correspondente. Registros gravados com `workspace_id` = UUID real do workspace (produzidos pelo fix anterior) ficarão órfãos no grid; se precisar, faço backfill em passo separado.
