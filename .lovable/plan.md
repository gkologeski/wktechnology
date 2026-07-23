## Problema

Links públicos (cotação, portal, formulário, arquivo, reunião, convite, survey, etc.) são montados com `window.location.origin` no cliente e com fallbacks inconsistentes no servidor (`wktechnology.lovable.app`, `ats.wktechnology.com.br`). Quando o usuário está no preview (`id-preview--…lovable.app`) ou em um custom domain diferente, esse host vaza para e-mails/mensagens e o destinatário externo cai numa tela de login do editor. Regra unificada: todo link público destinado a terceiros deve usar `https://app.wktechnology.com.br`.

## Correção proposta

### 1. Helper canônico único

Em `src/lib/app-url.ts`:

- `CANONICAL_PUBLIC_URL = "https://app.wktechnology.com.br"`.
- `PROD_HOSTS = ["app.wktechnology.com.br", "crm.wktechnology.com.br", "ats.wktechnology.com.br", "wktechnology.lovable.app"]`.
- `getPublicAppUrl()`:
  - Browser: se `window.location.hostname ∈ PROD_HOSTS`, retorna `window.location.origin`; senão retorna `CANONICAL_PUBLIC_URL`.
  - Servidor: se `process.env.PUBLIC_APP_URL` estiver definido e for um host de produção, usa-o; senão `CANONICAL_PUBLIC_URL`.
- Mantém `getAppUrl()` existente para usos internos (redirect intra-app, OAuth) — sem alteração.

### 2. Substituir `window.location.origin` em geradores de link públicos (cliente)

Todos passam a chamar `getPublicAppUrl()`:

- Cotações: `src/components/deals/quote-wizard.tsx`, `src/components/deals/deal-quotes.tsx` (link público e PDF), `src/routes/_authenticated/settings.quotes.tsx`.
- Surveys: `src/components/surveys/new-survey-dialog.tsx`, `src/routes/_authenticated/settings.surveys.tsx`.
- E-sign: `src/routes/_authenticated/settings.esign.tsx`.
- Portal do cliente: `src/routes/_authenticated/settings.portal.tsx`.
- Booking: `src/routes/_authenticated/settings.booking.tsx`.
- Formulários públicos: `src/routes/_authenticated/settings.forms.tsx`.
- Arquivos compartilhados: `src/routes/_authenticated/files.tsx`.
- KB: `src/components/tickets/kb-suggestions.tsx`.
- Referral: `src/routes/_authenticated/(ats)/sourcing/referrals.tsx`.
- WhatsApp Ads: `src/routes/_authenticated/settings.wa-ads.tsx`.
- Widget embed: `src/routes/_authenticated/settings.widget.tsx`.
- SCIM: `src/routes/_authenticated/settings.scim.tsx` (URL exposta a IdP externo).
- Reuniões: `src/components/meetings/start-video-button.tsx`, `meeting-dialog.tsx`, `meeting-detail-drawer.tsx`.
- Convites: `src/routes/_authenticated/settings.teams.tsx`, `src/routes/_authenticated/admin.workspaces.tsx`, `admin.workspaces.$id.tsx` (parâmetro `redirect_origin`).

### 3. Fallbacks do servidor unificados

Trocar todo fallback `"https://wktechnology.lovable.app"` / `"https://ats.wktechnology.com.br"` por `"https://app.wktechnology.com.br"`, preservando `process.env.PUBLIC_APP_URL` como override:

- `src/lib/quotes.functions.ts` (checkout success/cancel).
- `src/lib/invoices.functions.ts`.
- `src/lib/email-tracking.server.ts` e `src/lib/email-broadcast/engine.server.ts`.
- `src/lib/whatsapp.functions.ts`, `src/lib/whatsapp-send.server.ts`, `src/routes/api/public/hooks/whatsapp-campaign-tick.ts`.
- `src/lib/prospecting-campaigns.functions.ts`.
- `src/lib/ats/interviews.functions.ts`.
- `src/lib/teams.functions.ts` e `src/lib/platform-admin.functions.ts` (`CANONICAL_APP_URL`).
- `src/routes/api/public/email/click.$messageId.ts` (`FALLBACK`).
- Rótulos exibidos em `src/routes/_authenticated/settings.zapier.tsx`, `settings.whatsapp.tsx`, `settings.payments.tsx` (webhook URLs mostradas ao usuário).

### 4. NÃO alterar (dependem do host atual do navegador)

Estes usam `window.location.origin` intencionalmente por causa de allowlist OAuth / postMessage / pareamento de dispositivo:

- `src/routes/login.tsx`, `src/routes/reset-password.tsx`.
- `src/routes/_authenticated/settings.email.tsx`, `settings.calendars.tsx` (Google OAuth message origin).
- `src/routes/api/public/oauth/google-callback.ts`.
- `src/routes/_authenticated/auth/extension-link.tsx` e `src/components/ats/hunting/pairing-status-panel.tsx`.
- `src/routes/quote.$token.tsx` (chamada de PDF a partir da própria página pública — já roda no host público).

## Validação

- Manual no preview: gerar/copiar link em cada superfície acima → todos devem apontar para `https://app.wktechnology.com.br/...`.
- Manual em produção (`app.wktechnology.com.br`, `crm.…`, `ats.…`): links continuam no host atual.
- OAuth Google (e-mail e calendário), reset de senha, login social, pareamento de extensão → continuam funcionando no preview.
- `bun run typecheck` + `tests/e2e/quotes-smoke.spec.ts` + `tests/e2e/public-smoke.spec.ts`.

## Fora do escopo

- Reenvio de links já entregues com host de preview (usuário pode regenerar/reenviar).
- Meta tags SEO (`og:url`, `canonical`) que hoje apontam para `ats.wktechnology.com.br` — troca separada por afetar SEO/indexação.
- Redirect global de `id-preview--…lovable.app` → domínio canônico.
- Card "Emails recentes" da lateral do negócio.
