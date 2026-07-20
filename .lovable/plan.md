## Problema

No sidebar "Cadastros" (grupo Core global), o item **Produtos** aponta para `/catalog/products`. Hoje essa rota faz `redirect({ to: "/settings/products" })` (ver `src/routes/_authenticated/catalog.products.tsx`), o que:

- ativa o layout `_authenticated/settings.tsx` (shell "Configurações" com aside próprio);
- muda o contexto visual — o usuário sai do módulo em que estava (TechSales, TechContracts, etc.) e "cai" em Configurações.

Empresas (`/companies`) e Contatos (`/contacts`) já funcionam como entidades globais: são rotas de primeiro nível, herdam apenas o layout autenticado padrão e preservam o sidebar do módulo ativo. Produtos deve seguir esse mesmo padrão.

## Objetivo

Ao clicar em **Produtos** no grupo "Cadastros", o usuário permanece no módulo atual (sidebar do módulo intacto) e vê o CRUD de produtos — igual ao comportamento de Empresas.

Sem alterar CRUD, schema, RLS ou permissões.

## Abordagem

1. **Trocar o redirect por render real em `/catalog/products`.**
   `src/routes/_authenticated/catalog.products.tsx` deixa de fazer `redirect` e passa a renderizar o componente compartilhado `ProductsPage` (`src/components/products/products-page.tsx`) — mesmo padrão já usado em `/services/products` e `/settings/products`.

2. **Manter `/settings/products` intacto.** Continua acessível pelo menu de Configurações (Estrutura CRM) para admins que gerenciam catálogo via Configurações. Nenhuma mudança nesse arquivo.

3. **Nenhuma mudança no menu.** `CORE_SIDEBAR_GROUPS` já aponta Produtos para `/catalog/products` — só precisamos que essa URL passe a renderizar a página no layout autenticado padrão (sem shell de Configurações).

## Fora do escopo

- Alterar `ProductsPage`, CRUD, schema, RLS, permissões.
- Remover a entrada de Produtos em `/settings` (mantida como acesso alternativo).
- Mexer em `/services/products` (continua funcionando).

## Validação manual

1. Estar em qualquer módulo (ex.: TechSales em `/deals`). Sidebar mostra grupo "Cadastros" com **Produtos**.
2. Clicar em **Produtos** → URL vira `/catalog/products`, sidebar do módulo permanece, conteúdo é o CRUD de produtos (sem shell de Configurações).
3. Repetir a partir de TechContracts, TechServices, TechProjects, TechFinance — em todos, o módulo ativo é preservado.
4. Acessar `/settings/products` diretamente → shell de Configurações continua funcionando.
5. `/services/products` continua funcionando com sidebar do módulo Serviços.
