
## Problema

Hoje `inviteTeamMember` chama `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: {...} })` **sem `redirectTo`**. O Supabase então usa o `SITE_URL` padrão (raiz do app). O link no email vira algo como:

```
https://<site>/#access_token=...&refresh_token=...&type=invite
```

Como a raiz redireciona para `/login` (ou `/dashboard` se já logado), o convidado:
- vê a tela de **login** (sem saber qual senha usar — ele nunca cadastrou uma),
- ou, se o navegador consumir o hash silenciosamente, fica logado sem nunca definir senha/nome.

Não existe uma rota dedicada para "aceitar convite e definir senha". É exatamente o mesmo padrão do `/reset-password`, mas para `type=invite`.

## Solução

### 1. Nova rota pública `/accept-invite` (`src/routes/accept-invite.tsx`)

- Detecta `type=invite` (ou `type=recovery` se quisermos compatível) no `window.location.hash` **e** escuta `onAuthStateChange` para o evento `SIGNED_IN`/`USER_UPDATED` que o Supabase dispara quando consome o hash.
- Mostra um card "Bem-vindo(a) ao workspace" com:
  - Nome completo (pré-preenchido com `user.user_metadata.full_name` do convite, editável)
  - Telefone (pré-preenchido com `user_metadata.phone`, editável)
  - Nova senha + confirmação (mínimo 6)
- Ao submeter:
  1. `supabase.auth.updateUser({ password, data: { full_name, phone } })`
  2. `upsert` em `profiles` com nome e telefone (via uma nova server fn `completeInviteProfile` para garantir RLS-safe).
  3. Redireciona para `/dashboard`.
- Se não houver sessão de convite válida (hash ausente / expirado), mostra mensagem "Convite inválido ou expirado" com link para `/login`.
- É rota **pública** (não fica sob `_authenticated`), igual a `/reset-password`.

### 2. Passar `redirectTo` no convite

Em `src/lib/teams.functions.ts`, ajustar:

```ts
supabaseAdmin.auth.admin.inviteUserByEmail(target, {
  data: { full_name, phone },
  redirectTo: `${process.env.SITE_URL ?? "..."}/accept-invite`,
})
```

Como `process.env.SITE_URL` não é confiável no Worker, vamos enviar a origem a partir do cliente: adicionar um campo opcional `redirect_origin` no input do server fn (preenchido com `window.location.origin` no momento do convite). O handler monta `redirectTo = redirect_origin + "/accept-invite"`.

### 3. Reenvio e estado "pendente"

- Marcar um membro como **pendente** quando ainda não confirmou o email. A coluna `team_members` ainda não tem isso, então adicionamos `invited_at timestamptz` e usamos `auth.users.email_confirmed_at` (lido via `supabaseAdmin.auth.admin.getUserById`) para derivar `pending: boolean` no `listTeamMembers`.
- Na tabela em `/settings/teams`, exibir badge **"Pendente"** ao lado do nome e um botão **"Reenviar convite"** que chama uma nova server fn `resendTeamInvite` (re-executa `inviteUserByEmail` com o mesmo `redirectTo`).
- Migration mínima: `ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now();` (sem mudanças de RLS).

### 4. Tratamento de usuário já existente

`inviteUserByEmail` falha com "User already registered" se o email já tem conta. Hoje o código só cai nesse caminho quando NÃO encontra o usuário via `listUsers`. Vamos manter a busca, mas: se o usuário existe e **ainda não confirmou** (`email_confirmed_at == null`), reenviar invite; se já confirmou, apenas adicionar em `team_members` (fluxo atual).

### 5. UX no email

O template padrão do Supabase para "Invite user" já existe e funciona com `redirectTo`. Nenhuma mudança de template é necessária nesta entrega — apenas garantir que o link aponta para `/accept-invite`. Customização visual do email fica fora do escopo.

## Arquivos afetados

- **Novo**: `src/routes/accept-invite.tsx`
- **Editado**: `src/lib/teams.functions.ts` (passar `redirectTo`, novo `resendTeamInvite`, expor `pending` no `listTeamMembers`, nova `completeInviteProfile`)
- **Editado**: `src/routes/_authenticated/settings.teams.tsx` (passar `redirect_origin` no invite, badge "Pendente", botão "Reenviar convite")
- **Migration**: adicionar `team_members.invited_at`

## Fora de escopo

- Customização visual do email de convite (template Lovable/Supabase).
- Expiração custom do link (mantém o padrão de 24h do Supabase).
- Permitir convidar múltiplos usuários de uma vez.
