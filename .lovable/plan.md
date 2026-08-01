# Copiar permissões de outro papel em /settings/permissions

Adicionar, no menu de ações (⋮) de cada papel editável da matriz de permissões, a opção **"Copiar de..."**, que lista os demais papéis existentes e copia as permissões em massa.

## Comportamento

1. No cabeçalho de cada coluna de papel **não-sistema**, o menu ganha um submenu "Copiar de..." com a lista dos outros papéis (inclusive papéis do sistema como origem).
2. Ao escolher a origem, abre um diálogo de confirmação com:
   - **Modo**: "Substituir tudo" (espelha a origem, removendo o que não existe nela) ou "Somar" (mantém o atual e adiciona o da origem).
   - **Abrangência**: "Apenas o módulo atual" (aba visível, ex. TechSales) ou "Todos os módulos".
   - Resumo: nome da origem, nome do destino e quantas permissões serão concedidas/removidas.
3. Confirmação aplica a cópia, mostra toast com a contagem e recarrega a matriz.
4. Papéis do sistema continuam somente leitura: não aparecem como destino (opção desabilitada com o cadeado atual).

## Estados e acessibilidade

- Botão de confirmar com estado de carregamento e desabilitado durante a gravação.
- Erro: toast com a mensagem retornada; matriz permanece intacta.
- Submenu com rótulos acessíveis (`aria-label`) e navegação por teclado (componentes shadcn já usados na tela).
- Sem novos tokens de cor; nada de layout fora do design system.

## Detalhes técnicos

- `src/lib/access-control/role-bundle.functions.ts`: nova server function `copyRolePermissions` com `requireSupabaseAuth`, validação Zod (`source_role_id`, `target_role_id`, `mode: "replace" | "merge"`, `module?: string`) e `assertWorkspaceAdmin` + recusa quando o destino é `is_system`. Reaproveita a leitura já existente de `job_role_sets`/`permission_set_items` para montar as chaves da origem e chama a mesma lógica de `bulkSetRolePermissions` (grant/revoke) para gravar.
  - Filtro por módulo: usa o prefixo do módulo nas chaves do catálogo (`permissions.module`) para restringir o conjunto.
  - Retorna `{ granted: number; revoked: number }`.
- `src/components/access-control/permissions-matrix.tsx`:
  - `DropdownMenuSub`/`DropdownMenuSubTrigger`/`DropdownMenuSubContent` para "Copiar de...".
  - Estado `copyTarget` (papel destino), `copySource`, `copyMode`, `copyScopeAll` + `Dialog` de confirmação com `RadioGroup`/`Select`.
  - `useMutation` chamando `copyRolePermissions` e invalidando `["access"]`.
- Sem alteração de schema, RLS ou regras de negócio.

## Validação

- `bun run build:dev` e typecheck.
- Verificação manual: copiar de um papel do sistema para um papel customizado no modo "Somar" (módulo atual) e no modo "Substituir tudo" (todos os módulos), confirmando os combos de escopo da matriz após o recarregamento.
