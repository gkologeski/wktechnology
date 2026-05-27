# Multi-tenancy real + super-admin + white-label

São 80 tabelas com `owner_id` hoje. A migração é grande, então vou fazer em **4 fases**, sem quebrar o app entre elas. Você aprova fase a fase.

---

## Fase 1 — Fundação (banco)

Novas tabelas:
- `workspaces` — id, name, slug, logo_url, primary_color, custom_domain, created_by, status, timestamps
- `workspace_members` — workspace_id, user_id, role (admin/manager/member), invited_by, joined_at
- `platform_admins` — user_id (= super-admins globais; você entra aqui)
- `workspace_invites` — workspace_id, email, role, token, expires_at, accepted_at

Funções SECURITY DEFINER:
- `is_platform_admin(_user uuid)` — true se está em `platform_admins`
- `is_workspace_member(_ws uuid, _user uuid)` — true se membro ou platform_admin
- `current_user_workspaces()` — workspaces visíveis ao usuário atual

Não toca em nenhuma tabela de dados ainda. App continua funcionando.

---

## Fase 2 — Backfill + coluna `workspace_id`

- Cria 1 workspace **"WK Technology"** apontando para o seu `auth.uid()` (você vira `created_by` e primeiro `admin`).
- Para cada um dos 80 tabelas com `owner_id`:
  - `ADD COLUMN workspace_id uuid`
  - `UPDATE ... SET workspace_id = (workspace da WK Technology)` (todos os dados atuais)
  - `NOT NULL` + FK → `workspaces(id)` + index
- Outros usuários que já existem (se houver) viram members do mesmo workspace, ou ganham workspace próprio — me confirma na execução.

App continua usando `owner_id` para autorias; `workspace_id` é o eixo de tenant.

---

## Fase 3 — RLS e server functions

- Reescreve todas as policies das 80 tabelas para:
  - `USING (is_workspace_member(workspace_id, auth.uid()) OR is_platform_admin(auth.uid()))`
  - `WITH CHECK` idem + força `workspace_id` ao do usuário no INSERT (via trigger).
- Trigger `set_workspace_on_insert` em cada tabela (preenche workspace_id se não vier).
- Atualiza os `createServerFn` que hoje filtram por `owner_id` para usarem o workspace ativo do usuário (via context). Adiciona resolver de "workspace ativo" (cookie/localStorage `active_workspace_id`).
- `team_members`, `user_roles`, `access_profiles` passam a ser por workspace (já são).
- Mantém `owner_id` para "criador do registro" (auditoria), mas não é mais a chave de isolamento.

---

## Fase 4 — UX: super-admin, convites, white-label

- **Desabilita signup público** (`disable_signup: true`). Remove `/signup` da UI; mantém só `/login` e `/accept-invite`.
- **`/admin/workspaces`** (só platform_admin): listar/criar workspaces + cadastrar 1º admin de cada workspace (cria user via service-role + envia convite por email).
- **Workspace switcher** no topbar (se usuário pertence a >1 — você verá todos como platform_admin).
- **Branding por workspace**: tabela `workspace_branding` já existe; conecta no `BrandingProvider` por workspace ativo. Logo, nome, cor primária.
- **Domínio próprio por workspace**: campo `custom_domain` em `workspaces`. Resolve workspace ativo pelo host (`req.headers.host`). Setup DNS do cliente → CNAME para o app + você habilita no Lovable (custom domain por projeto). *Observação: Lovable hoje suporta 1 domínio por projeto — para domínio por workspace de verdade precisa de um domínio coringa (`*.seudominio.com`) ou config manual. Confirmo o approach na fase 4.*
- **Remover branding Lovable visível**: badge "Edit with Lovable" pode ser desligado em Publish Settings; revisar textos.

---

## Detalhes técnicos (resumo)

```
workspaces(id, name, slug UNIQUE, logo_url, primary_color, custom_domain UNIQUE NULL, created_by, status, created_at, updated_at)
workspace_members(workspace_id, user_id, role, PRIMARY KEY(workspace_id, user_id))
platform_admins(user_id PRIMARY KEY)
workspace_invites(id, workspace_id, email, role, token UNIQUE, expires_at, accepted_at)

-- helper
is_platform_admin(u) := EXISTS(SELECT 1 FROM platform_admins WHERE user_id=u)
is_workspace_member(w, u) := is_platform_admin(u) OR EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u)
```

Policies em cada tabela de dados:
```sql
USING ( is_workspace_member(workspace_id, auth.uid()) )
WITH CHECK ( is_workspace_member(workspace_id, auth.uid()) )
```

---

## Riscos / pontos de atenção

1. **Reescrita massiva de policies** — 80 tabelas, ~300 policies. Vou gerar via SQL dinâmico para reduzir erro humano.
2. **Server functions** — várias dezenas usam `owner_id = userId`. Vou trocar pela resolução de workspace ativo + checagem de membership.
3. **HubSpot/Twilio/Gmail tokens** — hoje são per-owner; viram per-workspace. Cada workspace tem suas próprias conexões.
4. **Domínio por workspace** — depende do que o Lovable suporta no plano atual. Posso entregar via subdomínios coringas (mais simples).
5. **Migração não tem rollback** — vou tirar snapshot lógico (export do banco) antes da Fase 2.

---

## Próximo passo

Aprovando o plano, eu começo pela **Fase 1** (puramente aditiva, zero risco). Você revisa antes da Fase 2.

Confirma também:
- **Seu e-mail/user_id** para entrar em `platform_admins` (uso `auth.uid()` do usuário logado se preferir).
- Se há **outros usuários** já cadastrados além de você que precisam ir para um workspace diferente do WK Technology.
