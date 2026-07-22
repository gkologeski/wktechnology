## Objetivo

No sidebar principal do TechERP, criar um grupo expansível chamado **"Controle de acesso"** que reúna as três telas administrativas de governança do workspace: Membros, Times e Permissões.

## O que será alterado

- `src/lib/menu-config-erp.ts`: substituir o item solitário "Permissões" no grupo `Workspace` por um item pai "Controle de acesso" com três filhos:
  - **Membros** → `/settings/teams`
  - **Times** → `/settings/user-groups`
  - **Permissões** → `/settings/permissions`
- Ícone do grupo pai: `ShieldCheck`.
- Ícones dos filhos: `Users` (Membros), `UsersRound` (Times), `Shield` (Permissões).
- O item pai apontará para `/settings/teams` (primeira tela) e ficará destacado enquanto qualquer filho estiver ativo, usando o comportamento nativo `anyChildActive` do `AppSidebar`.

## Fora do escopo

- Nenhuma alteração em rotas, páginas, RLS, RBAC ou fluxos de dados.
- O submenu interno `/settings` (`menu-config.ts`) permanece inalterado.

## Validação

- `bun run build:dev` para verificar tipagem e imports.
- Verificação visual no preview: sidebar do TechERP exibe "Controle de acesso" expansível; navegar entre Membros, Times e Permissões mantém o pai destacado.