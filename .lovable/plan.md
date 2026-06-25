# Onda 1 — Separação Workspace × Módulos (host, sidebars, hub, header, ativação)

Entrega o "aha moment" da arquitetura proposta: **`app.` = Workspace**, **`ats.` / `crm.` = módulos**. Pura UI + roteamento + leitura de `workspace_modules` (tabela já existe). Sem migração de RBAC — isso fica para a Onda 2.

## Escopo

### 1. Roteamento de host (Etapa 1 dos subdomínios)
- Criar `src/lib/hosts.ts` com:
  - `WORKSPACE_HOST = "app.wktechnology.com.br"`
  - `MODULE_HOSTS = { ats: "ats.wktechnology.com.br", crm: "crm.wktechnology.com.br" }`
  - `getCurrentHostKind()` → `"workspace" | "ats" | "crm" | "preview"`
  - `buildModuleUrl(moduleKey, path)` e `buildWorkspaceUrl(path)` — em `localhost` / preview Lovable, devolvem path relativo (SPA); em produção, devolvem URL absoluta no host correto.
- Guard de host em `_authenticated.tsx`:
  - Se rota é de módulo (`/jobs`, `/candidates`, `/pipelines`…) e host é `crm.` → redireciona para `ats.<path>`.
  - Se rota é `/workspace/*` e host é `ats.`/`crm.` → redireciona para `app./workspace/*`.
  - Em preview/localhost, guard fica inerte (tudo SPA).
- Atualizar `ModuleSwitcher` para usar `buildModuleUrl` (já é SPA em preview, cross-host em prod).

### 2. Limpar sidebars dos módulos (Passo 1)
- Em `src/lib/menu-config.ts` (CRM) e `src/lib/menu-config-ats.ts` (ATS): remover qualquer item de **Workspace/ERP/Billing/Membros/Branding/API Keys/Idioma**.
- Sidebars passam a conter **somente** itens nativos do módulo.

### 3. Criar `/workspace` Hub (Passo 2)
- Nova rota `src/routes/_authenticated/workspace.tsx` (layout com `<Outlet />` + breadcrumbs "Workspace").
- Nova rota `src/routes/_authenticated/workspace.index.tsx` com grid de **7 cards**:
  - Membros → `/workspace/members` (reaproveita tela existente de team)
  - Papéis & Permissões → `/workspace/roles`
  - Billing & Plano → `/workspace/billing` (alias para `/settings/billing` atual)
  - Módulos → `/workspace/modules` (novo, ver passo 5)
  - Branding → `/workspace/branding`
  - API Keys & Webhooks → `/workspace/api-keys`
  - Idioma & Região → `/workspace/locale`
- Cada card mostra ícone, título, descrição curta, status (ex.: "3 membros", "Plano Pro", "2 módulos ativos").
- Reaproveita rotas existentes onde já há tela (alias via redirect ou `Link` direto) — **sem reescrever** billing/team agora.

### 4. Atalho no header (Passo 3)
- Em `_authenticated.tsx`, adicionar `WorkspaceMenu` no header (avatar/logo da empresa, à esquerda do `ModuleSwitcher`):
  - Dropdown com: nome do workspace, "Configurações do Workspace" → `/workspace`, "Billing", "Membros", separador, "Trocar de workspace" (futuro), "Sair".
- Disponível em **todos** os hosts (ATS e CRM) — clicar leva ao `app./workspace` via `buildWorkspaceUrl`.

### 5. Página `/workspace/modules` (Passo 5)
- Nova rota `src/routes/_authenticated/workspace.modules.tsx`.
- Lê `workspace_modules` + `modules` (catálogo) via server function nova `src/lib/workspace/modules.functions.ts` (`listWorkspaceModules`, `toggleModule`).
- Layout: duas seções
  - **Contratados** (cards com toggle ativo/inativo, contador de uso, link "Abrir módulo" → `buildModuleUrl`).
  - **Disponíveis** (cards de upsell com badge "Adicionar ao plano" → CTA para billing).
- Guard de módulo: cada rota de módulo (`ats.functions.ts`, `crm` equivalente) já valida workspace; adicionar checagem `workspace_modules.is_active`. Se inativo, retorna 403 e UI redireciona para `/workspace/modules` com toast "Módulo X não está ativo neste workspace".

## Fora de escopo (próximas ondas)

- **Onda 2 (RBAC por módulo — Passo 4):** migração `user_roles.module_id` nullable, helper `has_module_role`, refator RLS de `ats_*` e CRM para usar o novo helper, UI de "Papéis & Permissões".
- Workspace switcher multi-tenant (trocar entre workspaces).
- Domínio próprio do cliente (`careers.acme.com`) — Enterprise.
- Admin Platform (`admin.wktechnology.com.br`) — host separado.

## Arquivos tocados

**Novos**
- `src/lib/hosts.ts`
- `src/lib/workspace/modules.functions.ts`
- `src/components/workspace-menu.tsx`
- `src/routes/_authenticated/workspace.tsx`
- `src/routes/_authenticated/workspace.index.tsx`
- `src/routes/_authenticated/workspace.modules.tsx`

**Editados**
- `src/routes/_authenticated.tsx` (header + guard de host)
- `src/components/module-switcher.tsx` (usa `buildModuleUrl`)
- `src/lib/menu-config.ts` e `src/lib/menu-config-ats.ts` (remover Workspace)
- `src/lib/registry.ts` (registrar 3 rotas novas)

## Critérios de aceite

1. Em `ats.wktechnology.com.br`, sidebar **não mostra** Workspace/Billing/Membros.
2. Header em qualquer módulo tem avatar → "Configurações do Workspace" que leva a `app./workspace` mantendo sessão.
3. `/workspace` mostra os 7 cards e cada um navega para sua tela (reaproveitando billing/team existentes onde aplicável).
4. `/workspace/modules` lista módulos contratados com toggle e disponíveis com CTA de upsell; toggle persiste em `workspace_modules`.
5. Em preview Lovable / localhost, toda navegação cross-host degrada para SPA (sem quebrar a sessão).
6. Typecheck limpo e `/dashboard` continua rápido.

Confirma que sigo com essa onda?
