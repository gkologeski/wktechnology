## Escopo

Em `/settings/permissions`, dois problemas:

1. **Alinhamento**: na primeira coluna (Recurso / Ação), os dois badges (Ação e Escopo) têm larguras variáveis, então o rótulo textual "vaza" para posições diferentes em cada linha, dando aparência desalinhada.
2. **Sem edição possível**: consultei `public.job_roles` e todos os 10 cargos existentes têm `is_system=true`. A matriz desabilita o checkbox para cargos de sistema (`disabled = r.is_system || toggleMut.isPending`), então nenhum toggle é permitido. Não existe hoje UI para criar cargos customizados nem para duplicar um cargo de sistema, então o usuário fica travado.

## Correções

### 1. Alinhar colunas dentro da célula Recurso/Ação
Em `src/components/access-control/permissions-matrix.tsx`, substituir o `flex items-center gap-2` por um grid com trilhas fixas para os badges, mantendo o rótulo em coluna própria:

```
grid grid-cols-[72px_92px_minmax(0,1fr)] items-center gap-2
```

- Badge de Ação com `w-full justify-center`.
- Badge de Escopo com `w-full justify-center`.
- Rótulo com `truncate`.

Resultado: badges e textos alinhados verticalmente entre linhas.

Ajuste secundário: também aplicar `grid-cols-[minmax(0,1fr)_auto]` ao header do módulo/pesquisa se necessário (verificar no build).

### 2. Permitir edição criando/duplicando cargos
No mesmo componente, adicionar uma barra de ações acima da tabela:

- **Novo cargo**: abre um pequeno dialog (nome, descrição, cor opcional) e cria uma `job_role` custom (`is_system=false`, `owner_id = auth.uid()`, `data_scope='workspace'`).
- **Duplicar**: em cada coluna de cargo de sistema, ícone "copiar" que cria uma cópia editável (nome "<Original> (cópia)", `is_system=false`) e replica as permissões atualmente concedidas via `bulkSetRolePermissions`.
- **Renomear/Excluir** cargos não-sistema (menu de contexto na coluna).

Backend novo em `src/lib/access-control/role-bundle.functions.ts`:
- `createJobRole({ name, description?, color? })`
- `duplicateJobRole({ source_role_id, name? })` — copia permissões concedidas do cargo fonte (usa `getMatrixState` internamente) para o novo bundle.
- `renameJobRole({ role_id, name, description?, color? })` — bloqueia cargos de sistema.
- `deleteJobRole({ role_id })` — bloqueia cargos de sistema e faz cascade seguro (remove `job_role_sets` + `permission_sets` do bundle órfão).

Todas usam `requireSupabaseAuth` e delegam RLS ao Supabase (não usam `supabaseAdmin`). Chamada de `assertRoleEditable` reutilizada onde aplicável.

### 3. Mensagem quando só há cargos de sistema
Se `roles.every(r => r.is_system)`, exibir um banner discreto no topo:

> "Todos os cargos exibidos são padrão do sistema e não podem ser editados. Crie um novo cargo ou duplique um existente para personalizar permissões."

Com botões "Novo cargo" e "Duplicar cargo de sistema".

## Não escopo

- Não alterar catálogo de `permissions`, nem RLS de `job_roles`/`permission_sets` (assumindo policies existentes já permitem inserts do owner — se um insert falhar por RLS na execução, tratamos como issue separada).
- Não alterar comportamento dos cargos de sistema (permanecem read-only e visíveis).
- Nenhuma mudança em `access.functions.ts` além da tipagem, se necessário.

## Validação manual

1. Abrir `/settings/permissions` → colunas Ação/Escopo/Rótulo alinhadas em todas as linhas.
2. Clicar em "Novo cargo" → informar nome → cargo aparece como coluna editável.
3. Marcar/desmarcar permissões → persiste (refresh mantém estado).
4. "Duplicar" cargo Vendedor → nova coluna editável com as mesmas marcações do original.
5. Cargos de sistema seguem com cadeado e checkboxes desabilitados.
