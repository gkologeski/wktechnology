// Multi-posting dashboard — Onda 5 / Slice 5.4.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Globe, ExternalLink, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtsPageHeader, EmptyState, RowSkeleton, MetricCard } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  listAllJobPostings,
  publishJobToProvider,
  unpublishJobFromProvider,
} from "@/lib/ats/job-postings.functions";
import { JobBoardCredentialsBanner } from "@/components/ats/job-board-credentials-banner";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/multi-posting")({
  component: MultiPostingPage,
});

const PROVIDERS = [
  { slug: "linkedin", label: "LinkedIn Jobs" },
  { slug: "indeed", label: "Indeed" },
  { slug: "vagas_com", label: "Vagas.com" },
] as const;

function MultiPostingPage() {
  const qc = useQueryClient();
  const fetcher = useServerFn(listAllJobPostings);
  const publish = useServerFn(publishJobToProvider);
  const unpublish = useServerFn(unpublishJobFromProvider);

  const [provider, setProvider] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const q = useQuery({
    queryKey: ["ats-job-postings-all", provider, status],
    queryFn: () =>
      fetcher({
        data: {
          provider: provider === "all" ? undefined : (provider as never),
          status: status === "all" ? undefined : (status as never),
          limit: 200,
        },
      }),
  });

  const republishMut = useMutation({
    mutationFn: (v: { job_id: string; provider: string }) =>
      publish({ data: { job_id: v.job_id, provider: v.provider as never } }),
    onSuccess: () => {
      toast.success("Publicação atualizada");
      qc.invalidateQueries({ queryKey: ["ats-job-postings-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => unpublish({ data: { posting_id: id } }),
    onSuccess: () => {
      toast.success("Publicação encerrada");
      qc.invalidateQueries({ queryKey: ["ats-job-postings-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Multi-posting"
        description="Distribuição de vagas em job boards externos."
      />

      <JobBoardCredentialsBanner />

      <div className="grid gap-3 sm:grid-cols-3">
        {PROVIDERS.map((p) => {
          const c = q.data?.counts?.[p.slug] ?? { active: 0, mock: 0, failed: 0 };
          return (
            <MetricCard
              key={p.slug}
              label={p.label}
              value={String(c.active)}
              hint={`${c.mock} simuladas · ${c.failed} falhas`}
            />
          );
        })}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos providers</SelectItem>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="published">Publicadas</SelectItem>
              <SelectItem value="unpublished">Encerradas</SelectItem>
              <SelectItem value="failed">Com falha</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : !q.data?.postings.length ? (
        <EmptyState
          icon={Globe}
          title="Nenhuma publicação encontrada"
          description="Publique uma vaga em um job board a partir da página da vaga."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {q.data.postings.map((p) => {
                const job = p.job as { id?: string; title?: string } | null;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/jobs/$id"
                          params={{ id: job?.id ?? p.job_id }}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {job?.title ?? "Vaga"}
                        </Link>
                        <Badge variant="outline" className="text-[10px]">
                          {p.provider}
                        </Badge>
                        <Badge
                          variant={p.status === "published" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {p.status}
                        </Badge>
                        {p.is_mock && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-400 text-amber-600"
                          >
                            simulada
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.last_synced_at
                          ? `Sincronizado ${formatDistanceToNow(new Date(p.last_synced_at), { locale: ptBR, addSuffix: true })}`
                          : "Sem sync"}
                        {p.last_error ? ` · erro: ${p.last_error}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.external_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={p.external_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Abrir
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          republishMut.mutate({
                            job_id: p.job_id,
                            provider: p.provider,
                          })
                        }
                        disabled={republishMut.isPending}
                      >
                        <RotateCw className="mr-1 h-3.5 w-3.5" />
                        Republicar
                      </Button>
                      {p.status === "published" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unpublishMut.mutate(p.id)}
                          disabled={unpublishMut.isPending}
                        >
                          Encerrar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
