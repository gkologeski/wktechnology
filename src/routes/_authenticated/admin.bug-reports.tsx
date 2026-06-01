// Painel super-admin: caixa de entrada dos chamados internos (bug reports).
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  ShieldAlert,
  Bug,
  Video,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bug-reports")({
  component: BugReportsAdminPage,
});

const STATUS_LABEL: Record<BugReportStatus, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  wont_fix: "Não será corrigido",
};

const STATUS_VARIANT: Record<BugReportStatus, "default" | "secondary" | "outline" | "destructive"> = {
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
  return BUG_CATEGORIES.find((c) => c.value === cat)?.subtypes.find((s) => s.value === value)?.label ?? value;
}
function kindLabel(value: string) {
  return BUG_KINDS.find((k) => k.value === value)?.label ?? value;
}

function BugReportsAdminPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const listFn = useServerFn(listBugReports);
  const updateFn = useServerFn(updateBugReportStatus);
  const deleteFn = useServerFn(deleteBugReport);
  const recUrlFn = useServerFn(getBugReportRecordingUrl);
  const qc = useQueryClient();

  const [status, setStatus] = useState<BugReportStatus | "all">("open");
  const [kind, setKind] = useState<"new_feature" | "existing_broken" | "all">("all");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const list = useQuery({
    queryKey: ["admin-bug-reports", status, kind],
    enabled: isPlatformAdmin,
    queryFn: () => listFn({ data: { status, kind } }),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: BugReportStatus }) => updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-bug-reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Chamado removido");
      qc.invalidateQueries({ queryKey: ["admin-bug-reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

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

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({counts.all ?? 0})</SelectItem>
              {BUG_REPORT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {BUG_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                          {catLabel(r.category as string)} · {subLabel(r.category as string, r.subtype as string)}
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
                        onValueChange={(v) => update.mutate({ id: r.id as string, status: v as BugReportStatus })}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BUG_REPORT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Excluir este chamado?")) remove.mutate(r.id as string);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{r.description as string}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {r.recording_path && (
                      <Button variant="secondary" size="sm" onClick={() => openVideo(r.recording_path as string)}>
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
                    <p className="text-[10px] text-muted-foreground truncate">{r.user_agent as string}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={videoOpen} onOpenChange={(o) => { setVideoOpen(o); if (!o) setVideoUrl(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gravação do chamado</DialogTitle>
            <DialogDescription>O link expira em 1 hora.</DialogDescription>
          </DialogHeader>
          {videoUrl && (
            <video src={videoUrl} controls autoPlay className="w-full rounded border bg-black" />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVideoOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
