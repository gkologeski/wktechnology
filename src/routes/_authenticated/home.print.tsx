// /home/print — Versão de impressão do dashboard (usada para exportar em PDF via window.print).
// Recebe from/to via search params.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { getHomeDashboard, type HomeDashboardResponse } from "@/lib/home/dashboard.functions";
import { MODULES } from "@/lib/modules/registry";

const Search = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  autoprint: z.union([z.literal("1"), z.literal("0")]).optional(),
});

export const Route = createFileRoute("/_authenticated/home/print")({
  validateSearch: (s) => Search.parse(s),
  component: HomePrintPage,
});

const MODULE_TITLES: Record<string, string> = {
  crm: MODULES.crm.productName,
  ats: MODULES.ats.productName,
  contracts: MODULES.contracts.productName,
  projects: MODULES.projects.productName,
  finance: MODULES.finance.productName,
  people: MODULES.people.productName,
};

function HomePrintPage() {
  const search = Route.useSearch();
  const fetchDashboard = useServerFn(getHomeDashboard);
  const now = new Date();
  const from = search.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = search.to ?? now.toISOString();

  const query = useQuery<HomeDashboardResponse>({
    queryKey: ["home-dashboard-print", from, to],
    queryFn: () => fetchDashboard({ data: { from, to } }),
  });

  useEffect(() => {
    if (query.data && search.autoprint !== "0") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [query.data, search.autoprint]);

  const periodLabel = `${format(new Date(from), "dd/MM/yyyy", { locale: ptBR })} – ${format(new Date(to), "dd/MM/yyyy", { locale: ptBR })}`;

  return (
    <div className="print-root p-8 max-w-4xl mx-auto text-foreground">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">Dashboard TechERP</h1>
        <p className="text-sm text-muted-foreground">Período: {periodLabel}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      </header>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !query.data || query.data.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="space-y-6">
          {query.data.sections.map((s) => (
            <section key={s.moduleId} className="break-inside-avoid">
              <h2 className="text-lg font-semibold mb-3">
                {MODULE_TITLES[s.moduleId] ?? s.moduleId}
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Indicador</th>
                    <th className="text-right py-2 font-medium">Valor</th>
                    <th className="text-right py-2 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {s.kpis.map((k) => (
                    <tr key={k.label} className="border-b last:border-0">
                      <td className="py-2">{k.label}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{k.value}</td>
                      <td className="py-2 text-right text-muted-foreground">{k.hint ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
