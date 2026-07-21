## Diagnóstico

O insert em `public.people` falha porque a policy `people_insert` chama:

```
is_workspace_admin_v2(auth.uid(), owner_id)
```

Mas a assinatura da função é `is_workspace_admin_v2(_workspace uuid, _user uuid)`. Os argumentos estão **trocados** — a função procura um workspace cujo id é o do usuário e um membro cujo id é o do workspace, o que nunca casa. Resultado: nenhum usuário (nem o owner) passa no `WITH CHECK`, e todo cadastro de pessoa é bloqueado pela RLS.

O mesmo padrão invertido está aplicado a outras policies que ainda não foram corrigidas:

- `people` (insert / update / delete / select)
- `people_documents` (select / write)
- `people_events` (select / write)
- `people_benefits` (select / write)
- `workflow_subscriptions` (admin manage)

As policies de `people_allocations` e `onboarding_templates` já usam a ordem correta `(auth.uid(), workspace_id)` — não serão alteradas.

## Correção

Migration única que recria as policies afetadas trocando a ordem dos argumentos para `is_workspace_admin_v2(owner_id, auth.uid())`, preservando toda a lógica adicional (manager, profile, `can_view_person`, sensibilidade de documentos, etc.).

Sem mudanças em código de aplicação, schema ou funções — apenas RLS.

## Validação

- Rodar linter Supabase.
- Confirmar via `pg_policy` que as expressões estão com a ordem certa.
- Pedir para o usuário tentar cadastrar uma pessoa novamente.
