## Problema

O sidebar do TechSales (`SIDEBAR_GROUPS` em `src/lib/menu-config.ts`, grupo "Vender") ganhou itens que pertencem a outros módulos:

- **Contratos** (`/contracts`) → TechContracts
- **Serviços** (`/services`) → TechServices
- **Projetos** (`/projects`) → TechProjects
- **Financeiro** (`/finance` + 4 sub-itens) → TechFinance

O `AppSidebar` já seleciona menu por módulo ativo (ATS usa `menu-config-ats.ts`, Workspace usa `menu-config-erp.ts`), mas os 4 módulos novos caem no fallback do CRM — por isso os itens vazam para o TechSales.

## Mudanças

### 1. `src/lib/menu-config.ts`
Remover do grupo "Vender" os 4 itens listados acima (incluindo o submenu de Financeiro). Manter Negócios, Cotações, Produtos, Faturas e Portal do cliente, que continuam sendo funcionalidades de vendas.

### 2. Novos arquivos de menu por módulo
Criar, espelhando o padrão de `menu-config-ats.ts`, contendo apenas rotas do próprio módulo:

- `src/lib/menu-config-contracts.ts` → `CONTRACTS_SIDEBAR_GROUPS`
  - Contratos (`/contracts`), Aprovações (se houver rota), Modelos.
- `src/lib/menu-config-services.ts` → `SERVICES_SIDEBAR_GROUPS`
  - Serviços (`/services`), Produtos (`/settings/products`).
- `src/lib/menu-config-projects.ts` → `PROJECTS_SIDEBAR_GROUPS`
  - Projetos (`/projects`), Tarefas (`/tasks` se aplicável ao módulo).
- `src/lib/menu-config-finance.ts` → `FINANCE_SIDEBAR_GROUPS`
  - Financeiro (`/finance`), A receber, A pagar, Categorias, Contas bancárias, Faturas.

Só migro rotas que já existem hoje; não invento novas telas.

### 3. `src/components/app-sidebar.tsx`
Estender o seletor `groupsSource` para cobrir os 4 módulos novos via `effectiveModuleId`:

```ts
const groupsSource = workspaceShell
  ? ERP_SIDEBAR_GROUPS
  : effectiveModuleId === "ats" ? ATS_SIDEBAR_GROUPS
  : effectiveModuleId === "contracts" ? CONTRACTS_SIDEBAR_GROUPS
  : effectiveModuleId === "services" ? SERVICES_SIDEBAR_GROUPS
  : effectiveModuleId === "projects" ? PROJECTS_SIDEBAR_GROUPS
  : effectiveModuleId === "finance" ? FINANCE_SIDEBAR_GROUPS
  : SIDEBAR_GROUPS;
```

### 4. Testes
`src/lib/menu-config.test.ts` importa `SIDEBAR_GROUPS`. Ajusto/removo asserts que dependem dos 4 itens migrados, se houver.

## Fora do escopo

- Criar telas novas para os módulos migrados.
- Alterar rotas, permissões, RLS ou lógica de negócio.
- Mexer no `home`, no `module-switcher` ou no registry (já corretos).

## Validação manual

- Navegar em `/deals`, `/contacts`, etc. (TechSales) → sidebar sem Contratos/Serviços/Projetos/Financeiro.
- Trocar de módulo pelo switcher para Contratos → sidebar mostra apenas itens de contratos.
- Idem para Serviços, Projetos e Financeiro.
- Ir ao ATS → sidebar ATS intocado.
- Ir a `/home` → shell ERP intocado.
