import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Play, Pause, X, Plus, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  listEmailBroadcasts,
  getEmailBroadcast,
  createEmailBroadcast,
  scheduleEmailBroadcast,
  setEmailBroadcastStatus,
  deleteEmailBroadcast,
  sendTestEmailBroadcast,
  listSegmentsForBroadcast,
} from "@/lib/email-broadcast.functions";
import { listEmailTemplates } from "@/lib/email-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Textarea } from "@/components/ui/textarea";
import { RichHtmlEditor, htmlToPlain } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/crm";
import { TokenPills } from "@/components/ui/token-pills";
import { CAMPAIGN_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/campaigns/email")({
  component: EmailBroadcastsPage,
});

type Broadcast = {
  id: string;
  name: string;
  subject: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  rate_per_minute: number;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  segment_id: string | null;
  created_at: string;
  last_error: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-700",
  running: "bg-emerald-500/15 text-emerald-700",
  paused: "bg-amber-500/15 text-amber-700",
  completed: "bg-emerald-600/15 text-emerald-800",
  canceled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function EmailBroadcastsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailBroadcasts);
  const segsFn = useServerFn(listSegmentsForBroadcast);
  const tplFn = useServerFn(listEmailTemplates);
  const createFn = useServerFn(createEmailBroadcast);
  const scheduleFn = useServerFn(scheduleEmailBroadcast);
  const statusFn = useServerFn(setEmailBroadcastStatus);
  const delFn = useServerFn(deleteEmailBroadcast);
  const testFn = useServerFn(sendTestEmailBroadcast);

  const { data: items = [] } = useQuery({
    queryKey: ["email-broadcasts"],
    queryFn: () => listFn(),
    refetchInterval: 5000,
  });
  const { data: segments = [] } = useQuery({
    queryKey: ["segments-bcast"],
    queryFn: () => segsFn(),
  });
  const { data: templatesData } = useQuery({
    queryKey: ["templates-bcast"],
    queryFn: () => tplFn(),
  });
  const templates = templatesData?.items ?? [];

  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [segmentId, setSegmentId] = useState<string>("");
  const [ratePerMinute, setRatePerMinute] = useState(30);
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [testTo, setTestTo] = useState("");

  const subjectInserter = useTokenInserter<HTMLInputElement>(() => subject, setSubject);
  const bodyTextInserter = useTokenInserter<HTMLTextAreaElement>(() => bodyText, setBodyText);
  const insertBodyHtmlToken = (token: string) => {
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active && (active as HTMLElement).isContentEditable) {
      try {
        document.execCommand("insertText", false, token);
        return;
      } catch {
        /* fallback */
      }
    }
    setBodyHtml((prev) => (prev ?? "") + token);
  };

  function resetForm() {
    setName("");
    setSubject("");
    setBodyHtml("");
    setBodyText("");
    setSegmentId("");
    setRatePerMinute(30);
    setScheduleType("now");
    setScheduledAt("");
    setTestTo("");
  }

  const createMut = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !subject.trim()) throw new Error("Nome e assunto são obrigatórios");
      if (!segmentId) throw new Error("Selecione uma lista (segmento)");
      const res = await createFn({
        data: {
          name,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          segment_id: segmentId,
          rate_per_minute: ratePerMinute,
        },
      });
      const sched =
        scheduleType === "later" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : new Date().toISOString();
      await scheduleFn({ data: { id: res.id, scheduled_at: sched } });
      return res;
    },
    onSuccess: () => {
      toast.success("Campanha agendada");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["email-broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: async () => {
      if (!testTo) throw new Error("Informe um email para teste");
      await testFn({ data: { subject, body_html: bodyHtml, body_text: bodyText, to: testTo } });
    },
    onSuccess: () => toast.success("Email de teste enviado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = (id: string, status: "paused" | "running" | "canceled") =>
    statusFn({ data: { id, status } }).then(() =>
      qc.invalidateQueries({ queryKey: ["email-broadcasts"] }),
    );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Campanhas de email
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparos em massa a partir de listas dinâmicas, com rate limit e cancelamento por
            destinatário.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova campanha de email</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <Label>Nome interno</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Lista (segmento)</Label>
                {(segments as Array<{ id: string }>).length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Nenhum segmento de leads ou contatos encontrado. Crie uma lista em{" "}
                    <Link to="/settings/segments" className="text-primary underline">
                      Configurações &gt; Listas
                    </Link>{" "}
                    com entidade <strong>Leads</strong> ou <strong>Contatos</strong>.
                  </div>
                ) : (
                  <Select value={segmentId} onValueChange={setSegmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um segmento de leads/contatos" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        segments as Array<{
                          id: string;
                          name: string;
                          entity: string;
                          member_count: number;
                        }>
                      ).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.entity} ({s.member_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Template (opcional)</Label>
                <Select
                  onValueChange={(id) => {
                    const t = (
                      templates as Array<{
                        id: string;
                        subject: string | null;
                        body_html: string | null;
                        body_text: string | null;
                      }>
                    ).find((x) => x.id === id);
                    if (t) {
                      setSubject(t.subject ?? "");
                      setBodyHtml(t.body_html ?? "");
                      setBodyText(t.body_text ?? "");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Carregar a partir de template" />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates as Array<{ id: string; name: string }>).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assunto</Label>
                <Input
                  ref={subjectInserter.ref}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Olá {{first_name}}!"
                />
                <TokenPills
                  className="mt-2"
                  tokens={CAMPAIGN_TOKENS}
                  onInsert={subjectInserter.insert}
                />
              </div>
              <div>
                <Label>Corpo HTML</Label>
                <RichHtmlEditor
                  value={bodyHtml}
                  onChange={(html) => {
                    setBodyHtml(html);
                    if (!bodyText.trim()) setBodyText(htmlToPlain(html));
                  }}
                  minHeight={220}
                  placeholder="Conteúdo do email…"
                />
                <TokenPills
                  className="mt-2"
                  tokens={CAMPAIGN_TOKENS}
                  onInsert={insertBodyHtmlToken}
                />
              </div>
              <div>
                <Label>Corpo texto (fallback)</Label>
                <Textarea
                  ref={bodyTextInserter.ref}
                  rows={3}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                />
                <TokenPills
                  className="mt-2"
                  tokens={CAMPAIGN_TOKENS}
                  onInsert={bodyTextInserter.insert}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Envios por minuto</Label>
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={ratePerMinute}
                    onChange={(e) => setRatePerMinute(parseInt(e.target.value || "30"))}
                  />
                </div>
                <div>
                  <Label>Agendamento</Label>
                  <Select
                    value={scheduleType}
                    onValueChange={(v) => setScheduleType(v as "now" | "later")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="now">Enviar agora</SelectItem>
                      <SelectItem value="later">Agendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {scheduleType === "later" && (
                <div>
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              )}
              <div className="border-t pt-3">
                <Label>Enviar email de teste</Label>
                <div className="flex gap-2 mt-1">
                  <EmailInput placeholder="voce@exemplo.com" value={testTo} onChange={setTestTo} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testMut.mutate()}
                    disabled={testMut.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Teste
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tokens disponíveis:{" "}
                  {"{{first_name}} {{last_name}} {{full_name}} {{email}} {{company_name}}"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Taxa</TableHead>
              <TableHead>Agendado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items as Broadcast[]).map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  <div>{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.subject}</div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[b.status] ?? ""}>{b.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {b.sent}/{b.total}{" "}
                  {b.failed > 0 && <span className="text-destructive">({b.failed} falhas)</span>}
                </TableCell>
                <TableCell className="text-sm">{b.rate_per_minute}/min</TableCell>
                <TableCell className="text-sm">
                  {b.scheduled_at ? formatDateTime(b.scheduled_at) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(b.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {b.status === "running" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "paused")}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {(b.status === "paused" || b.status === "scheduled") && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "running")}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  {(b.status === "running" ||
                    b.status === "paused" ||
                    b.status === "scheduled") && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "canceled")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {(b.status === "draft" ||
                    b.status === "canceled" ||
                    b.status === "completed" ||
                    b.status === "failed") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (await confirmDialog("Excluir esta campanha?"))
                          delFn({ data: { id: b.id } }).then(() =>
                            qc.invalidateQueries({ queryKey: ["email-broadcasts"] }),
                          );
                      }}
                    >
                      Excluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma campanha criada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <DetailSheet id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function DetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const getFn = useServerFn(getEmailBroadcast);
  const { data } = useQuery({
    queryKey: ["email-broadcast", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
    refetchInterval: id ? 4000 : false,
  });
  const recips = (data?.recipients ?? []) as Array<{
    id: string;
    email: string;
    name: string | null;
    status: string;
    error: string | null;
    sent_at: string | null;
  }>;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Destinatários</SheetTitle>
        </SheetHeader>
        {data?.broadcast?.last_error && (
          <div className="mt-3 rounded-md bg-destructive/10 text-destructive text-sm p-3">
            {data.broadcast.last_error}
          </div>
        )}
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recips.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div>{r.email}</div>
                  {r.name && <div className="text-xs text-muted-foreground">{r.name}</div>}
                  {r.error && <div className="text-xs text-destructive">{r.error}</div>}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === "sent"
                        ? "default"
                        : r.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.sent_at ? formatDateTime(r.sent_at) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SheetContent>
    </Sheet>
  );
}
