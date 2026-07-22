## Escopo

1. Substituir `/home/access` pela nova matriz `/settings/permissions` (redirect definitivo).
2. Tornar `/settings/permissions` visível no sidebar do ERP e na página `/settings` (grupo "Pessoas & Acesso").
3. Atualizar demais pontos que ainda apontam para `/home/access` (GlobalSearch, atalho da Home, menu-config).

Sem mudanças de banco, RLS, server functions ou lógica de negócio.

## Alterações

### 1. Aposentar `/home/access`
- `src/routes/_authenticated/home.access.tsx`: reduzir a arquivo apenas com `beforeLoad` que faz `redirect({ to: "/settings/permissions", replace: true })`, mesmo padrão já usado em `settings.roles.index.tsx`. Toda a UI antiga (abas Cargos, Pacotes, Matriz, Governance, Atribuições) fica inacessível pela UI — a nova matriz cobre Cargo × Recurso × Ação × Escopo por módulo, que é o caso de uso principal.
- Não deletar o arquivo para não invalidar links salvos/bookmarks; redirect basta.

### 2. Sidebar do ERP (grupo Workspace)
- `src/lib/menu-config-erp.ts`: adicionar item "Permissões" ao grupo `Workspace`, apontando para `/settings/permissions`, com ícone `Shield` (lucide-react). Ordem: acima de "Configurações".

### 3. Página `/settings` (grupo Pessoas & Acesso)
- `src/routes/_authenticated/settings.tsx`: no grupo "Pessoas & Acesso", substituir o item atual `{ to: "/home/access", label: "Controle de Acesso", icon: Shield, need: "admin" }` por `{ to: "/settings/permissions", label: "Permissões", icon: Shield, need: "admin" }`. Manter "Política de acesso".

### 4. Menu principal e atalhos legados
- `src/lib/menu-config.ts` (linha ~230): mesma troca — `/home/access` → `/settings/permissions`, label "Permissões".
- `src/components/global-search/commands.ts` (linha 38): comando `nav-access` passa a apontar para `/settings/permissions`, label "Permissões", keywords mantidas.
- `src/routes/_authenticated/home.index.tsx` (SHORTCUTS, linha ~198): atalho "Controle de Acesso" passa a apontar para `/settings/permissions` e label "Permissões".

### 5. Guarda de rota
- `src/routes/_authenticated.tsx`: `ADMIN_ONLY` já cobre qualquer subrota de `/settings/*` via prefixo? Verificar — hoje lista rotas específicas de settings. Adicionar `"/settings/permissions"` a `ADMIN_ONLY` para preservar o `need: "admin"` do menu.

## Validação manual

1. Acessar `/home/access` → redireciona para `/settings/permissions`.
2. Sidebar do ERP mostra "Permissões" no grupo Workspace e navega para a matriz.
3. `/settings` lista "Permissões" no grupo Pessoas & Acesso; item legado "Controle de Acesso" não aparece mais.
4. Cmd+K → "permissões" / "cargos" / "acesso" abre `/settings/permissions`.
5. Card "Controle de Acesso" da Home leva à nova matriz.
6. Usuário não-admin recebe tela de "Acesso restrito" ao tentar abrir `/settings/permissions`.

## Fora de escopo

- Não excluir server functions/componentes usados só por `/home/access` (pacotes de permissão, governance tabs, atribuições por usuário). Ficam órfãos e podem ser removidos depois se confirmada não-utilização.
- Nenhuma mudança em `permission_sets`, `job_role_sets`, RLS, catálogo de permissões ou UI da própria matriz.
