## Objetivo

Corrigir dois problemas em `/settings/permissions`:

1. Ao rolar horizontalmente, a coluna "Recurso / Ação" desaparece — o usuário perde a referência do que está marcando.
2. Cargos de sistema estão totalmente bloqueados; o usuário quer poder editá-los, com um botão "Restaurar padrões" para desfazer.

---

## Escopo

Arquivos alterados:
- `src/components/access-control/permissions-matrix.tsx` — sticky column + habilitar edição de cargos de sistema + botão "Restaurar padrões".
- `src/lib/access-control/role-bundle.functions.ts` — remover bloqueio de `is_system` nas mutations de permissão; adicionar server function `restoreRoleDefaults`.
- 1 migration nova — snapshot da configuração padrão de cada cargo de sistema em uma nova tabela `public.job_role_default_permissions (role_id, permission_key)`, populada a partir do estado atual (`permission_set_items` das bundles vinculadas aos cargos `is_system`). Isso serve como fonte de verdade para o restore.

Fora do escopo: renomear/excluir cargos de sistema (permanecem bloqueados — só permissões passam a ser editáveis), alterar catálogo de `permissions`, RLS.

---

## Mudanças

### 1. Sticky da 1ª coluna (UX)

Na tabela em `permissions-matrix.tsx`:
- Adicionar `sticky left-0 z-20 bg-background` na `<th>` "Recurso / Ação" e nas `<td>` correspondentes de cada linha.
- Cabeçalho do grupo (linha do resource) recebe `sticky left-0 bg-muted/40 z-20` na célula visível.
- Ajustar `z-index` do `thead` para que sticky vertical + horizontal coexistam (topo `z-30`, célula canto `z-40`).
- Container mantém `overflow-auto`; adicionar `border-r` sutil na coluna sticky para separação visual durante o scroll.

### 2. Edição de cargos de sistema

- `role-bundle.functions.ts`: remover a chamada `assertRoleEditable` em `setRolePermission` e `bulkSetRolePermissions` (mantê-la apenas em `renameJobRole` e `deleteJobRole`, pois nome/exclusão continuam bloqueados).
- `ensureBundle` já funciona para qualquer `role_id` — cria uma bundle de propriedade do usuário atual, sem tocar em registros do sistema.
- Na UI: remover `disabled={r.is_system}` dos checkboxes e das barras de "Conceder/Remover todas". Remover o banner amarelo "todos os cargos são padrão…". Manter o cadeado no header como indicador visual de que o cargo é do sistema (renomear/excluir continuam bloqueados no dropdown).

### 3. Restaurar padrões

**Migration:**
```sql
CREATE TABLE public.job_role_default_permissions (
  role_id uuid REFERENCES public.job_roles(id) ON DELETE CASCADE,
  permission_key text REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);
GRANT SELECT ON public.job_role_default_permissions TO authenticated;
GRANT ALL ON public.job_role_default_permissions TO service_role;
ALTER TABLE public.job_role_default_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read defaults" ON public.job_role_default_permissions
  FOR SELECT TO authenticated USING (true);

-- Snapshot do estado atual dos cargos de sistema
INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT DISTINCT jrs.role_id, psi.permission_key
FROM public.job_roles jr
JOIN public.job_role_sets jrs ON jrs.role_id = jr.id
JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
WHERE jr.is_system = true
ON CONFLICT DO NOTHING;
```

**Server function `restoreRoleDefaults`** em `role-bundle.functions.ts`:
- Input: `{ role_id }`.
- Se o cargo não é `is_system`, erro amigável ("Restauração disponível apenas para cargos padrão").
- Lê defaults da nova tabela.
- Recria a bundle do usuário (`ensureBundle`): deleta todos os `permission_set_items` da bundle e insere apenas as chaves default.
- Retorna `{ ok, count }`.

**UI:** novo item "Restaurar padrões" no `DropdownMenu` do cargo, visível apenas quando `r.is_system`. Confirmação inline via toast/mutation. Invalida `["access", "matrix"]`.

---

## Validação manual

1. Rolar horizontalmente a matriz — coluna "Recurso / Ação" permanece visível.
2. Marcar/desmarcar permissão em um cargo de sistema (ex.: "Admin") — persiste após reload.
3. Clicar "Restaurar padrões" no dropdown do cargo de sistema — permissões voltam ao seed original.
4. Cargos personalizados continuam funcionando (criar, duplicar, renomear, excluir).
