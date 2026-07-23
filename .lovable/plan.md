## Problema

Ao excluir workspace, o RPC `soft_delete_workspace` lança `forbidden: platform admin only` mesmo o usuário sendo super-admin.

**Causa raiz (confirmada):** as três RPCs (`soft_delete_workspace`, `restore_workspace`, `purge_workspace`) são chamadas via `supabaseAdmin` (service role) na server function. Em conexão de service role, `auth.uid()` é `NULL`, então `is_platform_admin(auth.uid())` retorna `false` → exceção. A verificação real do super-admin já é feita antes, em TypeScript, por `assertPlatformAdmin(context.userId)`.

Grants atuais: `EXECUTE` liberado para `anon` e `authenticated` — a RPC hoje é o único guardião contra chamada direta pela Data API, e ela só protege via `auth.uid()`, que só funciona quando chamada pelo cliente autenticado — o que não é o caso.

## Correção

Migration única, sem alterar RLS, GRANTs de tabela ou lógica de negócio:

1. Adicionar parâmetro `_actor uuid` às três RPCs. A verificação passa a ser `is_platform_admin(_actor)`.
2. `REVOKE EXECUTE ... FROM anon, authenticated` nas três funções — só o `service_role` (backend) executa. Como o TS já confirmou o super-admin, isso é seguro.
3. Atualizar `src/lib/platform-admin.functions.ts` para passar `_actor: context.userId` em `softDeleteWorkspaceAdmin`, `restoreWorkspaceAdmin` e `purgeWorkspaceAdmin`.

## Validação

- Migration aprovada e aplicada.
- `psql \df+ soft_delete_workspace` mostra o novo parâmetro e ausência de EXECUTE para anon/authenticated.
- Excluir Peptídeos Brasil em `/admin/workspaces` → item vai para aba "Lixeira" sem erro.
- Restaurar volta para "Ativos".
- Purge exige digitar o nome e apaga com sucesso.

## Fora de escopo

- Sem novas policies, sem `service_role` bypass artificial, sem alterar `is_platform_admin`.
- Sem mexer nas demais server functions administrativas.
