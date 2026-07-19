## Problema

No sidebar do módulo **Serviços** (`SERVICES_SIDEBAR_GROUPS` em `src/lib/menu-config-services.ts`), o item **Produtos** aponta para `/settings/products`. Essa rota é filha do layout `src/routes/_authenticated/settings.tsx`, que substitui o conteúdo da página por um shell próprio (aside "Configurações" à esquerda + `<Outlet />`). Resultado: ao clicar em Produtos dentro de Serviços, o usuário sai visualmente do módulo — a tela "recarrega para Configuração".

Além disso, o mesmo item aparece em **Estrutura CRM** dentro de `/settings`, então há duas entradas competindo.

## Objetivo

Ao clicar em **Produtos** no sidebar de Serviços, o usuário deve permanecer no módulo Serviços (com o sidebar do módulo intacto) e ver o CRUD de produtos. Sem mexer em regra de negócio, RLS ou no CRUD em si.

## Abordagem

Criar uma rota dedicada do módulo Serviços que reaproveita o mesmo componente de página de `/settings/products`, sem passar pelo layout de Configurações. Manter `/settings/products` como está para quem entra pelas Configurações do CRM.

### Passos

1. **Extrair o componente `ProductsPage`** de `src/routes/_authenticated/settings.products.tsx` para um módulo compartilhado (ex.: `src/components/products/products-page.tsx`), exportando-o como componente puro. A rota atual passa a apenas importá-lo e usar como `component`.
   - Sem alterar consultas, mutations, permissões ou UI.

2. **Nova rota `/_authenticated/services.products.tsx`** que também usa `ProductsPage` como componente. Isso já herda o layout autenticado padrão (sidebar do módulo Serviços continua visível, pois o path começa com `/services` e o `detectModuleFromPath` classifica como `services`).

3. **Atualizar o sidebar do módulo Serviços** (`src/lib/menu-config-services.ts`): trocar `url: "/settings/products"` por `url: "/services/products"`.

4. **Deixar `/settings/products` intacto** — continua acessível pelo menu de Configurações (Estrutura CRM), para preservar o fluxo atual de admins que gerenciam o catálogo via Configurações.

## Fora do escopo

- Alterar o CRUD, schema, RLS ou permissões (`need: "manager"`).
- Redesenhar a tela de produtos.
- Remover a entrada em `/settings` (mantida como acesso alternativo via Configurações).

## Validação manual

1. Estar no módulo Serviços (`/services`). Sidebar mostra grupo "Serviços" com item **Produtos**.
2. Clicar em **Produtos** → URL vira `/services/products`, sidebar do módulo Serviços permanece, conteúdo é o CRUD de produtos.
3. Acessar `/settings/products` diretamente → shell de Configurações continua funcionando normalmente.
4. Sem regressão de dark mode, permissões ou CRUD.
