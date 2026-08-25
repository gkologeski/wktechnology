// Página pública /careers — lista de vagas publicadas do workspace (resolvido pelo host).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, MapPin, ArrowRight } from "lucide-react";
import { EmptyState, MetaPill, Skeletons } from "@/components/techhire/ui";
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
  const primary = brand?.primary_color ?? undefined;

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex items-center gap-4">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="h-10 w-auto" />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-md"
                style={primary ? { background: primary } : undefined}
              >
                <Briefcase className="h-5 w-5 text-white" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight">{productName}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                {query.isLoading
                  ? "Carregando vagas abertas…"
                  : `${jobs.length} vaga${jobs.length === 1 ? "" : "s"} aberta${jobs.length === 1 ? "" : "s"} no momento.`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {query.isLoading && (
          <div className="space-y-3" aria-busy="true">
            <Skeletons.Row />
            <Skeletons.Row />
            <Skeletons.Row />
          </div>
        )}

        {!query.isLoading && jobs.length === 0 && (
          <EmptyState
            icon={Briefcase}
            title="Nenhuma vaga aberta no momento"
            description="Volte em breve — novas oportunidades aparecem aqui assim que forem publicadas."
          />
        )}

        {!query.isLoading && jobs.length > 0 && (
          <ul className="grid gap-3">
            {jobs.map((j) => (
              <li key={j.id as string}>
                <Link
                  to="/careers/$slug"
                  params={{ slug: (j.slug as string) ?? (j.id as string) }}
                  className="surface-1 group flex items-start justify-between gap-4 rounded-lg border border-border-subtle p-5 transition hover:border-border-strong hover:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 space-y-2">
                    <h2 className="truncate text-base font-semibold text-text-primary transition group-hover:text-primary">
                      {j.title as string}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {j.seniority && <MetaPill>{j.seniority as string}</MetaPill>}
                      {j.employment_type && <MetaPill>{j.employment_type as string}</MetaPill>}
                      {j.remote_mode && <MetaPill>{j.remote_mode as string}</MetaPill>}
                      {j.location && (
                        <MetaPill>
                          <MapPin className="h-3 w-3" aria-hidden />
                          {j.location as string}
                        </MetaPill>
                      )}
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium"
                    style={primary ? { color: primary } : undefined}
                  >
                    Ver vaga
                    <ArrowRight
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-12 border-t border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-text-tertiary">
          Powered by {productName}
        </div>
      </footer>
    </div>
  );
}
