import { getPublicAppUrl } from "@/lib/app-url";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Plus, Trash2, Pencil, Eye, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  listBookingPages,
  upsertBookingPage,
  deleteBookingPage,
  listBookings,
  cancelBooking,
} from "@/lib/booking.functions";
import { listCalendarAccounts } from "@/lib/calendar.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/booking")({
  component: BookingSettings,
});

const WEEKDAYS = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
] as const;

type Win = { start: string; end: string };
type Avail = Partial<Record<(typeof WEEKDAYS)[number]["key"], Win[]>>;

const DEFAULT_AVAIL: Avail = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
};

function BookingSettings() {
  const list = useServerFn(listBookingPages);
  const upsert = useServerFn(upsertBookingPage);
  const del = useServerFn(deleteBookingPage);
  const accountsFn = useServerFn(listCalendarAccounts);
  const qc = useQueryClient();

  const { data: pages = [] } = useQuery({ queryKey: ["booking-pages"], queryFn: () => list() });
  const { data: accountsResp } = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: () => accountsFn(),
  });
  const accounts = (accountsResp && "items" in accountsResp ? accountsResp.items : []) as any[];

  const [editing, setEditing] = useState<any | null>(null);
  const [bookingsForPage, setBookingsForPage] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Página excluída");
      qc.invalidateQueries({ queryKey: ["booking-pages"] });
    },
  });

  function newPage() {
    setEditing({
      slug: "",
      title: "Reunião 30 min",
      description: "",
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 0,
      calendar_account_id: null,
      availability: DEFAULT_AVAIL,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      min_notice_hours: 2,
      max_advance_days: 30,
      active: true,
      target: "lead",
      color: "#6366f1",
      location: "",
    });
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Páginas de agendamento</h1>
          <p className="text-sm text-muted-foreground">
            Crie links públicos para clientes reservarem horários na sua agenda.
          </p>
        </div>
        <Button onClick={newPage}>
          <Plus className="w-4 h-4 mr-1" /> Nova página
        </Button>
      </div>

      <div className="grid gap-3">
        {pages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma página criada ainda.</p>
        )}
        {pages.map((p: any) => {
          const url = `${getPublicAppUrl()}/book/${p.slug}`;
          return (
            <Card key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-2 h-12 rounded" style={{ background: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{p.title}</div>
                  {!p.active && <Badge variant="secondary">Inativa</Badge>}
                  <Badge variant="outline">{p.duration_minutes} min</Badge>
                  <Badge variant="outline">{p.target === "lead" ? "Lead" : "Contato"}</Badge>
                  {!p.calendar_account_id && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                      Sem calendário
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">/book/{p.slug}</div>
                {!p.calendar_account_id && (
                  <p className="text-xs text-destructive mt-1">
                    Sem conta de calendário vinculada: as reservas não geram evento no Google Agenda
                    nem link do Meet.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBookingsForPage(p.id)}>
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (await confirmDialog("Excluir página?")) delMut.mutate(p.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <EditorDialog
          initial={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              await upsert({ data: payload });
              toast.success("Página salva");
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["booking-pages"] });
            } catch (e) {
              toast.error(String((e as Error).message || e));
            }
          }}
        />
      )}

      {bookingsForPage && (
        <BookingsSheet pageId={bookingsForPage} onClose={() => setBookingsForPage(null)} />
      )}
    </div>
  );
}

function EditorDialog({
  initial,
  accounts,
  onClose,
  onSave,
}: {
  initial: any;
  accounts: any[];
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>(initial);
  const upd = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));
  const updAvail = (key: string, wins: Win[]) =>
    setForm((f: any) => ({ ...f, availability: { ...f.availability, [key]: wins } }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Editar página" : "Nova página"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => upd({ title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Slug *</Label>
              <Input
                value={form.slug}
                onChange={(e) =>
                  upd({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                }
                placeholder="reuniao-30min"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <RichHtmlEditor
              value={form.description ?? ""}
              onChange={(html) => upd({ description: html })}
              minHeight={120}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={5}
                max={480}
                value={form.duration_minutes}
                onChange={(e) => upd({ duration_minutes: parseInt(e.target.value || "30", 10) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Buffer antes</Label>
              <Input
                type="number"
                min={0}
                max={240}
                value={form.buffer_before_minutes}
                onChange={(e) =>
                  upd({ buffer_before_minutes: parseInt(e.target.value || "0", 10) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Buffer depois</Label>
              <Input
                type="number"
                min={0}
                max={240}
                value={form.buffer_after_minutes}
                onChange={(e) => upd({ buffer_after_minutes: parseInt(e.target.value || "0", 10) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Antecedência mínima (h)</Label>
              <Input
                type="number"
                min={0}
                max={720}
                value={form.min_notice_hours}
                onChange={(e) => upd({ min_notice_hours: parseInt(e.target.value || "0", 10) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Antecedência máxima (dias)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.max_advance_days}
                onChange={(e) => upd({ max_advance_days: parseInt(e.target.value || "30", 10) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fuso horário</Label>
              <Input value={form.timezone} onChange={(e) => upd({ timezone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Conta de calendário (Google Agenda + Meet)</Label>
              <Select
                value={form.calendar_account_id ?? "none"}
                onValueChange={(v) => upd({ calendar_account_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.calendar_account_id && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-2">
                  <p className="text-xs text-destructive">
                    Sem conta selecionada, as reservas não criam evento no Google Agenda nem link do
                    Google Meet.
                  </p>
                  {accounts.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => upd({ calendar_account_id: accounts[0].id })}
                    >
                      Usar {accounts[0].email}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Conecte uma conta Google em Configurações → Calendário.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Criar como</Label>
              <Select value={form.target} onValueChange={(v) => upd({ target: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="contact">Contato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => upd({ color: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Local / link</Label>
              <Input
                value={form.location ?? ""}
                onChange={(e) => upd({ location: e.target.value })}
                placeholder="Google Meet, sala, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Disponibilidade semanal</Label>
            <div className="space-y-2 border rounded p-3">
              {WEEKDAYS.map((d) => {
                const wins = (form.availability?.[d.key] ?? []) as Win[];
                return (
                  <div key={d.key} className="flex items-start gap-3">
                    <div className="w-12 pt-1 text-sm font-medium">{d.label}</div>
                    <div className="flex-1 space-y-1">
                      {wins.length === 0 && (
                        <div className="text-xs text-muted-foreground py-1">Indisponível</div>
                      )}
                      {wins.map((w, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-28"
                            value={w.start}
                            onChange={(e) => {
                              const next = [...wins];
                              next[i] = { ...w, start: e.target.value };
                              updAvail(d.key, next);
                            }}
                          />
                          <span className="text-xs">até</span>
                          <Input
                            type="time"
                            className="w-28"
                            value={w.end}
                            onChange={(e) => {
                              const next = [...wins];
                              next[i] = { ...w, end: e.target.value };
                              updAvail(d.key, next);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              updAvail(
                                d.key,
                                wins.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updAvail(d.key, [...wins, { start: "09:00", end: "17:00" }])}
                      >
                        + Janela
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-sm font-medium">Ativa</div>
              <div className="text-xs text-muted-foreground">Visível na URL pública.</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => upd({ active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingsSheet({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const list = useServerFn(listBookings);
  const cancel = useServerFn(cancelBooking);
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["bookings", pageId],
    queryFn: () => list({ data: { page_id: pageId } }),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Reservas</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 mt-4">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma reserva ainda.</p>
          )}
          {data.map((b: any) => (
            <Card key={b.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {new Date(b.start_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                  <div className="text-sm">
                    {b.invitee_name} — {b.invitee_email}
                  </div>
                  {b.invitee_phone && (
                    <div className="text-xs text-muted-foreground">{b.invitee_phone}</div>
                  )}
                  {b.notes && <div className="text-xs mt-1 whitespace-pre-wrap">{b.notes}</div>}
                  {b.meet_link && (
                    <a
                      href={b.meet_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline mt-1 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      Link do Google Meet
                    </a>
                  )}
                  {b.calendar_sync_error && (
                    <p className="text-xs text-destructive mt-1 break-words">
                      Falha na sincronização: {b.calendar_sync_error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={b.status === "confirmed" ? "default" : "secondary"}>
                    {b.status}
                  </Badge>
                  {b.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await cancel({ data: { id: b.id } });
                        qc.invalidateQueries({ queryKey: ["bookings", pageId] });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
