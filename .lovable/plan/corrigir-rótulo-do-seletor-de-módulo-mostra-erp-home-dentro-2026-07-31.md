# Corrigir rótulo do seletor de módulo (mostra "ERP Home" dentro do TechSales)

## O que está acontecendo

Ao escolher TechSales, a aplicação realmente troca de módulo (sidebar, menu e breadcrumb ficam corretos), mas o botão do seletor continua exibindo "ERP Home" com o ícone de casa.

Causa confirmada na leitura do código:

- `src/components/module-switcher.tsx` decide o rótulo por `isWorkspaceContext = isWorkspaceRoute(pathname) || !pathModule`.
- `detectModuleFromPath` (em `src/lib/modules/active-module.ts`) só reconhece prefixos de ATS, Contratos, Projetos, Financeiro e Pessoas. O CRM/TechSales **não tem prefixos cadastrados**.
- Logo, em rotas do TechSales (`/prospecting`, `/dashboard`, `/leads`, `/companies`, `/contacts`, ...) `pathModule` é `null`, o seletor entende "contexto workspace" e escreve "ERP Home", mesmo com o módulo ativo sendo `crm`.
- O sidebar não sofre disso porque usa `isWorkspacePathname` de `src/lib/menu-config-erp.ts`, que lista apenas rotas realmente neutras (`/home`, `/settings`, `/admin`, ...).

## O que será feito

1. Alinhar o seletor à mesma fonte de verdade do sidebar: usar `isWorkspacePathname` de `@/lib/menu-config-erp` em vez da lista local `WORKSPACE_ROUTE_PREFIXES` duplicada dentro de `module-switcher.tsx` (a lista local inclui `/integrations`, então esse prefixo será preservado na avaliação para não mudar comportamento nessa rota).
2. Trocar a regra do rótulo: o botão passa a mostrar "ERP Home" apenas quando a rota atual é neutra de workspace. Fora dessas rotas, mostra o nome do módulo ativo (`useActiveModule`), independentemente de o path ter prefixo mapeado.
3. Aplicar a mesma regra ao check de item selecionado no popover, para que TechSales apareça marcado quando está ativo.
4. Manter `handleSelect` funcionando como hoje (persistir preferência + navegar para a rota padrão do módulo), inclusive o caso de sair do ERP Home para o módulo já ativo.

## Detalhes técnicos

- Arquivo alterado: `src/components/module-switcher.tsx` (apenas apresentação/derivação de estado).
- `isWorkspaceContext` deixa de considerar `!pathModule`; passa a ser somente "a rota é neutra do workspace".
- `activeDef` continua vindo de `MODULE_LIST` + `useActiveModule()`, que já resolve path → preferência salva → `crm`.
- Nenhuma mudança em RLS, schema, server functions, registro de módulos ou regras de navegação.

## Validação

- `tsgo --noEmit`.
- Verificação manual: em `/prospecting` o seletor deve exibir "TechSales"; em `/ats-dashboard`, "TechHire"; em `/home`, `/settings` e `/admin`, "ERP Home".
