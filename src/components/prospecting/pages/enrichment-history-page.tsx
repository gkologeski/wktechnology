import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listEnrichmentJobs, listJobItems } from "@/lib/integrations/enrichment.functions";
import { listProspectSearches } from "@/lib/prospecting.functions";
import { formatDateTime } from "@/lib/crm";
import { Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AtsSectionHeader } from "@/components/ats/ui";

type Job = Awaited<ReturnType<typeof listEnrichmentJobs>>["jobs"][number];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  done: "default",
  completed: "default",
  partial: "secondary",
  failed: "destructive",
  running: "outline",
  queued: "outline",
  pending: "outline",
};

export function EnrichmentHistoryPage() {
  const list = useServerFn(listEnrichmentJobs);
  const q = useQuery({
    queryKey: ["enrichment-jobs"],
    queryFn: async () => (await list()).jobs as Job[],
    refetchInterval: 8000,
  });
  const [viewing, setViewing] = useState<Job | null>(null);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeader
          title="Enriquecimento — histórico"
          description="Execuções recentes de enriquecimento (Apollo, Lusha) e seus resultados."
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">OK</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead className="text-right">Créditos</TableHead>
                <TableHead>Iniciado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {q.data && q.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Nenhuma execução ainda.
                  </TableCell>
                </TableRow>
              )}
              {q.data?.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="capitalize">{j.provider}</TableCell>
                  <TableCell>{j.entity === "lead" ? "Leads" : "Contatos"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[j.status] ?? "outline"}>{j.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{j.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.succeeded}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.failed}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.credits_used}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(j.started_at ?? j.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setViewing(j)}
                      title="Ver itens"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <JobItemsSheet job={viewing} onClose={() => setViewing(null)} />
      </div>

      <ProspectSearchHistorySection />
    </div>
  );
}

const SEARCH_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  running: "Executando",
  completed: "Concluída",
  failed: "Falhou",
};

/** Histórico das buscas de prospects (Apollo) executadas no workspace. */
function ProspectSearchHistorySection() {
  const listSearches = useServerFn(listProspectSearches);
  const q = useQuery({
    queryKey: ["prospecting", "searches", "history"],
    queryFn: () => listSearches(),
    refetchInterval: 15000,
  });

  const summarize = (filters: unknown): string => {
    if (!filters || typeof filters !== "object") return "—";
    const entries = Object.entries(filters as Record<string, unknown>)
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null && v !== ""))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    return entries.length ? entries.join(" · ") : "—";
  };

  return (
    <div className="space-y-4">
      <AtsSectionHeader
        title="Buscas de prospects"
        description="Histórico das buscas executadas na base do Apollo.io, com filtros aplicados e resultados."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/prospecting" search={{ tab: "prospecting" as const }}>
              Abrir busca de prospects
            </Link>
          </Button>
        }
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Busca</TableHead>
              <TableHead>Filtros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Resultados</TableHead>
              <TableHead>Executada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {q.data && q.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Nenhuma busca de prospects executada ainda.
                </TableCell>
              </TableRow>
            )}
            {q.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="max-w-md">
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {summarize(s.filters)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                      {SEARCH_STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                    {s.error ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                        {s.error}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.result_count ?? 0}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.ran_at ? formatDateTime(s.ran_at) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function JobItemsSheet({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const list = useServerFn(listJobItems);
  const q = useQuery({
    queryKey: ["enrichment-job-items", job?.id],
    enabled: !!job,
    queryFn: async () => (await list({ data: { jobId: job!.id } })).items,
  });

  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Itens do job</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
          {q.data?.map((it) => (
            <div key={it.id} className="border rounded-md p-3 text-xs">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={
                    it.status === "ok"
                      ? "default"
                      : it.status === "error"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {it.status}
                </Badge>
                <code className="text-muted-foreground">{it.entity_id?.slice(0, 8)}</code>
                <span className="ml-auto text-muted-foreground">
                  {formatDateTime(it.created_at)}
                </span>
              </div>
              {it.error && <div className="text-destructive">{it.error}</div>}
              {it.after && (
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
                  {JSON.stringify(it.after, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
