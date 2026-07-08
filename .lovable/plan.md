## Diagnóstico

**1) Hash aparecendo em "Responsável" (`933274f6-…`)**
`FkPicker` (kind=`user`) monta a lista a partir de `useReferenceLabels().userById`, que vem de `listWorkspaceMembers` (`src/lib/rotation.functions.ts`). Essa função só devolve membros do workspace ativo (via `workspace_members` + fallback legado `team_members`). O usuário `Grasiele Magalhães` **existe em `profiles` com `full_name`** mas não está em `workspace_members` desse workspace — provavelmente foi assignee de algum registro migrado/de outro workspace. Como não está no mapa, `nameFor()` cai no fallback `id.slice(0,8)…` e a UI mostra o hash.

**2) Combobox de Empresa mostra só ~10 nomes e "Citel Software" não aparece**
`use-reference-labels.ts` faz `supabase.from("companies").select("id,name").order("name").limit(2000)`. A base tem **31.924 empresas**. PostgREST corta em `max-rows` (1000 por padrão), então só as ~1000 primeiras chegam ao cliente. O `Command` (cmdk) filtra apenas o que já foi carregado — por isso "Citel Software" (que existe) não aparece na busca. Mesmo problema afeta pipelines/sequências/regras quando o workspace cresce, e degrada a resolução de rótulos (empresas fora dos 1000 primeiros aparecem como `empresa xxxxxxxx…`).

**3) "Citel Software" não é achado na busca**
Verifiquei as policies de `companies`: existe `ws_select_companies` que permite SELECT a qualquer membro do workspace (`workspace_id IN current_user_workspaces()`). Ou seja, **o usuário atual TEM permissão de visualização sobre Citel Software** por RLS — o problema é 100% cliente (limite de 1000 linhas). Uma busca server-side com o próprio cliente autenticado do usuário (que respeita RLS naturalmente) resolve o caso sem alterar policy nenhuma.

---

## Correções (respeitam RLS/permissões existentes — nada de bypass)

### A. Busca server-side com resolução por ID

Novo arquivo `src/lib/workflow-refs.functions.ts` com server functions autenticadas (`requireSupabaseAuth`). Todas usam o `context.supabase` (cliente com o token do usuário) — RLS aplica igualzinho ao que o usuário vê em outras telas. Retorno máximo de 50 itens por chamada.

- `searchCompanies({ q?, ids? }) → [{id,name}]`
  - Se `ids` presente: `.in('id', ids)` para hidratar rótulos de valores já salvos.
  - Se `q` presente: `.ilike('name', %q%).order('name').limit(50)`.
  - Se ambos vazios: retorna primeiras 50 alfabéticas.
- `searchPipelines({ q?, ids? })` — idem em `pipelines`.
- `searchUsers({ q?, ids? })` — resolução mais rica: junta membros correntes do workspace (via `listWorkspaceMembers` interno) e, se `ids` referenciar usuários fora dessa lista, carrega `profiles.full_name` + `auth.users.email` via `supabaseAdmin` **apenas para os IDs recebidos** (não é busca livre — evita vazar diretório completo). Isso resolve especificamente o caso Grasiele (nome real em vez do hash) sem expor lista de outros workspaces.

Como o usuário atual só pode salvar como `Responsável` alguém do próprio workspace, a **lista de sugestões** de `searchUsers({ q })` continua restrita aos membros do workspace (o `supabaseAdmin` é usado só para hidratar IDs pré-existentes).

### B. `FkPicker` (`extra-fields-editor.tsx`) passa a ser assíncrono

- `Command` com `CommandInput` controlado dispara `searchXxx({ q })` via `useQuery` (`queryKey: ['wf-ref-search', kind, q]`, `keepPreviousData`, debounce 200 ms).
- Ao abrir com um `id` já salvo, `useQuery` paralelo chama `searchXxx({ ids: [value] })` para exibir o nome correto — nunca mais hash.
- Estados: `carregando…`, `nenhum resultado`, `erro ao buscar`.
- Mantém o slot lateral para inserir token `{{…}}` como fallback.

### C. `useReferenceLabels` resolve rótulos sob demanda

- Continua pré-carregando membros do workspace e primeiras N empresas/pipelines para uso comum (chips, `describeAction`).
- `labelForCompany` / `labelForUser` / `labelForPipeline`: quando o ID não estiver no cache, enfileiram em um Set e disparam `searchXxx({ ids })` batched; enquanto resolve, mostram `Carregando…`. Resultado é memoizado no `queryClient`.

### D. Ajuste de pré-carregamento

- Reduzir o `limit` de empresas de 2000 para 200 (era enganoso — PostgREST já devolvia só 1000). A lista inicial do popover mostra as 200 primeiras alfabéticas; qualquer busca real cai no server-side.
- Pipelines/sequências/regras normalmente cabem no cap atual; deixar como está.

### E. Fallback amigável quando `full_name` estiver vazio

- Em `listWorkspaceMembers` (`rotation.functions.ts`): se `profiles.full_name` for `NULL`/vazio, buscar `email` em `auth.users` via `supabaseAdmin` e usar `email` como rótulo (em vez de `id.slice(0,8)`). Aplica-se apenas aos IDs já pertencentes ao workspace — sem alargar visibilidade.

---

## Segurança / RLS

- **Nenhuma alteração** em policies, GRANTs, esquema ou lógica de negócio.
- `context.supabase` respeita as policies existentes: `ws_select_companies`, `pipelines`, `profiles` etc. Se o usuário não tiver permissão de visualizar determinada empresa, ela continua invisível — comportamento correto.
- `supabaseAdmin` é usado **exclusivamente** para hidratar rótulos de IDs que o próprio usuário já tem salvos no workflow (não expõe listagem completa).

## Arquivos afetados

- **Novo:** `src/lib/workflow-refs.functions.ts`
- **Editados:** `src/components/workflows/use-reference-labels.ts`, `src/components/workflows/extra-fields-editor.tsx` (apenas `FkPicker`), `src/lib/rotation.functions.ts` (fallback email).

## Validação

- `bunx tsgo --noEmit`.
- Teste manual em `/settings/workflows` → editar workflow → ação "Criar negócio" → **Mais campos**:
  - **Responsável**: confirmar que Grasiele aparece com o nome real (não hash) ao abrir a lista e ao reabrir o workflow salvo.
  - **Empresa**: buscar por "Citel Software" (deve aparecer), "Fundação Matias" (deve continuar aparecendo), rolar até uma empresa começada com "Z" (deve encontrar via busca).
  - **Pipeline**: validar continuidade.
