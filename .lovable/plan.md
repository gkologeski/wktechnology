# Esconder globalmente o que o usuário não tem acesso

## Problema (verificado no código)

- `canSee()` em `src/lib/menu-config.ts` libera qualquer item que não declare papel nem permissão: `if (need === undefined) return true`. Ou seja, o menu **falha aberto**.
- Os menus de TechHire, TechContracts, Core (Cadastros) e ERP Home (`menu-config-ats.ts`, `menu-config-contracts.ts`, `menu-config-core.ts`, `menu-config-erp.ts`) não declaram nenhuma permissão — por isso aparecem inteiros para o usuário `teste@`.
- O menu lateral é montado pelo módulo ativo sem verificar acesso ao módulo, então o usuário vê o menu do TechProjects mesmo com "Módulo sem acesso" (print 3).
- Outros pontos de entrada não checam nada: menu Workspace, Configurações, botão "+", busca global, cartões "Abrir módulo" da Home e abas internas (ex.: Prospecção, print 1).

## O que será feito

Decisão adotada: **ocultar** tudo que o usuário não pode acessar (sem cadeado no menu lateral). O cadeado permanece apenas no seletor de módulos e nos cartões de módulo, onde faz sentido mostrar que o módulo existe mas não está liberado.

### 1. Regra de visibilidade "fail-closed"

- `canSee()` passa a exigir declaração explícita: item sem papel e sem permissão só aparece para quem tem acesso ao módulo dono do item; itens de área restrita exigem a permissão declarada.
- Administradores do workspace e admins de plataforma continuam vendo tudo.
- Enquanto as permissões carregam, o menu não pisca itens proibidos (renderiza esqueleto).

### 2. Cobertura de permissões nos menus faltantes

Declarar `permissionAny` em todos os itens de TechHire, TechContracts, Cadastros (Core) e ERP Home, usando as chaves já existentes no catálogo (`techhire.*`, `techcontracts.*`, `techsales.catalog.*`, `system.*`). Nenhuma chave nova é criada sem existir no catálogo; onde faltar chave, o item passa a seguir o acesso ao módulo.

### 3. Menu lateral respeita acesso ao módulo

O menu do módulo só é montado quando o usuário tem acesso àquele módulo. Sem acesso, o menu mostra apenas o que ele realmente pode abrir (nada do módulo bloqueado), evitando a situação do print 3.

### 4. Outros pontos de entrada (todos os selecionados)

- **Menu Workspace, Configurações e botão "+"**: cada item passa pelo mesmo filtro; grupos vazios desaparecem e o botão inteiro só aparece se sobrar alguma ação.
- **Busca global (⌘K) e comandos**: resultados e comandos de navegação filtrados por permissão/módulo.
- **Home / painel de módulos**: cartões de módulos sem acesso ficam esmaecidos com cadeado, sem "Abrir módulo" e sem métricas.
- **Abas internas**: abas sem permissão deixam de ser renderizadas; se nenhuma aba sobrar, a tela nem aparece no menu (como já ocorre em Prospecção).

### 5. Fonte única de decisão

Um único hook de acesso (`useModuleAccess` + permissões granulares) alimenta menu lateral, topo, busca, home, abas e o gate de rota, para não haver divergência entre "vê" e "consegue entrar". O gate de rota continua como última barreira, e o banco (RLS) permanece intocado.

## Detalhes técnicos

- Arquivos previstos: `src/lib/menu-config.ts` (assinatura de `canSee` + módulo dono por item), `menu-config-ats.ts`, `menu-config-contracts.ts`, `menu-config-core.ts`, `menu-config-erp.ts`, `menu-config-projects.ts`, `src/components/app-sidebar.tsx`, `settings-menu.tsx`, `quick-create-menu.tsx`, `workspace-menu.tsx`, `src/components/global-search/*`, painel de módulos da Home e `src/routes/_authenticated.tsx`.
- `menu-config.test.ts` é estendido: um perfil só com `techprojects.*.own` não deve ver nenhum item de outros módulos, nem itens administrativos.
- Sem migração, sem alteração de RLS, schema, autenticação ou regra de negócio. Nenhuma funcionalidade é removida para quem tem permissão.
- Validação: `bun run typecheck`, `bun run lint`, `bun run test` e conferência no navegador autenticado com o usuário `teste@` e com um administrador (para garantir que o admin continua vendo tudo).

## Riscos

- Regra fail-closed pode ocultar itens de usuários cujo papel não tenha nenhuma permissão declarada daquele módulo. Mitigação: admin/gestor irrestrito, testes por papel e checagem manual com um usuário comum antes de publicar.
