## Objetivo
Mostrar de forma clara "onde estou" em cada página, com uma trilha de navegação (breadcrumbs) consistente em todo o app.

## Abordagem
Implementar um único componente `RouteBreadcrumbs` renderizado no layout autenticado (`src/routes/_authenticated.tsx`), logo abaixo do header e acima do `<Outlet />`. Assim **todas** as páginas autenticadas ganham breadcrumbs automaticamente, sem precisar editar cada rota.

A trilha será derivada da URL atual (`useRouterState`) e traduzida para rótulos amigáveis em português usando um mapa central de segmentos. Para rotas de detalhe com `$id` (ex.: `/deals/$id`, `/companies/$id`), o último nível mostrará "Detalhes" como fallback — sem chamadas extras ao backend nesta etapa.

## Estrutura visual
- Faixa fina (`h-10`) com fundo `bg-background/60 backdrop-blur` e borda inferior sutil, alinhada ao mesmo padding do conteúdo (`px-6`).
- Usa o componente já existente `src/components/ui/breadcrumb.tsx` (shadcn) — `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbSeparator`, `BreadcrumbPage`.
- Primeiro item sempre é "Início" com ícone `Home` levando a `/dashboard`.
- Último segmento renderizado como `BreadcrumbPage` (não clicável, destacado).
- Em telas `sm:` mostra a trilha completa; em mobile mostra apenas o último nível + botão "voltar".
- Oculto no `/dashboard` (raiz) para não poluir.

## Mapa de rótulos
Um arquivo novo `src/lib/breadcrumb-labels.ts` exporta:

```ts
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Início",
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
  tasks: "Tarefas",
  tickets: "Chamados",
  proposals: "Propostas",
  invoices: "Faturas",
  meetings: "Reuniões",
  inbox: "Caixa de entrada",
  campaigns: "Campanhas",
  prospecting: "Prospecção",
  analytics: "Analytics",
  reports: "Relatórios",
  dashboards: "Dashboards",
  settings: "Configurações",
  admin: "Admin",
  integrations: "Integrações",
  "quote-templates": "Modelos de orçamento",
  "bug-reports": "Chamados internos",
  // ... demais segmentos das ~110 rotas
};
```

Segmentos não mapeados caem em um `prettify()` (kebab-case → Title Case). Segmentos que parecem ID (`uuid`, números) viram "Detalhes".

## Componente
`src/components/route-breadcrumbs.tsx`:

```text
[ Home ] / Configurações / Modelos de orçamento
```

- Lê `pathname` via `useRouterState`.
- Divide em segmentos, monta os links acumulando o caminho.
- Cada item intermediário é `<BreadcrumbLink asChild><Link to={...}/></BreadcrumbLink>`.
- O último é `<BreadcrumbPage>`.

## Integração
Em `src/routes/_authenticated.tsx`, entre `<header>` e `<main>`:

```tsx
{!blocked && <RouteBreadcrumbs />}
```

Nenhuma alteração nas rotas individuais nem no `PageHeader`.

## Arquivos
- **Criar**: `src/lib/breadcrumb-labels.ts`
- **Criar**: `src/components/route-breadcrumbs.tsx`
- **Editar**: `src/routes/_authenticated.tsx` (renderizar o componente)

## Fora do escopo (sugestões para depois)
- Buscar nomes reais de registros para rotas de detalhe (`/deals/$id` → nome do negócio) — requer loaders/queries por rota.
- Breadcrumbs em rotas públicas (`/login`, landing).
