## Diagnóstico

O botão **"+ Novo Convite"** em `/settings/workspace-team/` chama `createWorkspaceInvite` (`src/lib/workspace-invites.functions.ts`), que **não envia nenhum e-mail** — apenas grava um token em `workspace_invites` e devolve a URL `…/accept-invite/<token>` para o admin copiar.

Ou seja, o e-mail que o Hugo recebeu da Lovable **não veio desse fluxo**. As fontes possíveis são:

1. **Botão "Share" do editor Lovable** (canto superior do editor, ou Project Settings → Collaborators) — esse sim envia e-mail "Editor/Viewer do projeto Lovable". É independente do app.
2. **`/admin/workspaces/:id`** (rota de super-admin de plataforma) que chama `inviteUserToWorkspace` em `src/lib/platform-admin.functions.ts` → usa `supabaseAdmin.auth.admin.inviteUserByEmail`, que dispara o template de **convite do Supabase Auth** (renderizado hoje pelo template auth do projeto, com remetente `notify.wktechnology.com.br`). Esse e-mail **não** dá acesso ao Lovable, mas o texto padrão pode confundir.

Se o Hugo recebeu literalmente um e-mail `noreply@lovable.dev` dizendo para abrir o projeto no editor, foi o caso (1) — Share. Precisamos remover/evitar esse caminho e fazer o `/settings/workspace-team` enviar o **próprio** e-mail transacional do app com o link de aceite.

## Objetivo

Convite de workspace = e-mail transacional do próprio sistema (remetente `notify.wktechnology.com.br`), levando ao `/accept-invite/<token>`, **sem nenhuma chamada a serviços Lovable de colaboração** e **sem usar `auth.admin.inviteUserByEmail`** (que mistura com fluxo auth do Supabase).

## Mudanças

### 1. Novo template transacional `workspace-invite`
- Criar `src/lib/email-templates/workspace-invite.tsx` (React Email):
  - Assunto: `Você foi convidado para o workspace {workspaceName}`
  - Conteúdo: nome do convidador, workspace, papel (Admin/Gestor/Membro), botão "Aceitar convite" → URL do token, validade, aviso "este convite é do sistema WKTechnology, não do Lovable".
  - Branding do app (cores/logo via tokens já usados em `mention-notification`).
- Registrar em `src/lib/email-templates/registry.ts`.

### 2. Disparar e-mail no `createWorkspaceInvite`
- Em `src/lib/workspace-invites.functions.ts`, depois de inserir o convite:
  - Buscar `workspaces.name`, papel legível e nome do convidador (`profiles.full_name`).
  - `POST` server-side para `/lovable/email/transactional/send` com `templateName: "workspace-invite"`, `to: email`, idempotency key `workspace-invite:<invite_id>`, e payload (nome do workspace, papel, link, convidador, expiração).
  - Erros de envio são logados mas **não** revertem o convite (admin ainda tem a URL para copiar como fallback).
- Manter o retorno `{ ok, url, token, email }` para a UI continuar mostrando o link.

### 3. UI `/settings/workspace-team`
- Após "Novo Convite": mostrar toast "Convite enviado para `<email>`" e manter a URL copiável como fallback.
- Adicionar botão "Reenviar e-mail" em cada convite pendente (nova server fn `resendWorkspaceInvite(invite_id)` que reutiliza o token existente e re-dispara o template).

### 4. Bloquear o caminho que gerava confusão
- Em `src/lib/platform-admin.functions.ts` (`inviteUserToWorkspace` e a função em `teams.functions.ts` que ainda usa `auth.admin.inviteUserByEmail`):
  - Substituir as chamadas `supabaseAdmin.auth.admin.inviteUserByEmail` por: criar registro em `workspace_invites` + enviar o mesmo template `workspace-invite`.
  - Isso elimina o e-mail de "convite Supabase Auth" e unifica todo convite de usuário do sistema em um único fluxo branded.

### 5. Comunicação ao usuário (não-código)
Deixar claro na resposta final que:
- O e-mail que o Hugo recebeu veio do **Share do editor Lovable**, não desse formulário. Para removê-lo, abrir Project Settings → Collaborators no editor e remover o convite/acesso dele lá.
- Daqui pra frente, o "+ Novo Convite" envia e-mail próprio do sistema com a marca WKTechnology.

## Fora de escopo
- Mudar template/branding do auth Supabase (recuperação de senha etc.).
- Editar Share/colaboradores do Lovable via API (não há tooling para isso pelo agente).
