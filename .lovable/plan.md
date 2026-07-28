## Escopo

Duas frentes independentes disparadas pelo mesmo problema (marca "Lovable" aparecendo no fluxo de login/convite):

1. **Remover a tela "Grant permission to TechERP" da Lovable no login Google** — via BYOK (Google OAuth próprio).
2. **Nova tela de configuração do layout do convite** + rebranding do e-mail e da página `/accept-invite/$token` para não citar Lovable.

---

## Parte 1 — BYOK Google OAuth (config, sem código)

A tela do print é o consent do broker da Lovable (`oauth.lovable.app`), infraestrutura gerenciada — não pode ser reestilizada por código do app. A única forma de removê-la é usar credenciais Google próprias: aí o popup passa direto pelo consent nativo do Google, com a marca do TechERP.

Passos que **você** executa (não posso executar por você):

1. No Google Cloud Console → **APIs & Services → Credentials → Create OAuth Client ID** (tipo Web).
2. Em **Consent Screen**, configure nome do app "TechERP", domínios `wktechnology.com.br` e logo.
3. Copie o **Callback URL** exibido em Cloud → Users → Authentication Settings → Google e cole nas Authorized redirect URIs do Google.
4. Cole Client ID + Secret em Cloud → Users → Authentication Settings → Google.

Sem alteração de código no repositório para esta parte — o `lovable.auth.signInWithOAuth("google", …)` já em uso continua funcionando; muda apenas o provedor de credenciais.

---

## Parte 2 — Configuração do layout do convite (código)

### 2.1 Persistência

Nova tabela `workspace_invite_settings` (workspace-scoped, 1 linha por workspace):

```text
workspace_id (PK/FK), subject, greeting, body_intro, cta_label,
footer_note, expires_note, product_name, updated_at, updated_by
```

Grants + RLS: SELECT/INSERT/UPDATE/DELETE apenas para `authenticated` do workspace via `is_workspace_admin_v2(workspace_id, auth.uid())`; `service_role` full. Anon: sem acesso.

Logo/cor primária/nome do produto continuam vindos de `workspace_branding` (já existe) — a nova tela reaproveita, não duplica.

### 2.2 Server functions (`src/lib/workspace-invite-settings.functions.ts`)

- `getInviteSettings()` — retorna settings + branding do workspace atual, com fallback para defaults em PT-BR.
- `updateInviteSettings({ …campos })` — admin-only, upsert.

### 2.3 Tela `/settings/invite-branding`

Route: `src/routes/_authenticated/settings.invite-branding.tsx` seguindo o padrão TechHire (`AtsPageHeader` + `FormSection` + `LoadingSkeleton` + `EmptyState`). Layout em 2 colunas:

- **Coluna esquerda — formulário**: campos texto (assunto, saudação, corpo introdutório, texto do CTA, nota de rodapé, nota de expiração, nome do produto exibido). Cada campo autosalva com debounce (padrão dos settings do TechHire).
- **Coluna direita — preview**: renderiza o `WorkspaceInviteEmail` com os valores atuais + branding do workspace. Preview idêntico ao HTML enviado.

Guardada por `usePermissions('workspace.settings.manage')`.

### 2.4 Rebranding do template `workspace-invite`

Atualizar `src/lib/email-templates/workspace-invite.tsx` para:

- Receber `subject`, `greeting`, `bodyIntro`, `ctaLabel`, `footerNote`, `expiresNote`, `productName`, `logoUrl`, `primaryColor` via `templateData`.
- Renderizar logo do workspace no topo (fallback: nome do produto em texto).
- Usar `primaryColor` do branding no botão CTA e detalhes (com fallback para o azul atual).
- Textos default seguindo o template solicitado pelo usuário:
  - Assunto: `Você foi convidado para {workspaceName} — {productName}`
  - Saudação: `Olá {inviteeEmail}, {inviterName} convidou você para acessar o workspace {workspaceName} do módulo {productName} como {roleLabel}.`
  - Bloco explicativo: `Este convite é para usar o sistema {productName}. Ao aceitar, você criará sua senha e poderá entrar imediatamente.`
- Nenhuma menção a "Lovable".

### 2.5 Pipeline de envio

Ajustar `src/lib/workspace-invites.functions.ts::sendWorkspaceInviteEmail` para:

- Carregar `workspace_invite_settings` + `workspace_branding` do workspace do convite.
- Passar todos os campos configurados no `templateData`.
- Subject dinâmico usa `settings.subject` renderizado com placeholders `{workspaceName}` / `{productName}`.
- Manter idempotência (`idempotency_key`) e logging existentes.

### 2.6 Página `/accept-invite/$token`

Auditoria + ajustes em `src/routes/accept-invite.$token.tsx`:

- Buscar branding do workspace via server fn pública já existente (ou criar `getInviteBrandingByToken` no lado servidor — apenas dados não sensíveis: logo, cor, nome do produto, nome do workspace).
- Substituir qualquer logo/texto genérico pela marca do workspace.
- Garantir que rotas de fallback (erro/expirado) usem os mesmos assets.
- Nenhuma menção a Lovable em nenhum estado (loading/erro/sucesso).

### 2.7 Sidebar

Adicionar entrada "Convite" (ou anexar aba "Convite" dentro de `/settings/branding`) — seguir agrupamento atual de settings. Decisão de UX: **aba** dentro de `/settings/branding` chamada "Convite" para manter branding centralizado; a rota `/settings/invite-branding` fica como fallback.

---

## Detalhes técnicos

- Migration única: cria `workspace_invite_settings` com grants + RLS admin-only e trigger `updated_at`.
- Sem alteração em `client.ts` / `types.ts` (auto-gerados; regenerados pelo Cloud).
- Preview do e-mail reutiliza `render()` do `@react-email/render` já em uso; renderização client-side através de `iframe srcdoc` para fidelidade visual.
- Nenhuma alteração em RLS de outras tabelas, autenticação ou lógica de negócio.
- Nenhuma dependência nova.

## Fora de escopo

- Personalizar o consent broker da Lovable (impossível sem BYOK).
- Alterar templates de auth email (signup/reset) — só o `workspace-invite`.
- Traduzir/rebrandear e-mails de outros módulos.

## Como validar manualmente

1. `/settings/branding` → aba **Convite**: alterar assunto e CTA, ver preview atualizado.
2. Convidar novo usuário de teste; conferir e-mail recebido (assunto, saudação, logo, cor, sem "Lovable").
3. Abrir link `/accept-invite/$token` em navegador anônimo; conferir branding do workspace nos estados válido/expirado.
4. BYOK Google: após configurar no Cloud Dashboard, testar login com Google numa conta nova — deve pular direto para o consent nativo do Google.
