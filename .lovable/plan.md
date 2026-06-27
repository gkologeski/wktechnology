## Diagnóstico

Você está em `crm.wktechnology.com.br` e clica em **TechHire** no ModuleSwitcher. O fluxo atual é:

1. `ModuleSwitcher` → `buildModuleUrl("ats", "/jobs")` → `https://ats.wktechnology.com.br/jobs` → `window.location.assign(...)`.
2. Browser carrega `ats.wktechnology.com.br`.
3. `HostRouterGuard` roda em cada navegação. Em algum momento decide voltar pro `crm.*` (provavelmente porque a rota efetiva renderizada após hidratação não bate com `moduleFromPath="ats"` — ex.: redirect interno do `_authenticated`, sidebar empurrando `/dashboard`, ou a sessão Supabase não está válida no subdomínio `ats.*` e algo dispara fallback de host).
4. De volta em `crm.*`, se o path continuar sendo ATS (`/jobs`, `/hunting/...`), o `HostRouterGuard` redireciona pra `ats.*` de novo → **loop**.

Sem console aberto não dá pra cravar qual é a etapa 3, então o plano combina **proteção contra loop** + **instrumentação** + **revisão dos pontos prováveis**.

## Escopo

Somente arquivos relacionados ao roteamento por host. Sem mexer em RLS, schema, server functions, autenticação ou regras de negócio.

## Plano

### 1. Proteção contra loop no `HostRouterGuard`

`src/components/host-router-guard.tsx`:

- Antes de fazer `window.location.replace(...)`, gravar em `sessionStorage` um contador `techhire:host-redirects` com timestamp.
- Se houver **≥2 redirects em <5s**, abortar o próximo redirect, logar `console.warn` com origem/destino/path e exibir um `toast` informando "Loop de host detectado — mantendo neste domínio".
- Limpar o contador após 10s sem novo redirect.

Isso garante que, mesmo se a causa raiz vazar, o usuário não fica preso.

### 2. Confirmar que o host alvo está realmente configurado

Hoje `MODULE_HOSTS` é estático. Se `ats.wktechnology.com.br` não estiver com SSL/DNS prontos no projeto, o `assign` leva pra uma página que pode redirecionar de volta.

- Em `src/lib/hosts.ts`, adicionar `getReachableHosts()` que lê de uma lista expostas via `import.meta.env.VITE_REACHABLE_HOSTS` (CSV) com fallback pra `PRODUCTION_HOSTS`.
- `ModuleSwitcher.handleSelect`: se o host alvo **não** estiver na lista de alcançáveis, fazer SPA navigation (`navigate({ to: defaultRoute })`) em vez de `window.location.assign`. Sem variável definida, comportamento atual é preservado.
- `HostRouterGuard`: idem — só redirecionar se o alvo estiver alcançável.

### 3. Revisão dos pontos suspeitos (sem alterar comportamento se não for o culpado)

Auditar em modo somente-leitura:

- `src/routes/_authenticated/route.tsx` (gate gerenciado) — confirmar que não força navegação cross-host quando a sessão não existe no novo subdomínio.
- `src/components/app-sidebar.tsx` — confirmar que o menu não dispara `navigate({to})` em `useEffect` baseado em host/módulo ativo logo após o mount.
- `src/routes/index.tsx` — já é host-aware, ok.
- `useActiveModule` — confirmar que, com `host=ats` e `path=/dashboard` (caso o sidebar mande pra lá), o switcher não interpreta como CRM e dispare nova navegação.

Se alguma dessas causar o loop, anotar no relatório final e propor correção (sem aplicar fora do escopo desta entrega).

### 4. Instrumentação opcional

Atrás de `localStorage.setItem("techhire:debug-host","1")`:

- `HostRouterGuard` faz `console.info("[host-guard]", {from, to, path, reason})` em cada redirect.
- Facilita reproduzir e mandar evidência se a proteção precisar ser ajustada.

## Arquivos previstos

- editar: `src/components/host-router-guard.tsx`
- editar: `src/lib/hosts.ts`
- editar: `src/components/module-switcher.tsx`
- ler (sem editar): `src/routes/_authenticated/route.tsx`, `src/components/app-sidebar.tsx`

## Validação

- `bun run typecheck` e `bun run build`.
- Em preview lovable.app (não-produção), guard fica inerte → comportamento idêntico ao atual.
- Em produção: simular o clique CRM→TechHire e confirmar que o loop é interrompido após a 2ª oscilação, com toast e log.

## Risco / pendência

- A proteção é defensiva: para de sangrar, mas não cura a causa raiz se ela vier do gate de auth do subdomínio ou de uma `<Link>` cross-host no sidebar. Se a investigação da etapa 3 apontar a causa, abrirei follow-up.
- A flag `VITE_REACHABLE_HOSTS` é opcional; se você não definir, o switcher continua tentando o host configurado (igual hoje).

## Próximo passo recomendado (sem implementar agora)

Após aplicar a proteção, reproduzir uma vez com `localStorage.setItem("techhire:debug-host","1")` aberto e me mandar a sequência de `[host-guard]` do console — com isso identifico e removo a causa raiz no próximo turno.
