import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { listCalendarAccounts, pushActivityToCalendar } from "@/lib/calendar.functions";
import { CalendarDays, ExternalLink } from "lucide-react";

type Props = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultAttendee?: string;
  relatedKey: "related_lead_id" | "related_contact_id" | "related_company_id" | "related_deal_id";
  relatedId: string;
  onCreated?: () => void;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingDialog({
  trigger, open: openProp, onOpenChange, defaultAttendee = "",
  relatedKey, relatedId, onCreated,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [attendee, setAttendee] = useState(defaultAttendee);
  const start0 = new Date(Date.now() + 60 * 60 * 1000);
  const end0 = new Date(start0.getTime() + 30 * 60 * 1000);
  const [start, setStart] = useState(toLocalInput(start0));
  const [end, setEnd] = useState(toLocalInput(end0));
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const listAccounts = useServerFn(listCalendarAccounts);
  const syncNow = useServerFn(syncCalendarNow);

  useEffect(() => {
    if (!open) return;
    setAttendee(defaultAttendee);
    void (async () => {
      try {
        const { items } = await listAccounts();
        const active = items?.find((a) => a.sync_enabled);
        setAccountId(active?.id ?? null);
      } catch {
        setAccountId(null);
      }
    })();
  }, [open, defaultAttendee, listAccounts]);

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Informe um título."); return; }
    if (!start || !end) { toast.error("Informe início e fim."); return; }
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    if (new Date(endIso) <= new Date(startIso)) { toast.error("O fim deve ser depois do início."); return; }
    setBusy(true);
    try {
      const attendees = attendee
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
      const payload: Record<string, unknown> = {
        owner_id: user.id,
        type: "meeting",
        subject: title,
        body: description || null,
        due_date: startIso,
        meeting_location: location || null,
        attachments: { attendees, end_at: endIso },
        [relatedKey]: relatedId,
      };
      const { error } = await supabase.from("activities").insert(payload as never);
      if (error) throw new Error(error.message);

      if (accountId) {
        try {
          await syncNow({ data: { id: accountId } });
          toast.success("Reunião criada e sincronizada com o Google Calendar.");
        } catch (e) {
          toast.warning(`Reunião salva. Sincronização Google falhou: ${e instanceof Error ? e.message : "erro"}`);
        }
      } else {
        toast.success("Reunião registrada no CRM.");
      }
      setOpen(false);
      setTitle(""); setDescription(""); setLocation("");
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar reunião.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Marcar reunião
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunião de descoberta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Local / Link</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="https://meet.google.com/..." />
          </div>
          <div>
            <Label>Participantes (e-mails separados por vírgula)</Label>
            <Input value={attendee} onChange={(e) => setAttendee(e.target.value)} placeholder="cliente@empresa.com" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {!accountId && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs flex items-center justify-between gap-2">
              <span>Nenhum Google Calendar conectado — a reunião será salva apenas no CRM.</span>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => { setOpen(false); navigate({ to: "/settings/calendars" }); }}>
                Conectar <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando…" : "Marcar reunião"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
