## Diagnóstico

Cristiane tem cargo **Vendedor** no workspace. As policies RLS de INSERT das entidades TechSales estão **inconsistentes**:

| Tabela | Permissão exigida no INSERT | Vendedor tem? |
|---|---|---|
| contacts | `techsales.contacts.create.own` | ✅ |
| deals | `techsales.deals.create.own` | ✅ |
| activities | `techsales.activities.create.own` | ✅ |
| **companies** | **`techsales.companies.manage.workspace`** | ❌ |

O catálogo `public.permissions` só tem duas chaves para companies: `view.workspace` e `manage.workspace` — não existe `create.own`. Vendedor só recebe `view.workspace`, então RLS bloqueia o INSERT.

Confirmado via `user_has_permission(cristiane, ws, 'techsales.companies.manage.workspace') = false`.

## Correção (migration única)

1. Adicionar novas chaves em `public.permissions`:
   - `techsales.companies.create.own`
   - `techsales.companies.update.own`
   - `techsales.companies.delete.own`

2. Conceder `create.own`/`update.own` aos permission_sets que já concedem `contacts.create.own` (Vendedor, Gerente, SDR, etc.), mantendo `manage.workspace` apenas para Admin/Owner/Gerente.

3. Reescrever as policies de `companies` para espelhar o padrão de `contacts`:
   - **INSERT**: `create.own` OU `manage.workspace`
   - **UPDATE**: (`update.own` AND `owner_id = auth.uid()`) OU `manage.workspace`
   - **DELETE**: (`delete.own` AND `owner_id = auth.uid()`) OU `manage.workspace`
   - **SELECT**: mantém como está (workspace inteiro)

## Validação

- `user_has_permission(cristiane, ws, 'techsales.companies.create.own')` = `true`.
- Cristiane consegue cadastrar empresa.
- Vendedor não consegue editar/excluir empresas de terceiros (só as próprias).
- Admin/Owner continuam com controle total.

## Fora do escopo

- UI de gestão de cargos.
- Revisão paralela de leads/products (podem ter mesma inconsistência — abordo em PR separado se quiser).