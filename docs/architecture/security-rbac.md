# Segurança, isolamento e RBAC

## 1. Camadas de defesa

```text
1. Rota           _authenticated/route.tsx (gate ssr:false, redireciona /auth)
2. Menu/UI        RBAC granular filtra itens e ações (não é segurança real)
3. Server fn      requireSupabaseAuth → RLS aplicada como o usuário
4. Banco          RLS + GRANT + funções security definer  ← fonte da verdade
```

Regra: **UI nunca é o controle de acesso.** Toda restrição precisa existir no
banco. A UI apenas evita esforço inútil e vazamento de navegação.

## 2. Isolamento de workspace

- `workspaces` + `workspace_members` definem o tenant. 267 tabelas têm
  `workspace_id`; as exceções estão listadas em `data-model.md`.
- Predicado canônico de leitura: `public.is_workspace_member(workspace_id)`.
  Administração: `is_workspace_admin_of(workspace_id)`.
- `owner_id` é legado. Não escrever novas queries nem novas políticas que
  dependam dele como filtro de visibilidade.
- `assigned_to` é responsabilidade funcional (coluna/filtro de grid), nunca
  critério de segurança.
- Conformidade e histórico da migração: `docs/workspace-isolation-compliance.md`.
- Testes: `tests/e2e/workspace-isolation.spec.ts` e
  `workspace-isolation-ui.spec.ts`.

## 3. RBAC granular

Modelo (tela `/settings/permissions`, componente
`src/components/access-control/permissions-matrix.tsx`):

```text
Usuário
 ├─ user_roles                → app_role (admin | manager | member)
 ├─ user_job_roles            → job_roles (cargo do workspace)
 │    ├─ job_role_default_permissions
 │    └─ job_role_permission_overrides
 ├─ user_permission_sets      → permission_sets → permission_set_items
 └─ access_profiles           → access_profile_permissions / _tools
```

- Matriz: **recurso × ação × escopo**. Ações em `perm_action`
  (`view|create|update|delete|export|approve|assign|manage`); escopos em
  `perm_scope` (`own|team|workspace|org`).
- Catálogo client-safe de objetos e ferramentas:
  `src/lib/access-profiles.constants.ts` (com `module: crm|ats`).
- Avaliação no banco: `public.user_can_act(resource, action, scope)`;
  snapshot para o cliente: `current_user_permissions()` /
  `current_user_permissions_json()`.
- Código de apoio em `src/lib/access-control/`: matriz, escopos, enforcement,
  diagnóstico de RBAC (cobertura por item de menu), auditoria.
- Mascaramento de campo: `field_permission_rules` + `field_mode`
  (`hidden|masked|readonly`).
- Convite de usuário **exige** definir permissão/cargo.
- Papéis nunca ficam em `profiles`/`people` — só nas tabelas de papel, lidas por
  funções `security definer` para evitar recursão de RLS.

Referência: `docs/rbac-mvp.md`, `docs/visibility-matrix.md`.

## 4. Padrões de política RLS

Tabela de negócio típica:

```sql
alter table public.<t> enable row level security;

create policy "<t>_select" on public.<t> for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "<t>_insert" on public.<t> for insert to authenticated
  with check (public.is_workspace_member(workspace_id)
              and public.user_can_act('<recurso>','create','workspace'));

create policy "<t>_update" on public.<t> for update to authenticated
  using (public.is_workspace_member(workspace_id)
         and public.user_can_act('<recurso>','update','workspace'));

create policy "<t>_delete" on public.<t> for delete to authenticated
  using (public.is_workspace_member(workspace_id)
         and public.user_can_act('<recurso>','delete','workspace'));
```

Antipadrões já corrigidos no projeto — não reintroduzir:

- políticas `TO public` em tabelas de negócio (use `TO authenticated` ou
  `TO anon` explícito e restrito);
- leitura cross-tenant de conteúdo "publicado" sem checar `workspace_id`
  (caso `kb_articles` / `kb_categories`);
- objetos de storage sensíveis (`people_documents`) acessíveis por `public`;
- gate de RBAC que falha aberto (_fail-open_) quando a checagem de permissão
  dá erro — deve falhar fechado.

## 5. Exclusão barrada por RLS

`DELETE` negado por RLS retorna 0 linhas **sem erro**. Sempre usar:

```ts
import { deleteRowGuarded } from "@/lib/delete-guard";
await deleteRowGuarded(supabase, "contacts", id); // lança se nada foi apagado
```

Após excluir, invalidar as queries e navegar de volta ao grid de origem.

## 6. Erros de permissão na UI

- `src/lib/access-control/handle-permission-error.ts` — normaliza e exibe
  mensagem em PT-BR.
- `src/lib/rls-denied.ts` — detecta negativa silenciosa de RLS.
- `src/lib/validation-message.ts` — traduz erros de validação zod/Postgres.

## 7. Rotas públicas e segredos

- Rotas públicas ficam na raiz de `src/routes/` e **não** têm `beforeLoad` de
  auth. Nunca chamar server fn com `requireSupabaseAuth` em loader público
  (401 no prerender).
- Endpoints em `src/routes/api/public/*` ignoram o auth do site. Cada handler
  deve validar o chamador: assinatura HMAC de webhook, `CRON_SECRET`,
  `X-Twilio-Signature`, token de API (`api_keys`), token de portal.
- Tokens públicos (`/portal/$token`, `/offer/$token`, `/quote/$token`,
  `/schedule/$token`, `/survey/$token`, `/interview/$token`) são credenciais:
  opacos, com expiração, e a leitura deve projetar apenas colunas necessárias.
- `SUPABASE_SERVICE_ROLE_KEY` e senha do banco são inacessíveis e nunca devem
  ser logados, retornados ou pedidos ao usuário.
- Segredos lidos só em `.handler()` com `process.env['X']`. Cliente usa apenas
  `import.meta.env.VITE_*`.

## 8. LGPD e retenção

`ats_candidate_consents`, `ats_dsar_requests`, `anonymize_ats_candidate`,
`audit_exports` / `audit_export_runs`, `access_audit_log`, `ip_access_log`,
`/compliance` (ATS) e `/finance/audit`. Dados sensíveis de pessoas passam por
`can_view_person_sensitive`.

## 9. Checklist antes de mergear mudança sensível

- [ ] Toda tabela nova tem `GRANT` + RLS + política, na ordem correta.
- [ ] Nenhuma política `TO public` em dado de negócio.
- [ ] Política considera `workspace_id`, não `owner_id`.
- [ ] Deleção usa `deleteRowGuarded`.
- [ ] Endpoint público valida o chamador antes de qualquer escrita.
- [ ] Nenhum segredo em escopo de módulo, log ou resposta.
- [ ] Permissão nova refletida na matriz e no menu (`menu-config*.ts`).
