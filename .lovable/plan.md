## Problema

Em `/marketplace`, clicar em qualquer card não abre o detalhe. A URL muda para `/marketplace/<slug>`, mas a tela continua mostrando a lista (ou fica em branco em alguns casos).

## Causa

`src/routes/_authenticated/marketplace.tsx` é ao mesmo tempo:
- rota pai de `marketplace.$slug.tsx` (arquivo filho `marketplace.$slug.tsx`), e
- componente que renderiza a lista do marketplace.

Como a rota pai tem um filho, ela precisa renderizar `<Outlet />` para o filho aparecer (regra do TanStack Router — ver `tanstack-start`). O componente atual renderiza só a lista e nunca renderiza o `<Outlet />`, então o detalhe nunca é montado. É o mesmo padrão já usado em `integrations.tsx` (layout com Outlet) + `integrations.index.tsx` (lista).

## Correção

Separar layout e página de índice, seguindo a convenção já usada em `integrations`:

1. Renomear `src/routes/_authenticated/marketplace.tsx` → `src/routes/_authenticated/marketplace.index.tsx` (mantém todo o conteúdo atual da lista, apenas trocando o path do `createFileRoute` para `/_authenticated/marketplace/`).
2. Criar novo `src/routes/_authenticated/marketplace.tsx` mínimo, só como layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/_authenticated/marketplace")({
     component: () => <Outlet />,
   });
   ```
3. Não mexer em `marketplace.$slug.tsx` nem em `src/lib/marketplace.functions.ts`.

O `routeTree.gen.ts` é regenerado automaticamente pelo plugin do Vite.

## Escopo

- Apenas 2 arquivos de rota tocados. Sem alteração em server functions, RLS, schema, permissões ou lógica de negócio.
- Sem impacto em outras telas.

## Validação

- `bunx tsgo --noEmit`
- Manual: em `/marketplace`, clicar em um card deve navegar para `/marketplace/<slug>` e renderizar a tela de detalhe (com botões Instalar/Testar/Desinstalar).
- Manual: voltar para `/marketplace` continua mostrando a lista.
