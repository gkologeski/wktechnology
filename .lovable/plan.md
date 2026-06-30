# Corrigir bounce TechHire → TechSales nos itens do menu

## Causa raiz

Em **preview/localhost**, `useActiveModule()` (em `src/lib/modules/active-module.ts`) decide o módulo ativo por path:

```
detectModuleFromPath(path) ?? detectModuleFromHost(hostname) ?? "crm"
```

A lista `ATS_PATH_PREFIXES` está **incompleta**. Hoje cobre `/jobs, /candidates, /ats, /pipelines, /scorecards, /interview-kits, /offers, /stage-emails, /match-scores, /fraud-flags, /insights, /dei-analytics, /notetaker, /sourcing, /hunting, /scheduling`.

Mas o menu ATS (`src/lib/menu-config-ats.ts`) tem itens fora dessa lista:
- `/briefing` — Briefing diário
- `/copilot` — Recruiter Copilot
- `/compliance` — LGPD & DSAR
- `/careers` — Site de Carreiras

Ao clicar em qualquer um deles, `detectModuleFromPath` devolve `null`, host é `preview`, e cai no fallback **`"crm"`**. Resultado: o `AppSidebar` troca `groupsSource` para `SIDEBAR_GROUPS` (TechSales), header muda para "TechSales CRM" e o usuário sente que "voltou pro TechSales".

Em produção, o `HostRouterGuard` também só conhece `ATS_PATH_PREFIXES` — então abrir `/briefing` direto em `crm.wktechnology.com.br` (link, refresh, deeplink) não é redirecionado para `ats.*`, e a UI fica em CRM mesmo logado no ATS.

## O que vou fazer

1. **Derivar a lista de prefixos do próprio menu** (single source of truth)
   - Em `src/lib/menu-config-ats.ts`, exportar `ATS_ROUTE_PREFIXES` extraído dos `url` (top-level) de `ATS_SIDEBAR_GROUPS`, incluindo filhos. Adiciona automaticamente novos itens no futuro.
   - Mesclar com a lista mínima atual (`/jobs, /candidates, /ats, ...`) para resiliência.

2. **Atualizar `detectModuleFromPath`**
   - `src/lib/modules/active-module.ts` passa a importar `ATS_ROUTE_PREFIXES` em vez da constante local hardcoded.
   - Tratar prefixo `/careers` como ATS apenas quando o usuário já está num contexto ATS, para não capturar visitantes anônimos do site público — checar se a rota é a admin (`/careers` é externa no menu, `external: true`); manter excluída da detecção e marcar no menu como link externo de host próprio.

3. **Atualizar `HostRouterGuard`**
   - Como ele já usa `detectModuleFromPath`, a correção acima propaga automaticamente: `/briefing` em `crm.*` passa a redirecionar para `ats.*` em produção. Sem mudança extra no guard.

4. **Sidebar: travar `groupsSource` no host quando este é determinístico**
   - Em `src/components/app-sidebar.tsx`, quando `getHostKind(hostname)` for `"ats"` ou `"crm"`, usar esse valor direto para escolher `groupsSource`, ignorando o resultado path-based. Isto evita "flicker" do menu durante navegações entre rotas neutras.
   - Em preview, manter o comportamento atual (path-first) já corrigido pelo item 2.

5. **Itens neutros → Workspace Hub (confirmado pelo usuário)**
   - Auditar o menu ATS por links que apontem para rotas neutras (`/settings`, `/account`, `/admin`, `/workspace`). Hoje não há nenhum nessa categoria no `menu-config-ats.ts`, então nada a alterar aqui.
   - Documentar regra: qualquer item futuro de Settings/Account/Workspace deve usar `buildWorkspaceUrl(...)` (cross-host em prod, SPA em preview), nunca `<Link to>` direto. Adicionar comentário no topo de `menu-config-ats.ts`.

## Validação manual

Em preview (`id-preview--...lovableproject.com`):
- A partir de `/pipelines`, clicar **Briefing diário**, **Recruiter Copilot**, **LGPD & DSAR**, **Notetaker IA**, **Match Scores**, **Insights ATS**, **DEI Analytics**, **Scheduling**, **Sourcing › Inbox**, **Hunting › Capturados**. Em todos, o cabeçalho do sidebar deve continuar **"TechHire ATS"** e o menu lateral continuar mostrando os grupos ATS.
- Buscar no menu deve continuar funcionando.

Em produção (`crm.wktechnology.com.br`):
- Abrir `/briefing` direto e verificar redirect para `ats.wktechnology.com.br/briefing` (com `VITE_REACHABLE_HOSTS` configurado).

## Arquivos a alterar

- `src/lib/menu-config-ats.ts` — exportar `ATS_ROUTE_PREFIXES` + comentário sobre Settings/Account.
- `src/lib/modules/active-module.ts` — consumir `ATS_ROUTE_PREFIXES`.
- `src/components/app-sidebar.tsx` — `groupsSource` host-determinístico em produção.

Nenhuma migration, RLS, server function ou regra de negócio é tocada.
