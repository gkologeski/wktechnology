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
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
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
  user_resolution_confirmed?: boolean | null;
  user_resolution_feedback?: string | null;
  user_resolution_at?: string | null;
};

type EditState = {
  id: string;
  kind: string;
  category: string;
  subtype: string;
  description: string;
} | null;

type ReopenState = { id: string; feedback: string; previous: string | null } | null;

function MyBugReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [edit, setEdit] = useState<EditState>(null);
  const [reopen, setReopen] = useState<ReopenState>(null);

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

  const confirmResolvedMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bug_reports")
        .update({
          user_resolution_confirmed: true,
          user_resolution_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obrigado pelo retorno!");
      qc.invalidateQueries({ queryKey: ["my-bug-reports", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar"),
  });

  const reopenMut = useMutation({
    mutationFn: async (payload: { id: string; feedback: string; previous: string | null }) => {
      const stamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const entry = `[${stamp}] ${payload.feedback}`;
      const merged =
        payload.previous && payload.previous.trim().length > 0
          ? `${entry}\n\n---\n\n${payload.previous}`
          : entry;
      const { error } = await supabase
        .from("bug_reports")
        .update({
          user_resolution_confirmed: false,
          user_resolution_feedback: merged,
          user_resolution_at: new Date().toISOString(),
          status: "open",
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado reaberto. Iremos analisar novamente.");
      setReopen(null);
      qc.invalidateQueries({ queryKey: ["my-bug-reports", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reabrir"),
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
                  <HtmlContent html={r.description} className="text-sm" />
                  {r.status === "resolved" && r.resolution_text && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          O status do seu chamado foi atualizado para <strong>Resolvido</strong>.
                        </p>
                        <div>
                          <strong>Resolução:</strong>
                          <HtmlContent html={r.resolution_text} />
                        </div>
                      </div>
                      {r.user_resolution_confirmed === true ? (
                        <p className="flex items-center gap-2 text-xs text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Você confirmou que o chamado foi resolvido.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                          <p className="text-xs font-medium mr-2">O problema foi resolvido?</p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmResolvedMut.isPending}
                            onClick={() => confirmResolvedMut.mutate(r.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" /> Sim, resolvido
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setReopen({
                                id: r.id,
                                feedback: "",
                                previous: r.user_resolution_feedback ?? null,
                              })
                            }
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" /> Não, ainda persiste
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {r.user_resolution_confirmed === false &&
                    r.user_resolution_feedback &&
                    r.status !== "resolved" && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Você reabriu este chamado informando:
                        </p>
                        <HtmlContent html={r.user_resolution_feedback} />
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
                <RichHtmlEditor
                  value={edit.description}
                  onChange={(html) => setEdit({ ...edit, description: html })}
                  minHeight={160}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {htmlToPlain(edit.description).length}/4000
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
                if (htmlToPlain(edit.description).trim().length < 10) {
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

      <Dialog
        open={!!reopen}
        onOpenChange={(o) => {
          if (!o) setReopen(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>O problema ainda persiste</DialogTitle>
            <DialogDescription>
              Conte com detalhes o que ainda está acontecendo. O chamado será reaberto e nossa
              equipe analisará novamente.
            </DialogDescription>
          </DialogHeader>
          {reopen && (
            <div className="space-y-3">
              {reopen.previous && reopen.previous.trim().length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs max-h-40 overflow-auto">
                  <p className="font-medium text-muted-foreground mb-1">Histórico anterior</p>
                  <p className="whitespace-pre-wrap">{reopen.previous}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>O que está acontecendo agora?</Label>
                <RichHtmlEditor
                  value={reopen.feedback}
                  onChange={(html) => setReopen({ ...reopen, feedback: html })}
                  minHeight={160}
                  placeholder="Descreva o passo a passo, o que esperava e o que aconteceu…"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {htmlToPlain(reopen.feedback).length}/4000
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReopen(null)} disabled={reopenMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!reopen) return;
                if (reopen.feedback.trim().length < 10) {
                  toast.error("Descreva com pelo menos 10 caracteres");
                  return;
                }
                reopenMut.mutate({
                  id: reopen.id,
                  feedback: reopen.feedback.trim(),
                  previous: reopen.previous,
                });
              }}
              disabled={reopenMut.isPending}
            >
              Reabrir chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
