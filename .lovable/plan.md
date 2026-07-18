## Objetivo

Fazer com que Contratos, Serviços, Projetos e Financeiro apareçam no seletor de módulos (topo) e no grid de módulos da `/home`, com o botão **Entrar** navegando corretamente para a rota inicial de cada um — em vez de dar refresh.

## Causa raiz

- `public.modules` tem 6 registros (`crm`, `ats`, `contracts`, `services`, `projects`, `finance`), mas o registry do front (`src/lib/modules/registry.ts`) só declara `crm` e `ats`.
- `ModuleSwitcher` lê `MODULE_LIST` → não mostra os novos.
- `/home` gate `canEnter = m.id === "crm" || "ats"` → novos módulos caem em "Configurar"; e mesmo se caísse em "Entrar", `openModule` faria `MODULES[id]?.defaultRoute ?? "/"` → `/` redireciona para `/home` → refresh.
- `MODULE_ICONS` mapeia só `briefcase`/`users`; os ícones novos (`FileText`, `DollarSign`, `Kanban`, `Package`) caem no fallback `Boxes`.

## O que será feito

### 1. Registry de módulos (`src/lib/modules/registry.ts`)

- Estender o tipo `ModuleId` para incluir `"contracts" | "services" | "projects" | "finance"`.
- Adicionar 4 entradas em `MODULES`, cada uma com `productName`, `defaultColor`, `icon`, `defaultRoute` e `menu` mínimo (fallback do switcher).
- `defaultRoute` de cada um:
  - `contracts` → `/contracts`
  - `services` → `/services`
  - `projects` → `/projects`
  - `finance` → `/finance` (rota `finance.index.tsx` já existe)

### 2. Hosts (`src/lib/hosts.ts`)

- Como ainda não há subdomínio próprio (`contracts.wktechnology…`, etc.), configurar `MODULE_HOSTS` dos 4 novos módulos apontando para o mesmo host do CRM (`crm.wktechnology.com.br`). Assim `buildModuleUrl` devolve URL do CRM em produção e SPA relativo em preview — sem quebrar cross-host.
- Alternativa considerada: deixar `MODULE_HOSTS` só com CRM/ATS e fazer `buildModuleUrl` degradar para path relativo quando o módulo não tem host próprio. Escolho a alternativa mais simples (apontar para host do CRM) para não mexer na assinatura tipada de `MODULE_HOSTS`.

### 3. Detecção de módulo ativo (`src/lib/modules/active-module.ts`)

- Adicionar em `detectModuleFromPath` os prefixes `/contracts`, `/services`, `/projects`, `/finance` retornando o `ModuleId` correspondente. Assim, ao entrar em `/contracts` o `ModuleSwitcher` mostra "TechContracts" ativo e o breadcrumb/topo reflete o contexto.
- Não adicionar host matchers agora (sem subdomínio próprio ainda).

### 4. Grid da `/home` (`src/routes/_authenticated/home.index.tsx`)

- Ampliar `MODULE_ICONS` com `FileText`, `DollarSign`, `Kanban`, `Package` (mapa case-insensitive, alinhado à coluna `icon` da tabela).
- Trocar o gate `canEnter` de allowlist hardcoded (`"crm" || "ats"`) para: `m.enabled && MODULES[m.id as ModuleId] !== undefined`. Assim qualquer módulo registrado passa a ter botão **Entrar** funcional; módulos ainda não registrados continuam com "Configurar".

### 5. Bug de refresh — `openModule`

- Depois dos passos 1–2, `MODULES[moduleId].defaultRoute` deixa de retornar `undefined` para os novos, e `buildModuleUrl` devolve caminho válido → `window.location.assign` navega para `/contracts` etc. sem cair em `/`.
- Preservar o fallback `?? "/"` porém acrescentar um `console.warn` para expor futuras regressões (id em `public.modules` sem registry).

### 6. Menu lateral (TechSales)

- Confirmar que Contratos, Serviços, Projetos e Financeiro continuam listados no sidebar do TechSales (fonte: `src/lib/menu-config.ts`). Se algum estiver ausente, apenas garantir o link — sem redesign nem mudança de rota.

### 7. Testes manuais (checklist rápido no final)

- `/home` mostra os 6 módulos com ícone e status corretos.
- Cada card "Ativo" tem botão **Entrar** que navega para a rota default sem loop.
- `ModuleSwitcher` no topo lista os 6 módulos e destaca o ativo quando o path bate.
- Em rotas de workspace (`/home`, `/settings`), o rótulo do switcher continua sendo "ERP Home".

## Fora do escopo (agora)

- Subdomínios próprios (`contracts.…`, `finance.…`, etc.) e menu/shell dedicados por módulo — os 4 novos continuam usando o shell do TechSales.
- Alterar RLS, tabelas, `workspace_modules`, planos/entitlements.
- Redesign visual dos cards da `/home` ou do switcher.
- Onboarding/marketplace flow dos módulos novos.

## Arquivos que serão tocados

- `src/lib/modules/registry.ts` — estender `ModuleId` e `MODULES`.
- `src/lib/modules/active-module.ts` — novos prefixes em `detectModuleFromPath`.
- `src/lib/hosts.ts` — `MODULE_HOSTS` com 4 novas entradas (apontando pro host do CRM).
- `src/routes/_authenticated/home.index.tsx` — `MODULE_ICONS` ampliado, novo `canEnter`, `openModule` com warn.

## Riscos

- Cross-host redirect indevido: mitigado porque em preview `buildModuleUrl` já degrada para path relativo, e em produção os 4 novos apontam para o mesmo host do CRM (nunca sai da app).
- Detecção de módulo ativo em rotas ambíguas: `/finance` é único; conflitos com rotas ATS (`/jobs`, `/candidates`) não existem porque os prefixes ATS continuam prioritários pela ordem do array.

## Como validar

1. Recarregar `/home` — 6 cards visíveis, ícones distintos, status "Ativo/Disponível/Não contratado".
2. Clicar **Entrar** em Contratos → deve abrir `/contracts` sem refresh.
3. Repetir para Serviços, Projetos, Financeiro.
4. Abrir o `ModuleSwitcher` do topo em `/home` — 6 opções listadas.
5. Navegar até `/contracts` e reabrir o switcher — o item ativo deve ser "TechContracts".