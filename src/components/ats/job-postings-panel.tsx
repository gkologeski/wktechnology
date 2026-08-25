import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Send, X, Share2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listJobPostings,
  publishJobToProvider,
  unpublishJobFromProvider,
  syncPostingApplicantsNow,
} from "@/lib/ats/job-postings.functions";
import { listAdaptersByCategory } from "@/lib/ats/adapters/registry";
import { Button } from "@/components/ui/button";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import { cn } from "@/lib/utils";

type ProviderSlug = "linkedin" | "indeed" | "vagas_com";

type Posting = {
  id: string;
  provider: string;
  status: string;
  external_id: string | null;
  external_url: string | null;
  is_mock: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
};

const STATUS_CLS: Record<string, string> = {
  published: "border-status-open/30 bg-status-open/10 text-status-open",
  unpublished: "border-border-default bg-surface-sunken text-text-secondary",
  failed: "border-risk-high/30 bg-risk-high/10 text-risk-high",
  draft: "border-border-default bg-surface-sunken text-text-secondary",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Publicada",
  unpublished: "Despublicada",
  failed: "Falha",
  draft: "Rascunho",
};

export function JobPostingsPanel({ jobId }: { jobId: string }) {
  const list = useServerFn(listJobPostings);
  const publish = useServerFn(publishJobToProvider);
  const unpublish = useServerFn(unpublishJobFromProvider);
  const syncNow = useServerFn(syncPostingApplicantsNow);

  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const providers = listAdaptersByCategory("job_board");

  const reload = useCallback(async () => {
    try {
      const r = await list({ data: { job_id: jobId } });
      setPostings(r.postings as Posting[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobId, list]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byProvider = new Map(postings.map((p) => [p.provider, p]));

  const handlePublish = async (provider: ProviderSlug) => {
    setBusy(provider);
    try {
      await publish({ data: { job_id: jobId, provider } });
      toast.success("Vaga publicada");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleUnpublish = async (postingId: string) => {
    setBusy(postingId);
    try {
      await unpublish({ data: { posting_id: postingId } });
      toast.success("Vaga despublicada");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleSyncApplicants = async (postingId: string) => {
    setBusy(`sync:${postingId}`);
    try {
      const r = await syncNow({ data: { posting_id: postingId } });
      if (r.error) {
        toast.error(`Sync com erros: ${r.error}`);
      } else {
        toast.success(
          `${r.createdApplications} nova(s) candidatura(s) importada(s) · ${r.createdCandidates} candidato(s) criado(s)`,
        );
      }
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <AtsSectionHeader
        title="Distribuição"
        description="Publique a vaga em job boards externos. Provedores em modo mock geram URLs de demonstração até as credenciais reais serem configuradas."
      />

      {loading ? (
        <div className="rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando publicações…
          </div>
        </div>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Nenhum job board disponível"
          description="Configure provedores no roadmap de integrações."
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-3">
          {providers.map((p) => {
            const posting = byProvider.get(p.slug);
            const isBusy =
              busy === p.slug ||
              (posting && (busy === posting.id || busy === `sync:${posting.id}`));
            const isSyncing = posting && busy === `sync:${posting.id}`;
            const canSync =
              p.slug === "linkedin" && posting?.status === "published" && !posting.is_mock;
            const syncMeta = (posting?.metadata ?? {}) as Record<string, unknown>;
            const lastSyncAt = syncMeta.last_applicants_sync_at as string | undefined;
            const syncedCount = Number(syncMeta.applicants_synced_count ?? 0);
            const statusKey = posting?.status ?? "draft";
            return (
              <div
                key={p.slug}
                className="rounded-lg border border-border-subtle bg-surface-2 p-4 shadow-xs flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-text-tertiary mt-0.5">
                      Onda {p.wave} · job board
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-1.5 py-0.5",
                      "text-[11px] font-medium leading-none whitespace-nowrap",
                      STATUS_CLS[statusKey] ?? STATUS_CLS.draft,
                    )}
                  >
                    {STATUS_LABEL[statusKey] ?? statusKey}
                  </span>
                </div>

                {posting?.is_mock && posting.status === "published" && (
                  <div className="text-[11px] text-risk-medium border border-risk-medium/30 bg-risk-medium/10 rounded-md px-2 py-1">
                    Modo mock — sem credenciais reais. URL apenas para demonstração interna.
                  </div>
                )}

                {posting?.last_error && (
                  <div className="text-[11px] text-risk-high border border-risk-high/30 bg-risk-high/10 rounded-md px-2 py-1">
                    {posting.last_error}
                  </div>
                )}

                {canSync && (
                  <div className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1.5 text-[11px] text-text-secondary flex items-center justify-between gap-2">
                    <span className="truncate">
                      {lastSyncAt
                        ? `Última sync: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`
                        : "Aguardando primeira sync (a cada 1h)"}
                      {syncedCount > 0 && ` · ${syncedCount} candidato(s)`}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-text-primary hover:underline disabled:opacity-50 shrink-0"
                      disabled={Boolean(isBusy)}
                      onClick={() => posting && handleSyncApplicants(posting.id)}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden />
                      )}
                      Sincronizar
                    </button>
                  </div>
                )}

                {posting?.external_url && (
                  <a
                    href={posting.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary truncate"
                    title={posting.external_url}
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate font-mono">{posting.external_url}</span>
                  </a>
                )}

                <div className="flex gap-2 mt-auto">
                  {posting?.status === "published" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={Boolean(isBusy)}
                      onClick={() => handleUnpublish(posting.id)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                      )}
                      Despublicar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={Boolean(isBusy)}
                      onClick={() => handlePublish(p.slug as ProviderSlug)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                      )}
                      Publicar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
