import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS, CATEGORY_LABELS } from "@/lib/integrations/registry";
import { listIntegrations } from "@/lib/integrations/core.functions";

export const Route = createFileRoute("/_authenticated/integrations/")({
  component: IntegrationsCatalog,
});

function IntegrationsCatalog() {
  const list = useServerFn(listIntegrations);
  const { data } = useQuery({
    queryKey: ["integrations", "list"],
    queryFn: () => list({}),
  });
  const connected = new Map((data?.items ?? []).map((i) => [i.provider, i.status]));

  const groups = PROVIDERS.reduce<Record<string, typeof PROVIDERS>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Conecte o CRM com ferramentas externas para importar, enriquecer e sincronizar dados."
      />
      <div className="space-y-8">
        {Object.entries(groups).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => {
                const status = connected.get(p.slug);
                return (
                  <Link
                    key={p.slug}
                    to="/integrations/$slug"
                    params={{ slug: p.slug }}
                    className="group rounded-lg border bg-card p-4 hover:border-primary/40 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-md ${p.color} grid place-items-center text-white shrink-0`}>
                        <p.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{p.name}</h3>
                          {status === "connected" && <Badge variant="default">Conectado</Badge>}
                          {status === "pending" && <Badge variant="secondary">Pendente</Badge>}
                          {status === "error" && <Badge variant="destructive">Erro</Badge>}
                          {!status && p.comingSoon && <Badge variant="outline">Em breve</Badge>}
                          {!status && !p.comingSoon && <Badge variant="outline">Disponível</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
