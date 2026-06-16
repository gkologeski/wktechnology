// Meus chamados — usuário vê os próprios bug reports enviados pelo botão flutuante.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";
import { BugReportImages } from "@/components/bug-report/bug-report-images";
import { Bug, Pencil, Video, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-bug-reports")({
  component: MyBugReportsPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  wont_fix: "Não será corrigido",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  triaged: "secondary",
  in_progress: "default",
  resolved: "outline",
  wont_fix: "outline",
};

const CLOSED_STATUSES = new Set(["resolved", "wont_fix"]);
const ALL_STATUSES = ["open", "triaged", "in_progress", "resolved", "wont_fix"] as const;
type StatusFilter = "all" | "open" | "closed" | (typeof ALL_STATUSES)[number];

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

type BugRow = {
  id: string;
  status: string;
  kind: string;
  category: string;
  subtype: string;
  description: string;
  created_at: string;
  recording_path: string | null;
  resolution_text?: string | null;
  image_paths?: string[] | null;
};

type EditState = {
  id: string;
  kind: string;
  category: string;
  subtype: string;
  description: string;
} | null;

function MyBugReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [edit, setEdit] = useState<EditState>(null);

  const list = useQuery({
    queryKey: ["my-bug-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as BugRow[];
    },
  });

  const rows = list.data ?? [];

  const counts = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const r of rows) {
      if (CLOSED_STATUSES.has(r.status)) closed++;
      else open++;
    }
    return { open, closed, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "open") return rows.filter((r) => !CLOSED_STATUSES.has(r.status));
    if (statusFilter === "closed") return rows.filter((r) => CLOSED_STATUSES.has(r.status));
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const editSubtypes = useMemo(
    () => BUG_CATEGORIES.find((c) => c.value === edit?.category)?.subtypes ?? [],
    [edit?.category],
  );

  const updateMut = useMutation({
    mutationFn: async (payload: NonNullable<EditState>) => {
      const { error } = await supabase
        .from("bug_reports")
        .update({
          kind: payload.kind,
          category: payload.category,
          subtype: payload.subtype,
          description: payload.description,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["my-bug-reports", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });

  const openVideo = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("bug-reports")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      setVideoUrl(data.signedUrl);
      setVideoOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o vídeo");
    }
  };

  const startEdit = (r: BugRow) => {
    setEdit({
      id: r.id,
      kind: r.kind,
      category: r.category,
      subtype: r.subtype,
      description: r.description,
    });
  };

  const canEdit = (r: BugRow) => !CLOSED_STATUSES.has(r.status);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Meus chamados"
        description="Chamados que você abriu pelo botão flutuante de feedback."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abertos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">{counts.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fechados</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-muted-foreground">{counts.closed}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={
            statusFilter === "all" || statusFilter === "open" || statusFilter === "closed"
              ? statusFilter
              : "all"
          }
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">Todos ({counts.total})</TabsTrigger>
            <TabsTrigger value="open">Abertos ({counts.open})</TabsTrigger>
            <TabsTrigger value="closed">Fechados ({counts.closed})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos (não resolvidos)</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {rows.length === 0
              ? "Você ainda não abriu nenhum chamado. Use o botão flutuante no canto inferior direito."
              : "Nenhum chamado corresponde a este filtro."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const created = new Date(r.created_at);
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    <Badge variant="outline">{kindLabel(r.kind)}</Badge>
                    <Badge variant="outline">
                      {catLabel(r.category)} · {subLabel(r.category, r.subtype)}
                    </Badge>
                    <div className="ml-auto">
                      {canEdit(r) ? (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {format(created, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{r.description}</p>
                  {r.status === "resolved" && r.resolution_text && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        O status do seu chamado foi atualizado para <strong>Resolvido</strong>.
                      </p>
                      <p className="whitespace-pre-wrap">
                        <strong>Resolução:</strong> {r.resolution_text}
                      </p>
                    </div>
                  )}
                  {Array.isArray(r.image_paths) && r.image_paths.length > 0 && (
                    <BugReportImages paths={r.image_paths} />
                  )}
                  {r.recording_path && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openVideo(r.recording_path as string)}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Ver minha gravação
                    </Button>
                  )}
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

      <Dialog
        open={!!edit}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar chamado</DialogTitle>
            <DialogDescription>
              Você pode editar enquanto o chamado não estiver fechado.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={edit.kind} onValueChange={(v) => setEdit({ ...edit, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUG_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={edit.category}
                    onValueChange={(v) => setEdit({ ...edit, category: v, subtype: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subtipo</Label>
                  <Select
                    value={edit.subtype}
                    onValueChange={(v) => setEdit({ ...edit, subtype: v })}
                    disabled={!edit.category}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={edit.category ? "Selecione" : "Escolha a categoria"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {editSubtypes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={5}
                  value={edit.description}
                  maxLength={4000}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {edit.description.length}/4000
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)} disabled={updateMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!edit) return;
                if (edit.description.trim().length < 10) {
                  toast.error("Descreva com pelo menos 10 caracteres");
                  return;
                }
                if (!edit.category || !edit.subtype) {
                  toast.error("Selecione categoria e subtipo");
                  return;
                }
                updateMut.mutate(edit);
              }}
              disabled={updateMut.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
