## Problemas

1. **Menu "…" não funciona** — em `AssocItemActions` usei `hidden group-hover:flex`. Quando o usuário clica em "…", o cursor sai do card (vai para o portal do dropdown), o `:hover` do card é perdido, o trigger volta para `display:none` e o Radix fecha o menu instantaneamente.
2. **"Olho" demora muito** — está como `<a href="/contacts/...">`, o que dispara navegação full-reload. O nome usa `<Link>` do TanStack Router e navega client-side, por isso é instantâneo.

## Fix (apenas `src/components/record/associations-panel.tsx`)

**`AssocItemActions`:**
- Trocar `hidden group-hover:flex` por **sempre montado** com `opacity-0 group-hover:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity`. O wrapper recebe `data-state` derivado do `DropdownMenu` (via prop controlada `open`/`onOpenChange`) para manter as ações visíveis enquanto o menu estiver aberto. Assim o trigger não é desmontado e o `:hover` perdido não fecha o menu.
- Aceitar `to` (rota TanStack) + `params` em vez de `href` string, e renderizar o ícone do olho com `<Link>` do `@tanstack/react-router` para navegação client-side. Item "Abrir registro" do dropdown também vira `<Link>`.

**Call sites (`CompanyCard`, `ContactsCard`, `SingleContactCard`):**
- Passar `to="/companies/$id"` / `to="/contacts/$id"` + `params={{ id }}` para `AssocItemActions` em vez de `href={`/contacts/${id}`}`.

## Fora do escopo

- Demais cards (Deals, Tickets, Tasks, Emails, Attachments) — não usam `AssocItemActions`.
- Lógica de unlink / fetch — intocada.

## Validação

- Clicar "…" abre o menu e ele permanece aberto até o usuário clicar fora ou em um item.
- Clicar "Remover associação" desvincula como antes.
- Clicar no ícone de olho navega tão rápido quanto clicar no nome (sem reload).
