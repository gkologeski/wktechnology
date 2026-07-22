## Causa

Ao editar as permissões de um cargo de sistema (`is_system=true`, `owner_id=NULL`), o servidor chama `ensureBundle`, que cria um `permission_set` do tipo bundle (owned pelo usuário) e faz `upsert` em `public.job_role_sets` ligando o bundle ao cargo.

A política `jrs_write` de `job_role_sets` exige:

```
EXISTS (SELECT 1 FROM job_roles r WHERE r.id = role_id AND r.owner_id = auth.uid())
```

Cargos de sistema têm `owner_id = NULL`, então o `WITH CHECK` falha com “new row violates row-level security policy for table "job_role_sets"”. Isso bloqueia a edição de qualquer cargo padrão via matriz — recentemente destravada na UI, mas ainda barrada no banco.

O mesmo padrão existe em `permission_sets` e `permission_set_items` para o caso simétrico de vincular/editar itens de bundles ligados a cargos de sistema (o bundle em si é do usuário, então `psi_write` já passa; não precisa mexer). O ponto real de bloqueio é apenas `jrs_write`.

## Correção

Migration ajustando a política de escrita de `public.job_role_sets` para permitir vincular um bundle a um cargo quando **ou** o cargo é do usuário **ou** o set sendo vinculado é um bundle do próprio usuário (module `__bundle__`, `owner_id = auth.uid()`), preservando o caso atual.

```sql
DROP POLICY jrs_write ON public.job_role_sets;

CREATE POLICY jrs_write ON public.job_role_sets
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.job_roles r
          WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.permission_sets s
             WHERE s.id = job_role_sets.set_id
               AND s.owner_id = auth.uid()
               AND s.module = '__bundle__')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.job_roles r
          WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.permission_sets s
             WHERE s.id = job_role_sets.set_id
               AND s.owner_id = auth.uid()
               AND s.module = '__bundle__')
);
```

Isso mantém a segurança (só vincula bundles do próprio usuário, e cargos custom continuam restritos ao dono) e desbloqueia a edição de cargos de sistema já suportada pela UI e pelas server functions.

## Validação

- Reabrir `/settings/permissions`, marcar/desmarcar uma permissão em um cargo de sistema (ex.: “Administrador”) e confirmar persistência.
- Repetir em um cargo custom para garantir que não houve regressão.
- Rodar “Restaurar padrões” em um cargo de sistema e confirmar sucesso.