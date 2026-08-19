// Painel super-admin: caixa de entrada dos chamados internos (bug reports).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle, type ListViewMode } from "@/components/kanban/view-mode-toggle";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";
import {
  BUG_REPORT_STATUSES,
  deleteBugReport,
  getBugReportRecordingUrl,
  listBugReports,
  updateBugReportStatus,
  type BugReportStatus,
} from "@/lib/bug-reports.functions";
import { analyzeBugReport, listBugReportAnalyses } from "@/lib/bug-report-analysis.functions";
import { BugReportResolutionDialog } from "@/components/bug-report/resolution-dialog";
import { BugReportImages } from "@/components/bug-report/bug-report-images";
import { notifyBugReportStatusChange } from "@/lib/bug-reports-notify.functions";
import { HtmlContent } from "@/components/rich-html-editor";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  ShieldAlert,
  Bug,
  Video,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Loader2,
  Copy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bug-reports")({
  validateSearch: (search: Record<string, unknown>): { view: ListViewMode } => ({
    view: search["view"] === "kanban" ? "kanban" : "table",
  }),
  component: BugReportsAdminPage,
});


const STATUS_LABEL: Record<BugReportStatus, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  wont_fix: "Não será corrigido",
};

const STATUS_VARIANT: Record<BugReportStatus, "default" | "secondary" | "outline" | "destructive"> =
  {
    open: "destructive",
    triaged: "secondary",
    in_progress: "default",
    resolved: "outline",
    wont_fix: "outline",
  };

function catLabel(value: string) {
  return BUG_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
function subLabel(cat: string, value: string) {
  return (
    BUG_CATEGORIES.find((c) => c.value === cat)?.subtypes.find((s) => s.value === value)?.label ??
    value
  );
}
function kindLabel(value: string) {
  return BUG_KINDS.find((k) => k.value === value)?.label ?? value;
}
const KANBAN_TONE: Record<BugReportStatus, string> = {
  open: "bg-destructive",
  triaged: "bg-primary/60",
  in_progress: "bg-primary",
  resolved: "bg-emerald-500",
  wont_fix: "bg-muted-foreground/40",
};

function BugReportsAdminPage() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();

  const listFn = useServerFn(listBugReports);
  const updateFn = useServerFn(updateBugReportStatus);
  const deleteFn = useServerFn(deleteBugReport);
  const recUrlFn = useServerFn(getBugReportRecordingUrl);
  const analyzeFn = useServerFn(analyzeBugReport);
  const listAnalysesFn = useServerFn(listBugReportAnalyses);
  const notifyFn = useServerFn(notifyBugReportStatusChange);
  const qc = useQueryClient();

  const [status, setStatus] = useState<BugReportStatus | "all" | "unresolved">("unresolved");
  const [kind, setKind] = useState<"new_feature" | "existing_broken" | "all">("all");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-bug-reports", status, kind],
    enabled: isPlatformAdmin,
    queryFn: () => listFn({ data: { status, kind } }),
  });

  const allForCounts = useQuery({
    queryKey: ["admin-bug-reports-counts"],
    enabled: isPlatformAdmin,
    queryFn: () => listFn({ data: { status: "all", kind: "all" } }),
  });

  const totals = useMemo(() => {
    const all = (allForCounts.data ?? []) as Array<{ status: string }>;
    let open = 0;
    let closed = 0;
    for (const r of all) {
      if (r.status === "resolved" || r.status === "wont_fix") closed++;
      else open++;
    }
    return { total: all.length, open, closed };
  }, [allForCounts.data]);

  const reportIds = useMemo(
    () => ((list.data ?? []) as Array<{ id: string }>).map((r) => r.id),
    [list.data],
  );

  const analyses = useQuery({
    queryKey: ["admin-bug-report-analyses", reportIds],
    enabled: isPlatformAdmin && reportIds.length > 0,
    queryFn: () => listAnalysesFn({ data: { bug_report_ids: reportIds } }),
  });

  const latestByReport = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of (analyses.data ?? []) as Array<{ bug_report_id: string }>) {
      if (!m.has(a.bug_report_id)) m.set(a.bug_report_id, a);
    }
    return m;
  }, [analyses.data]);

  const update = useMutation({
    mutationFn: async (vars: { id: string; status: BugReportStatus; resolution_text?: string }) => {
      const res = await updateFn({ data: vars });
      try {
        const r = await notifyFn({
          data: {
            bug_report_id: vars.id,
            new_status: vars.status,
            ...(vars.resolution_text ? { resolution_text: vars.resolution_text } : {}),
          },
        });
        if (!r?.ok) {
          toast.warning("Status atualizado, mas a mensagem ao solicitante não pôde ser enviada.");
        }
      } catch {
        toast.warning("Status atualizado, mas a mensagem ao solicitante não pôde ser enviada.");
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-bug-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-bug-reports-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const handleStatusChange = (id: string, newStatus: BugReportStatus) => {
    if (newStatus === "resolved") {
      setResolvingId(id);
      return;
    }
    update.mutate({ id, status: newStatus });
  };

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Chamado removido");
      qc.invalidateQueries({ queryKey: ["admin-bug-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-bug-reports-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  const runAnalyze = async (id: string) => {
    setAnalyzingId(id);
    try {
      await analyzeFn({ data: { bug_report_id: id } });
      toast.success("Análise gerada");
      await qc.invalidateQueries({ queryKey: ["admin-bug-report-analyses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar análise");
    } finally {
      setAnalyzingId(null);
    }
  };

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const openVideo = async (path: string) => {
    try {
      const { url } = await recUrlFn({ data: { path } });
      setVideoUrl(url);
      setVideoOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o vídeo");
    }
  };

  const rows = list.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status as string] = (c[r.status as string] ?? 0) + 1;
    return c;
  }, [rows]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Acesso restrito
            </CardTitle>
            <CardDescription>Esta área é exclusiva do super-admin da plataforma.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Chamados internos"
        description="Reports e sugestões enviados pelos usuários via botão flutuante."
        actions={
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abertos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">{totals.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fechados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-muted-foreground">{totals.closed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unresolved">Não resolvidos</SelectItem>
              <SelectItem value="all">Todos ({counts.all ?? 0})</SelectItem>
              {BUG_REPORT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {BUG_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <ViewModeToggle
            value={sp.view}
            onChange={(v) => navigate({ search: { view: v } })}
          />
        </div>
      </div>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando chamados…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum chamado para os filtros selecionados.
          </CardContent>
        </Card>
      ) : sp.view === "kanban" ? (
        <KanbanBoard
          rows={rows as Array<{ id: string; status: string }>}
          table="bug_reports"
          stageField="status"
          ariaLabel="Quadro de chamados internos"
          columns={BUG_REPORT_STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
            tone: KANBAN_TONE[s],
          }))}
          onMove={async (id, stage) => {
            handleStatusChange(id, stage as BugReportStatus);
          }}
          renderCard={(r) => {
            const row = r as unknown as Record<string, unknown>;
            const created = new Date(row["created_at"] as string);
            const reporter = row["reporter"] as
              | { email?: string | null; full_name?: string | null }
              | null
              | undefined;
            return (
              <div className="space-y-2 pr-6">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {kindLabel(row["kind"] as string)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {catLabel(row["category"] as string)}
                  </Badge>
                </div>
                <HtmlContent
                  html={row["description"] as string}
                  className="line-clamp-3 text-xs text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  {reporter?.email ?? reporter?.full_name ?? "—"} ·{" "}
                  {format(created, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            );
          }}
        />
      ) : (

        <div className="space-y-3">
          {rows.map((r) => {
            const created = new Date(r.created_at as string);
            return (
              <Card key={r.id as string}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[r.status as BugReportStatus] ?? "secondary"}>
                          {STATUS_LABEL[r.status as BugReportStatus] ?? r.status}
                        </Badge>
                        <Badge variant="outline">{kindLabel(r.kind as string)}</Badge>
                        <Badge variant="outline">
                          {catLabel(r.category as string)} ·{" "}
                          {subLabel(r.category as string, r.subtype as string)}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {r.reporter?.email ?? r.reporter?.full_name ?? r.owner_id} ·{" "}
                        {format(created, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={r.status as string}
                        onValueChange={(v) =>
                          handleStatusChange(r.id as string, v as BugReportStatus)
                        }
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUG_REPORT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (await confirmDialog("Excluir este chamado?"))
                            remove.mutate(r.id as string);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <HtmlContent html={r.description as string} className="text-sm" />
                  {r.status === "resolved" &&
                    (r as { resolution_text?: string }).resolution_text && (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          O status deste chamado foi atualizado para <strong>Resolvido</strong>.
                        </p>
                        <div>
                          <strong>Resolução:</strong>
                          <HtmlContent html={(r as { resolution_text?: string }).resolution_text} />
                        </div>
                      </div>
                    )}
                  {Array.isArray((r as { image_paths?: string[] }).image_paths) &&
                    ((r as { image_paths?: string[] }).image_paths?.length ?? 0) > 0 && (
                      <BugReportImages paths={(r as { image_paths: string[] }).image_paths} />
                    )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.recording_path && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openVideo(r.recording_path as string)}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Ver gravação {r.recording_has_audio ? "(com áudio)" : ""}
                      </Button>
                    )}
                    {r.page_url && (
                      <a
                        href={r.page_url as string}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {r.page_url as string}
                      </a>
                    )}
                  </div>
                  {r.user_agent && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.user_agent as string}
                    </p>
                  )}

                  {(() => {
                    const a = latestByReport.get(r.id as string);
                    const isAnalyzing = analyzingId === r.id;
                    return (
                      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Análise por IA
                            {a?.severity && (
                              <Badge
                                variant={
                                  a.severity === "critical" || a.severity === "high"
                                    ? "destructive"
                                    : a.severity === "medium"
                                      ? "default"
                                      : "secondary"
                                }
                              >
                                {a.severity}
                              </Badge>
                            )}
                            {typeof a?.confidence === "number" && (
                              <Badge variant="outline">
                                confiança {Math.round(a.confidence * 100)}%
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isAnalyzing}
                            onClick={() => runAnalyze(r.id as string)}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            {a ? "Reanalisar" : "Analisar com IA"}
                          </Button>
                        </div>

                        {!a && !isAnalyzing && (
                          <p className="text-xs text-muted-foreground">
                            Ainda sem análise. Clique em "Analisar com IA" para gerar resumo, causa
                            provável e proposta de correção.
                          </p>
                        )}

                        {a?.status === "error" && (
                          <p className="text-xs text-destructive">
                            Erro na última análise: {a.error}
                          </p>
                        )}

                        {a?.status === "ok" && (
                          <div className="space-y-2 text-xs">
                            {a.summary && <p className="text-foreground">{a.summary}</p>}
                            {a.suspected_area && (
                              <p>
                                <span className="text-muted-foreground">Área suspeita: </span>
                                <span className="font-medium">{a.suspected_area}</span>
                              </p>
                            )}
                            {Array.isArray(a.suspected_files) && a.suspected_files.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {a.suspected_files.map((f: string) => (
                                  <code
                                    key={f}
                                    className="rounded bg-background border px-1.5 py-0.5 text-[10px]"
                                  >
                                    {f}
                                  </code>
                                ))}
                              </div>
                            )}
                            {a.root_cause && (
                              <details>
                                <summary className="cursor-pointer text-muted-foreground">
                                  Causa provável
                                </summary>
                                <p className="mt-1 whitespace-pre-wrap">{a.root_cause}</p>
                              </details>
                            )}
                            {a.proposed_fix && (
                              <details open>
                                <summary className="cursor-pointer text-muted-foreground">
                                  Proposta de correção
                                </summary>
                                <p className="mt-1 whitespace-pre-wrap">{a.proposed_fix}</p>
                              </details>
                            )}
                            {Array.isArray(a.reproduction_steps) &&
                              a.reproduction_steps.length > 0 && (
                                <details>
                                  <summary className="cursor-pointer text-muted-foreground">
                                    Passos para reproduzir
                                  </summary>
                                  <ol className="mt-1 list-decimal pl-5 space-y-0.5">
                                    {a.reproduction_steps.map((s: string, i: number) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ol>
                                </details>
                              )}
                            {a.lovable_prompt && (
                              <div className="pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyPrompt(a.lovable_prompt)}
                                >
                                  <Copy className="h-3 w-3 mr-2" />
                                  Copiar prompt para o Lovable
                                </Button>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">
                              {a.model} ·{" "}
                              {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={videoOpen}
        onOpenChange={(o) => {
          setVideoOpen(o);
          if (!o) setVideoUrl(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gravação do chamado</DialogTitle>
            <DialogDescription>O link expira em 1 hora.</DialogDescription>
          </DialogHeader>
          {videoUrl && (
            <video src={videoUrl} controls autoPlay className="w-full rounded border bg-black" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVideoOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BugReportResolutionDialog
        open={!!resolvingId}
        onOpenChange={(v) => {
          if (!v) setResolvingId(null);
        }}
        onConfirm={async (text) => {
          if (!resolvingId) return;
          await update.mutateAsync({ id: resolvingId, status: "resolved", resolution_text: text });
          setResolvingId(null);
        }}
      />
    </div>
  );
}
