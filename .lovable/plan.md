# Botão "Nova vaga" oculto para Priscila — corrigir owner_id em user_job_roles

## Diagnóstico (confirmado)

O botão "Nova vaga" em `/jobs` é gated por `<Can permission="techhire.jobs.create.own">`. O hook `usePermissions` chama a RPC `current_user_permissions(_workspace_id)` passando o workspace do usuário (via `workspace_members`).

Consultas realizadas:
- Priscila é membro do workspace `184b9435-…` (WK Technology).
- Ela tem `user_job_roles.role_id = aaaaaaaa-…-04` (Head de RH) contendo `techhire.jobs.create.own` (e outras `techhire.jobs.*`).
- Mas o registro em `user_job_roles` está com `owner_id = 1c237fbe-…` — que é um **user_id**, não o workspace. Portanto a RPC (que filtra por `owner_id = _workspace_id`) devolve `[]` para o workspace correto, e o `Can` esconde o botão.

Outros usuários do mesmo workspace têm a mesma inconsistência (`cba8e2c2`, `d473eff9`, `bc636710`, `5946963b` — Priscila). Um deles inclusive tem duas linhas: uma com `owner_id = 1c237fbe-…` (errado) e outra com `owner_id = 184b9435-…` (correto), o que confirma que o valor certo é o workspace.

Escopo: apenas normalizar os dados existentes de `user_job_roles`. Não altera código, RLS, roles ou permissões.

## Passos

1. **Migração SQL** (`supabase/migrations/…_fix_user_job_roles_owner_id.sql`)
   - Para cada linha de `user_job_roles` cujo `owner_id` NÃO é um `workspaces.id`, substituir por `workspace_members.workspace_id` do próprio `user_id`.
   - Ignorar (log via `RAISE NOTICE`) linhas em que o usuário não tem workspace_member — nada a fazer.
   - Deduplicar caso a correção crie conflito com uma linha já existente no mesmo (user_id, role_id, owner_id): manter a `is_primary = true` (ou a mais recente) e remover a duplicada.

   Estrutura:
   ```sql
   WITH bad AS (
     SELECT ujr.id, wm.workspace_id AS correct_owner
     FROM user_job_roles ujr
     JOIN workspace_members wm ON wm.user_id = ujr.user_id
     WHERE ujr.owner_id NOT IN (SELECT id FROM workspaces)
   )
   UPDATE user_job_roles ujr
   SET owner_id = bad.correct_owner
   FROM bad
   WHERE ujr.id = bad.id
     AND NOT EXISTS (
       SELECT 1 FROM user_job_roles x
       WHERE x.user_id = ujr.user_id
         AND x.role_id = ujr.role_id
         AND x.owner_id = bad.correct_owner
         AND x.id <> ujr.id
     );

   -- remover as que ficaram órfãs por já existir a versão correta
   DELETE FROM user_job_roles ujr
   WHERE ujr.owner_id NOT IN (SELECT id FROM workspaces)
     AND EXISTS (
       SELECT 1 FROM workspace_members wm
       JOIN user_job_roles x ON x.user_id = wm.user_id AND x.role_id = ujr.role_id
       WHERE wm.user_id = ujr.user_id AND x.owner_id = wm.workspace_id
     );
   ```

2. **Validação pós-migração** (via `supabase--read_query`):
   - `SELECT count(*) FROM user_job_roles WHERE owner_id NOT IN (SELECT id FROM workspaces);` deve ficar próximo de 0 (só sobra usuário sem workspace_member).
   - `SELECT current_user_permissions('184b9435-…') …` executado como Priscila (via server function) deve retornar as `techhire.jobs.*`.

3. **Comunicação ao usuário**: pedir a Priscila para dar F5 (as permissões têm `staleTime` de 5 min).

## Não incluído neste plano

- Não altero a RPC `current_user_permissions`, o hook `usePermissions`, o componente `<Can>` nem o botão em `jobs.index.tsx` — o código está correto, o problema é dado inconsistente.
- Não adiciono FK/constraint em `user_job_roles.owner_id → workspaces.id` agora (pode quebrar seed histórico); posso propor em plano separado.

## Como validar manualmente

1. Login como Priscila em `/jobs`.
2. O botão "Nova vaga" deve aparecer no header, ao lado do FilterBar.
3. Em `/settings/my-permissions` (se existir) devem aparecer as permissões `techhire.jobs.*`.
