import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { PROVIDERS, CATEGORY_LABELS } from "@/lib/integrations/registry";
import { listIntegrations } from "@/lib/integrations/core.functions";

export function IntegrationsCatalog() {
  const list = useServerFn(listIntegrations);
  const { data } = useQuery({
    queryKey: ["integrations", "list"],
    queryFn: () => list({}),
  });
  const connected = new Map((data?.items ?? []).map((i) => [i.provider, i.status]));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = Array.from(new Set(PROVIDERS.map((p) => p.category)));
    return cats;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROVIDERS.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });
  }, [search, category]);

  const groups = filtered.reduce<Record<string, typeof PROVIDERS>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Marketplace de integrações"
        description="Conecte o CRM com ferramentas externas: mensageria, e-mail, vendas, pagamentos e mais."
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar integração…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={category === "all" ? "default" : "outline"}
            onClick={() => setCategory("all")}
          >
            Todas
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groups).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma integração encontrada para esses filtros.
          </p>
        )}
        {Object.entries(groups).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => {
                const status = connected.get(p.slug);
                const cardInner = (
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-md ${p.color} grid place-items-center text-white shrink-0`}
                    >
                      <p.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        {status === "connected" && <Badge variant="default">Conectado</Badge>}
                        {status === "pending" && <Badge variant="secondary">Pendente</Badge>}
                        {status === "error" && <Badge variant="destructive">Erro</Badge>}
                        {!status && p.comingSoon && <Badge variant="outline">Em breve</Badge>}
                        {!status && !p.comingSoon && <Badge variant="outline">Disponível</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                  </div>
                );
                const className =
                  "group rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition";
                if (p.href) {
                  return (
                    <Link key={p.slug} to={p.href} className={className}>
                      {cardInner}
                    </Link>
                  );
                }
                return (
                  <Link
                    key={p.slug}
                    to="/settings/integrations/$slug"
                    params={{ slug: p.slug }}
                    className={className}
                  >
                    {cardInner}
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
