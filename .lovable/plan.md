## Objetivo

Fazer com que a rota `/` deixe de mandar todo mundo para `/dashboard` (CRM) e passe a respeitar a arquitetura multi-host introduzida na Onda 1:

- `app.wktechnology.com.br` → Workspace Hub (`/workspace`)
- `ats.wktechnology.com.br` → TechHire (`/jobs`)
- `crm.wktechnology.com.br` → TechSales (`/dashboard`)
- Preview / localhost / domínio único → mantém `/dashboard` como antes (não quebra o fluxo de desenvolvimento)

## O que muda

Apenas o arquivo `src/routes/index.tsx`. O resto da aplicação continua igual.

### Lógica nova

1. Ler `window.location.hostname` dentro de `beforeLoad`.
2. Se host = `app.wktechnology.com.br` → `redirect({ to: "/workspace" })`.
3. Se host = `ats.wktechnology.com.br` (ou casar `MODULES.ats.defaultRoute`) → `redirect({ to: "/jobs" })`.
4. Se host = `crm.wktechnology.com.br` → `redirect({ to: "/dashboard" })`.
5. Caso contrário (preview, localhost, qualquer outro host) → manter `redirect({ to: "/dashboard" })`.

Reaproveitar `getHostKind` de `src/lib/hosts.ts` e `MODULES` de `src/lib/modules/registry.ts` em vez de hard-codear paths — assim, quando adicionarmos um terceiro módulo, basta atualizar o registry.

### Comportamento esperado

| Host                          | URL final           |
| ----------------------------- | ------------------- |
| `app.wktechnology.com.br`     | `/workspace`        |
| `ats.wktechnology.com.br`     | `/jobs`             |
| `crm.wktechnology.com.br`     | `/dashboard`        |
| `*.lovable.app` (preview)     | `/dashboard`        |
| `localhost`                   | `/dashboard`        |

Usuário não autenticado continua sendo capturado pelo gate `_authenticated` e mandado para `/auth`.

## Fora de escopo

- Não vou alterar `/dashboard`, `/jobs`, `/workspace` em si.
- Não vou mudar o `defaultRoute` dos módulos no registry.
- Não vou adicionar/remover itens de menu.

## Riscos

- `beforeLoad` roda durante SSR/prerender, onde `window` não existe. Vou proteger com `typeof window === "undefined"` e nesse caso devolver `/dashboard` (mesma rota que hoje, então não há regressão no build).
