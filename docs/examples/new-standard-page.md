# Exemplo — Tela Padrão TechHire

Template de referência para criar uma nova tela seguindo o design system oficial. **Não é uma rota real** — é um esqueleto para copiar e adaptar.

> Use em conjunto com [`../techhire-design-system.md`](../techhire-design-system.md) e [`../new-screen-ux-ui-checklist.md`](../new-screen-ux-ui-checklist.md).

---

## Estrutura recomendada

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Users, TrendingUp, Clock } from "lucide-react";
import {
  PageHeader,
  MetricCard,
  FilterBar,
  EmptyState,
  Skeletons,
  StatusBadge,
  MetaPill,
} from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";

// 1) queryOptions vive fora da rota e é reutilizável
const exampleQuery = () => ({
  queryKey: ["example", "list"],
  queryFn: async () => {
    // chamar server function aqui
    return { items: [] as Array<{ id: string; title: string; status: "open" | "closed" }> };
  },
});

export const Route = createFileRoute("/_authenticated/(module)/example")({
  loader: ({ context }) => context.queryClient.ensureQueryData(exampleQuery()),
  pendingComponent: PagePending,
  errorComponent: PageError,
  component: PageComponent,
});

function PageComponent() {
  const { data } = useSuspenseQuery(exampleQuery());
  const items = data.items;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        eyebrow="Módulo"
        title="Nome da tela"
        description="Frase curta explicando o propósito."
        descriptionLive
        primaryAction={
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Nova ação
          </Button>
        }
      />

      {/* 2) KPIs (opcional) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={items.length} icon={Users} tone="neutral" />
        <MetricCard label="Abertos" value={0} icon={TrendingUp} tone="positive" />
        <MetricCard label="Em risco" value={0} icon={Clock} tone="warning" />
        <MetricCard label="IA sugere ação" value={0} tone="ai" hint="Veja painel" />
      </div>

      {/* 3) Filtros */}
      <FilterBar
        searchPlaceholder="Buscar…"
        onSearchChange={(_q) => {
          /* debounce 300ms aplicado pelo componente consumidor */
        }}
      />

      {/* 4) Conteúdo principal — empty / lista */}
      {items.length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          description="Crie o primeiro registro para começar."
          action={
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nova ação
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-border-default bg-surface-2 p-4 shadow-xs"
            >
              <header className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                <StatusBadge status={item.status === "open" ? "open" : "closed"} />
              </header>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <MetaPill>Meta 1</MetaPill>
                <MetaPill>Meta 2</MetaPill>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// 5) Loading fiel ao layout final
function PagePending() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeletons.PageHeader />
      <Skeletons.MetricsGrid count={4} />
      <Skeletons.Row count={6} />
    </div>
  );
}

// 6) Erro com ação clara
function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      title="Não foi possível carregar"
      description={error.message}
      action={<Button onClick={() => reset()}>Tentar novamente</Button>}
    />
  );
}
```

---

## O que esse template demonstra

1. **PageHeader** com eyebrow, title, description (com `aria-live`) e ação primária única.
2. **MetricCard grid** responsivo com tons semânticos.
3. **FilterBar** para listas.
4. **EmptyState** diferenciado com CTA.
5. **Card grid** usando tokens (`bg-surface-2`, `border-border-default`, `shadow-xs`).
6. **StatusBadge** + **MetaPill** para informações semânticas.
7. **Skeletons fiéis** ao layout final.
8. **Error boundary** com retry acionável.
9. **Loader + useSuspenseQuery** como padrão de fetch (sem `useEffect`).

## O que NÃO fazer

- ❌ Importar Supabase ou server functions dentro de componentes de UI.
- ❌ Usar `text-gray-*`, `bg-white`, `text-white`, `bg-[#...]`.
- ❌ Criar `<Badge>` cru para status semântico.
- ❌ Usar `Carregando…` em vez de skeleton.
- ❌ Esquecer `htmlFor` ↔ `id` em formulários.
- ❌ Usar `h-screen` (usar `h-dvh`).
- ❌ Buscar dados em `useEffect`.
