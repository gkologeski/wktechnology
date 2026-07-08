## Diagnóstico

**1. "Contato principal" mostrando todos os dados como hash**
Em `src/components/workflows/extra-fields-editor.tsx` (FK_KIND, l.227-238), `primary_contact_id` está mapeado como `"company"` (com comentário `// fallback lookup`). Como contatos não existem em `companies`, nada resolve — o rótulo cai em "Carregando…" ou hash. A entidade `contacts` existe (id, first_name, last_name, email) e precisa de tratamento próprio.

**2. Um responsável ainda aparece como hash**
`labelForUser` (`use-reference-labels.ts` l.179-189) enfileira o ID via `enqueue("user", id)` e `searchUsers({ ids })` busca `profiles.full_name` + fallback `auth.users.email`. Quando ambos falham (perfil ausente / lookup admin falhando silenciosamente / usuário deletado), o resultado grava `${id.slice(0,8)}…` no cache e nunca mais tenta. Precisamos garantir fallback melhor (nunca gravar hash como nome resolvido — deixar em branco para tentar de novo) e devolver `null`/marcador especial para o UI mostrar "Usuário removido".

**3. Empresa: campo de busca sobrepondo o texto do valor selecionado**
O `PopoverContent` do `FkPicker` usa `w-[--radix-popover-trigger-width]` (largura só do botão do combobox, sem incluir o TokenInput ao lado) e sem `sideOffset` explícito. Quando o Radix escolhe `side="top"` (visto no session replay: `data-side="top"`), o `CommandInput` encosta visualmente no botão do combobox, criando a sensação de sobreposição do texto selecionado. Precisamos garantir largura mínima confortável e um `sideOffset` real.

---

## Alterações propostas

### A) Suportar FK do tipo contato

**`src/lib/workflow-refs.functions.ts`** — nova server function `searchContacts({ q?, ids? })`:
- Autenticada (`requireSupabaseAuth`), respeita RLS.
- Projeta `id, first_name, last_name, email`; retorna `{ id, name }` onde `name = "First Last" || email || null`.
- Busca livre: `.or("first_name.ilike.%q%,last_name.ilike.%q%,email.ilike.%q%")` com `LIMIT=50`, ordenado por `last_name, first_name`.
- Hidratação por `ids`: `.in("id", ids)`.

**`src/components/workflows/extra-fields-editor.tsx`**:
- Adicionar `"contact"` ao tipo de `FkPicker` e ao `FK_KIND`:
  - `primary_contact_id: "contact"`, `contact_id: "contact"`.
- Estender a `useQuery` interna do FkPicker para chamar `searchContacts` quando `kind === "contact"`.
- Estender `currentLabel` para usar `labels.labelForContact(value)`.

**`src/components/workflows/use-reference-labels.ts`**:
- Adicionar cache/enqueue para `"contact"` (mesma estrutura já usada para company/pipeline/user).
- Adicionar `labelForContact(id)` que resolve por demanda via `searchContacts({ ids })`.

### B) Endurecer o fallback de usuário

**`src/lib/workflow-refs.functions.ts`** (`searchUsers`, l.163-166):
- Trocar `name = nameById || emailById || `${id.slice(0,8)}…`` por `name = nameById || emailById || ""` (string vazia).
- Quando `name === ""`, retornar `{ id, name: "", is_member }`.

**`src/components/workflows/use-reference-labels.ts`** (`labelForUser`):
- Quando `resolved === ""` (server respondeu sem nome), retornar rótulo **"Usuário removido"** — nunca hash. Não reenfileirar.
- Quando `resolved` ainda não existe (não requisitado), continuar mostrando `LOADING_LABEL`.

Isso deixa claro pro usuário que o ID salvo aponta pra um usuário sem perfil (deletado / fora do workspace / sem e-mail acessível), em vez de mostrar hash silenciosamente.

### C) Corrigir overlap visual do combobox de Empresa (e demais FKs)

**`src/components/workflows/extra-fields-editor.tsx`** (PopoverContent do FkPicker, l.338):
- Ajustar para `className="w-[min(360px,90vw)] min-w-[--radix-popover-trigger-width] p-0"` e adicionar `sideOffset={6}`.
- Isto garante largura mínima ≥ trigger, largura preferida de 360px, e espaçamento suficiente pro CommandInput não encostar no botão quando abrir "para cima".

---

## Fora do escopo

- Alterações em RLS de `contacts`/`companies`/`profiles`.
- Redesign do FkPicker ou do TokenInput.
- Mudança em `listWorkspaceMembers` (`rotation.functions.ts`) — o fallback de e-mail já existente permanece.
- Adicionar outros tipos de FK (deals, tickets, leads) no picker — só o que aparece nos formulários hoje.

## Validação

- `bunx tsgo --noEmit`.
- Verificação manual no workflow builder: abrir `create_activity`/`create_deal`, selecionar campo `primary_contact_id`, buscar por nome de contato, confirmar rótulo salvo; abrir "Responsável" e confirmar rótulo (nome, e-mail ou "Usuário removido"); abrir combobox de Empresa e confirmar que o CommandInput não encosta no botão selecionado.

## Arquivos afetados

- Editado: `src/lib/workflow-refs.functions.ts` (nova `searchContacts` + ajuste `searchUsers`).
- Editado: `src/components/workflows/extra-fields-editor.tsx` (kind `contact`, `sideOffset`, largura do popover).
- Editado: `src/components/workflows/use-reference-labels.ts` (cache/enqueue `contact`, `labelForContact`, política "Usuário removido").
