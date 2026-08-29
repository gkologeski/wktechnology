import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, CheckCircle2, AlertCircle, Plug } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listMarketplaceApps } from "@/lib/marketplace.functions";

export function MarketplacePage() {
  const list = useServerFn(listMarketplaceApps);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace", search, category],
    queryFn: () => list({ data: { search: search || undefined, category: category || undefined } }),
  });

  const apps = data?.apps ?? [];
  const categories = Array.from(new Set(apps.map((a) => a.category)));

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Marketplace"
        description="Conecte seu CRM a Slack, Zapier, Make e mais com 1 clique."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar apps…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={!category ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategory(null)}
          >
            Todos
          </Badge>
          {categories.map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory(c)}
            >
              {c}
            </Badge>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {apps.map((a) => {
            const installed = !!a.installation;
            const error = a.installation?.status === "error";
            return (
              <Link key={a.slug} to="/settings/marketplace/$slug" params={{ slug: a.slug }}>
                <Card className="hover:border-primary transition-colors h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-md bg-muted grid place-items-center">
                          <Plug className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium leading-tight">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.vendor}</div>
                        </div>
                      </div>
                      {installed && !error && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Instalado
                        </Badge>
                      )}
                      {error && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" /> Erro
                        </Badge>
                      )}
                      {a.popular && !installed && <Badge>Popular</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {a.short_description}
                    </p>
                    <div className="text-xs text-muted-foreground">{a.category}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
