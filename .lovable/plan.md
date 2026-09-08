# Acesso por módulo + perfil "Apontamento de Horas" (TechProjects)

## Objetivo

1. Criar um perfil de acesso que só permite **lançar e ver horas** e **lançar e ver tarefas** no TechProjects.
2. Fazer o sistema respeitar globalmente o **acesso por módulo**: quem não tem acesso a um módulo não o vê (ou vê bloqueado) em nenhum lugar.
3. Quem tem só **um** módulo disponível entra direto nele, sem passar pelo painel de módulos.

## Situação atual (verificada)

- O catálogo granular de permissões já existe e é organizado por módulo (`techprojects`, `techsales`, `techhire`, ...), incluindo `techprojects.time_entries.*`, `techprojects.timesheet.*`, `techprojects.tasks.*`, `techprojects.my_work.*`.
- Papéis por usuário vivem em `job_roles` / `user_job_roles`; perfis "estilo HubSpot" vivem em `access_profiles`.
- A única restrição de módulo hoje é **licença do workspace** (`workspace_modules`), lida por `useModuleLicenses`. Não existe restrição de módulo **por usuário/perfil**.
- O troca-módulos, a home de módulos e o gate de rota usam apenas essa licença; o menu lateral filtra itens por permissão, mas não esconde o módulo inteiro.
- O menu de Projetos hoje mostra My Work, Espaços, Projetos, Tarefas, Minhas Horas, Revisão de Horas e Timesheet — parte disso deve ficar invisível para o novo perfil.

## O que será feito

### 1. Acesso a módulo por usuário (regra global)

Um módulo fica disponível para o usuário quando:

- o workspace tem o módulo habilitado (regra atual, preservada), **e**
- o usuário tem ao menos uma permissão de visualização daquele módulo (derivado do catálogo granular), **ou** é administrador do workspace (mantém acesso total).

Isso passa a ser calculado no servidor e exposto por um único hook, usado em todos os pontos de decisão: troca de módulos, painel de módulos da home, menu lateral, banner de módulo cruzado e gate de rota.

Comportamento visual:

- **Troca de módulos e painel de módulos**: módulos sem acesso aparecem esmaecidos com cadeado e não são clicáveis (fica claro que existe, mas não está liberado).
- **Menu lateral e rotas**: módulo sem acesso não aparece e a rota mostra a tela de acesso restrito já existente, com texto adequado ("Você não tem acesso a este módulo").

### 2. Entrada automática no único módulo disponível

Ao entrar no sistema, se o usuário tiver exatamente um módulo disponível, ele é levado direto à tela inicial daquele módulo e a preferência de módulo ativo é fixada nele. O painel de módulos e a home consolidada deixam de ser destino nesse caso, e o troca-módulos não oferece saída para outros módulos.

### 3. Perfil "Apontamento de Horas — TechProjects"

Novo papel de sistema, criado por migração, com apenas:

- `techprojects.time_entries.view.own`, `create.own`, `update.own`
- `techprojects.timesheet.view.own`, `create.own`, `update.own`
- `techprojects.tasks.view.own`, `create.own`, `update.own`
- `techprojects.my_work.view.own`, `create.own`, `update.own`

Sem aprovação, sem exclusão, sem visão de workspace, sem projetos/espaços/marcos, sem nenhum outro módulo. Resultado prático: o usuário vê apenas Minhas Horas, Tarefas e My Work dentro do TechProjects.

### 4. Menu do TechProjects sensível a permissão

Cada item do menu de Projetos passa a declarar as permissões que o habilitam, para que "Revisão de Horas", "Timesheet" de equipe, "Projetos" e "Espaços" desapareçam para esse perfil, sem remover nada para os demais papéis.

## Detalhes técnicos

- **Migração**: cria o papel de sistema e seus vínculos em `job_role_default_permissions` (ou tabela de ligação equivalente já usada por `job_roles`), de forma idempotente. Nenhuma tabela nova, nenhuma coluna removida, nenhuma política RLS afrouxada.
- **Servidor**: nova server function `getMyModuleAccess` em `src/lib/modules/` retornando `{ licensed: string[], allowed: string[], unrestricted: boolean }`, derivando módulos das permissões efetivas (`current_user_permissions_json`) cruzadas com `workspace_modules`. Mapa `ModuleId` ↔ prefixo de permissão (`projects` ↔ `techprojects`, `crm` ↔ `techsales`, `ats` ↔ `techhire`, etc.).
- **Cliente**: `src/hooks/use-module-access.ts` substitui o uso direto de `useModuleLicenses` em `module-switcher.tsx`, `_authenticated.tsx`, painel de módulos e `app-sidebar.tsx`; `use-module-licenses.ts` permanece para billing/licença.
- **Redirecionamento**: aplicado no layout autenticado quando o módulo único é conhecido, usando `setStoredActiveModule` e navegação do TanStack Router.
- **Segurança**: a restrição de módulo é camada de navegação; os dados continuam protegidos por RLS e pelas permissões granulares já existentes — nada é afrouxado no banco.
- **Validação**: `bun run typecheck`, `bun run lint`, `bun run test` e conferência manual com um usuário atribuído ao novo perfil.

## Riscos

- Derivar módulo a partir de permissões pode ocultar um módulo de alguém cujo papel não tenha nenhuma permissão de visualização daquele módulo. Administradores seguem irrestritos, e o comportamento fica visível (cadeado) em vez de silencioso.
