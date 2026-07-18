# ERP Core Architecture

## Camadas

- **Core ERP (globais)** — entidades e configurações compartilhadas por todos os módulos: Empresas, Contatos, Produtos, Serviços (catálogo), Usuários/Times, Permissões, Pipelines.
- **Módulos verticais** — TechSales (crm), TechHire (ats), TechContracts (contracts), TechServices (services), TechProjects (projects), TechFinance (finance).

Cada módulo consome o Core e adiciona seu próprio menu, telas e regras de negócio.

## Política de menus laterais

O `AppSidebar` monta o menu de cada módulo como concatenação:

```
CORE_SIDEBAR_GROUPS  →  <MODULE>_SIDEBAR_GROUPS  →  configs escopadas do módulo
```

- `CORE_SIDEBAR_GROUPS` (`src/lib/menu-config-core.ts`) — grupo "Cadastros" com Empresas, Contatos, Produtos e Serviços. É prepend em módulos consumidores (Sales, Contracts, Services, Projects, Finance). ATS tem catálogo próprio (candidatos, vagas) e não recebe esse grupo.
- Menus específicos por módulo vivem em `src/lib/menu-config-<módulo>.ts`.

## Catálogo global (Sprint B)

- `public.products` — produtos (já existe).
- `public.service_catalog` — novo. Catálogo de serviços de TI: categoria, unidade (h/PF/mês), tipo (one-off / recorrente / bolsa de horas / SLA), preço base, custo, imposto, SLA default, competências. É **distinto** de `public.services` (que continua sendo instância operacional de um serviço executado).
- `public.catalog_items` — view UNION que unifica produtos + serviços para pickers.
- Rotas de gestão: `/catalog/products` e `/catalog/services` (Sprint B). `/settings/products` permanece como atalho e redireciona.

## Navegação entre módulos

Regra: **o módulo ativo é a preferência persistida do usuário**, não a URL.

Ordem de resolução em `src/lib/modules/active-module.ts::useActiveModule`:

1. Host de produção com subdomínio explícito (ex.: `ats.wktechnology.com.br`) — vence sempre.
2. `localStorage.activeModule` — preferência do usuário (default após entrar por `/home` ou `ModuleSwitcher`).
3. `detectModuleFromPath(pathname)` — fallback quando não há preferência.
4. Default `crm`.

Consequência: abrir manualmente `/projects/tasks` estando com TechSales ativo **não troca o módulo**. O `AppSidebar` continua exibindo o menu do TechSales e mostra um banner "Você está numa tela do TechProjects" com link para voltar. A troca de módulo é sempre explícita, via `ModuleSwitcher` ou `/home`.

## Configurações: `scope` global vs específico

Regra de decisão: "essa configuração impacta mais de um módulo?"

- **Sim** → tela em `/settings/*` com `scope: "global"` (default). Aparece em qualquer módulo.
- **Não** → tela específica com `scope: "<moduleId>"`. Fica em `/settings/*` (URL preservada) e é exibida apenas quando o módulo dono está ativo.

Metadado `scope` fica em `src/lib/settings-sections.tsx`. O `AppSidebar` pode consultar `getSettingsForScope(moduleId)` para injetar um grupo "Configurações do módulo" — quando faz sentido — sem duplicar URLs.

Governança: toda nova tela de configuração nasce com `scope` explícito.
