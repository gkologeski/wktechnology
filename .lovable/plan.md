## Problema

Cristiane (e provavelmente todo `member` convidado após a migração RBAC) recebe *"new row violates row-level security policy for table 'activities'"* ao executar ações que registram atividade (envio de e-mail, agendamento, etc., que aparecem no fluxo de "conectar e-mail/agenda").

Investigação confirmou:
- `workspace_members.role = member` e `user_roles.role = member` existem.
- `user_job_roles` e `user_permission_sets` estão **vazios** para ela.
- Policy `ws_insert_activities` exige `user_has_permission(auth.uid(), ws, 'techsales.activities.create.own')`, que consulta `user_job_roles`/`user_permission_sets`. Sem linhas → retorna `false` → INSERT bloqueado.
- Mesmo padrão vai reproduzir em `deals`, `contacts`, `meetings` etc. quando as policies delas dependerem do mesmo `user_has_permission`.

## Correção — 2 frentes

### 1. Backfill imediato (migration)

Atribuir o `job_role` padrão para todo usuário do workspace que hoje está em `workspace_members` sem entrada em `user_job_roles`:

- `member` → `Vendedor` (`aaaaaaaa-0000-4000-8000-000000000001`)
- `manager` → `Gerente Comercial` (`...000002`)
- `admin` → `Workspace Admin` (`...000008`)
- `owner` → `Workspace Owner` (`...000009`)

SQL (idempotente):

```sql
INSERT INTO public.user_job_roles (user_id, role_id, workspace_id, assigned_by)
SELECT wm.user_id,
       CASE wm.role
         WHEN 'owner'   THEN 'aaaaaaaa-0000-4000-8000-000000000009'::uuid
         WHEN 'admin'   THEN 'aaaaaaaa-0000-4000-8000-000000000008'::uuid
         WHEN 'manager' THEN 'aaaaaaaa-0000-4000-8000-000000000002'::uuid
         ELSE                'aaaaaaaa-0000-4000-8000-000000000001'::uuid
       END,
       wm.workspace_id,
       wm.user_id
FROM public.workspace_members wm
LEFT JOIN public.user_job_roles ujr ON ujr.user_id = wm.user_id
WHERE ujr.user_id IS NULL;
```

(Verifico colunas reais de `user_job_roles` antes de rodar; ajusto se não tiver `workspace_id`/`assigned_by`.)

### 2. Fluxo de convite (código)

Em `src/lib/workspace-invites.functions.ts` → `consumeInvite`, adicionar após a inserção em `workspace_members`/`user_roles` a inserção equivalente em `user_job_roles` usando o mesmo mapeamento acima. Assim novos convidados já entram com job_role atribuído e a UI de "Gerenciar acessos" pode refinar depois.

## Fora do escopo

- Não altero RLS nem revejo o mapeamento `role → job_role` neste PR (é o padrão definido no seed dos `job_roles`; qualquer ajuste passa por decisão de produto).
- Não mexo no OAuth callback — ele está correto.

## Validação

1. Rodar migration, confirmar `SELECT public.user_has_permission('<cristiane_uuid>', '<ws>', 'techsales.activities.create.own')` = `true`.
2. Cristiane recarrega o app e tenta a ação que falhava → sem toast RLS.
3. Convidar um usuário novo → aceitar → conferir que já cai em `user_job_roles` com "Vendedor".

## Riscos

- Backfill dá "Vendedor" a todos os `member` legados. Se algum devia ser "Recrutador" (TechHire), admin do workspace refina em Configurações → Acessos depois.
- Nenhum efeito colateral em `admin`/`owner` (recebem Workspace Admin/Owner que já vêm com policy allowlist ampla).