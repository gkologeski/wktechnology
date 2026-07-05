## Diagnóstico

Os dois sintomas relatados têm a mesma causa raiz em `src/lib/access-control/access-mutations.functions.ts`, função `setMemberAssignments`:

- A função grava/lê em `user_job_roles` e `user_permission_sets` usando `workspace_id = userId` (o UUID do próprio usuário logado).
- A tela de governança (`getAccessBundle` em `src/lib/access-control/access.functions.ts`, linhas 90–140) resolve o `workspaceId` real via `workspace_members.workspace_id` (um UUID distinto do user_id) e é esse valor que aparece no grid.
- O mesmo `resolveActiveWorkspace` é usado para checar se Aline é membro — mas `setMemberAssignments` procura em `workspace_members` com `.eq("workspace_id", userId)`, então:
  - **Atribuir owner a si mesmo:** o `if (!member && data.user_id !== userId)` é curto-circuitado (data.user_id === userId), o INSERT ocorre em `user_job_roles` com `workspace_id = userId`. A tela lê pelo workspace real → nada aparece no grid, apesar do toast de sucesso.
  - **Atribuir a Aline:** o SELECT em `workspace_members` retorna vazio (workspace_id filtrado errado), Aline !== userId → lança "Usuário não é membro deste workspace."

## Correção proposta (escopo mínimo)

**Arquivo único:** `src/lib/access-control/access-mutations.functions.ts`

1. Adicionar um helper local `resolveActiveWorkspace(supabase, userId)` idêntico ao já existente em `access.functions.ts` (consulta `workspace_members.workspace_id` e cai para `workspaces.created_by`). Retorna o UUID real do workspace.
2. Em `setMemberAssignments` (linhas 285–374):
  - Resolver `const workspaceId = await resolveActiveWorkspace(supabase, userId)` logo após `assertWorkspaceOwner`; se `null`, lançar erro claro.
  - Trocar `workspace_id: userId` / `.eq("workspace_id", userId)` por `workspaceId` em:
    - lookup em `workspace_members` (linha 296) — inclusive tratar o próprio owner (que pode não estar em `workspace_members`) mantendo o bypass `data.user_id === userId` **ou** validando via `workspaces.created_by = data.user_id`.
    - DELETE de `user_job_roles` (linha 307).
    - INSERT rows em `user_job_roles` (`workspace_id: workspaceId` — linhas 313, 321, 331).
    - DELETE de `user_permission_sets` (linha 346).
    - INSERT rows em `user_permission_sets` (linha 353).
3. **Não alterar** as demais funções (`upsertJobRole`, `upsertPermissionSet`, `upsertFieldRule`, `logAudit`) neste passo — elas seguem o padrão legado `workspace_id: userId` e a leitura correspondente hoje já ignora esse filtro; mexer nelas está fora do escopo relatado e pode invalidar dados existentes.
4. **Não alterar** RLS, schema, ou `getAccessBundle`. Só o path de escrita de atribuição de membro.

## Validação manual

1. Como owner, abrir Governança/Controle de Acesso, atribuir cargo "Workspace Owner" (ou outro) a si mesmo → salvar → recarregar → verificar que aparece no grid com o cargo correto.
2. Convidar Aline (se ainda não é membro) e aguardar aceite; depois atribuir cargo a ela → deve salvar sem erro e aparecer no grid.
3. Tentar atribuir cargo a um usuário que NÃO é membro → deve continuar retornando "Usuário não é membro deste workspace."
4. Rodar typecheck: `bun run typecheck`.

## Riscos

- Baixo. A mudança é aditiva no caminho de escrita e alinha com o path de leitura já em produção. Registros gravados anteriormente com o workspace_id incorreto (= user_id do owner) continuarão órfãos no grid; se desejado, um script de backfill pode migrá-los depois — **não incluído** neste plano por estar fora do escopo do bug reportado.

## Pendências (fora deste plano)

- Auditar as outras mutações do mesmo arquivo que usam `workspace_id: userId` (roles, sets, field rules, audit log). Provavelmente têm o mesmo problema latente, mas não afetam o sintoma relatado.