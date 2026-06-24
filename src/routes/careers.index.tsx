// Página pública /careers — lista de vagas publicadas do workspace (resolvido pelo host).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPublicJobs } from "@/lib/ats/public.functions";

export const Route = createFileRoute("/careers/")({
  head: () => ({
    meta: [
      { title: "Vagas abertas — Careers" },
      { name: "description", content: "Conheça as vagas abertas e candidate-se." },
    ],
  }),
  component: CareersIndex,
});

function CareersIndex() {
  const fetcher = useServerFn(listPublicJobs);
  const host = typeof window !== "undefined" ? window.location.host : null;
  const query = useQuery({
    queryKey: ["public-jobs", host],
    queryFn: () => fetcher({ data: { host } }),
  });

  const data = query.data;
  const jobs = data?.jobs ?? [];
  const brand = data?.branding;
  const productName = brand?.product_name ?? "Trabalhe conosco";
  const primary = brand?.primary_color ?? "#7c3aed";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-center gap-4">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="h-10 w-auto" />
            ) : (
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center"
                style={{ background: primary }}
              >
                <Briefcase className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{productName}</h1>
              <p className="text-sm text-muted-foreground">
                {jobs.length} vaga{jobs.length === 1 ? "" : "s"} aberta
                {jobs.length === 1 ? "" : "s"} no momento.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {query.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando vagas…</p>
        )}
        {!query.isLoading && jobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma vaga aberta no momento. Volte em breve!
            </CardContent>
          </Card>
        )}
        <div className="grid gap-3">
          {jobs.map((j) => (
            <Link
              key={j.id as string}
              to="/careers/$slug"
              params={{ slug: (j.slug as string) ?? (j.id as string) }}
              className="block group"
            >
              <Card className="transition hover:border-primary/60">
                <CardContent className="py-5 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold text-lg group-hover:text-primary transition">
                      {j.title as string}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {j.seniority && <Badge variant="outline">{j.seniority as string}</Badge>}
                      {j.employment_type && (
                        <Badge variant="outline">{j.employment_type as string}</Badge>
                      )}
                      {j.remote_mode && <Badge variant="outline">{j.remote_mode as string}</Badge>}
                      {j.location && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {j.location as string}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: primary }}
                  >
                    Ver vaga →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t mt-12">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          Powered by {productName}
        </div>
      </footer>
    </div>
  );
}
