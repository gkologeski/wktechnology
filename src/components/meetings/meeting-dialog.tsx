import { getPublicAppUrl } from "@/lib/app-url";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { listCalendarAccounts, pushActivityToCalendar } from "@/lib/calendar.functions";
import { createMeeting } from "@/lib/meetings.functions";
import { CalendarDays, ExternalLink } from "lucide-react";
import { AttendeePicker, type Attendee } from "./attendee-picker";

type Props = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultAttendee?: string;
  relatedKey:
    | "related_lead_id"
    | "related_contact_id"
    | "related_company_id"
    | "related_deal_id"
    | "related_ticket_id";
  relatedId: string;
  onCreated?: () => void;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingDialog({
  trigger,
  open: openProp,
  onOpenChange,
  defaultAttendee = "",
  relatedKey,
  relatedId,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>(
    defaultAttendee ? [{ email: defaultAttendee }] : [],
  );
  const start0 = new Date(Date.now() + 60 * 60 * 1000);
  const end0 = new Date(start0.getTime() + 30 * 60 * 1000);
  const [start, setStart] = useState(toLocalInput(start0));
  const [end, setEnd] = useState(toLocalInput(end0));
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const listAccounts = useServerFn(listCalendarAccounts);
  const pushToCalendar = useServerFn(pushActivityToCalendar);
  const createMeetingFn = useServerFn(createMeeting);

  useEffect(() => {
    if (!open) return;
    setAttendees(defaultAttendee ? [{ email: defaultAttendee }] : []);
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
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    if (!start || !end) {
      toast.error("Informe início e fim.");
      return;
    }
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    if (new Date(endIso) <= new Date(startIso)) {
      toast.error("O fim deve ser depois do início.");
      return;
    }
    setBusy(true);
    try {
      const attendeesPayload = attendees.map((a) => ({
        email: a.email,
        ...(a.name ? { name: a.name } : {}),
        ...(a.contact_id ? { contact_id: a.contact_id } : {}),
      }));

      // 1) Always create a meeting record (Jitsi room + public token) so a link exists,
      //    regardless of Google Calendar / Meet integration.
      const entityMap: Record<string, "contact" | "lead" | "deal" | "ticket" | undefined> = {
        related_contact_id: "contact",
        related_lead_id: "lead",
        related_deal_id: "deal",
        related_ticket_id: "ticket",
        related_company_id: undefined, // companies have no meeting relation column
      };
      const meetingEntity = entityMap[relatedKey];
      const { meeting } = await createMeetingFn({
        data: {
          title: title,
          scheduled_at: startIso,
          recording_consent: true,
          skip_activity: true,
          ...(meetingEntity ? { entity: meetingEntity, entity_id: relatedId } : {}),
        },
      });
      const origin = getPublicAppUrl();
      const publicLink = `${origin}/meet/${meeting.public_token}`;
      const finalLocation = location.trim() || publicLink;

      const payload: Record<string, unknown> = {
        owner_id: user.id,
        type: "meeting",
        subject: title,
        body: description || null,
        due_date: startIso,
        meeting_location: finalLocation,
        attachments: { attendees: attendeesPayload, end_at: endIso, meet_link: publicLink },
        external_ids: { meeting_id: meeting.id, provider: "jitsi", room_name: meeting.room_name },
        [relatedKey]: relatedId,
      };
      const { data: inserted, error } = await supabase
        .from("activities")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (accountId && inserted?.id) {
        try {
          const r = await pushToCalendar({
            data: { account_id: accountId, activity_id: inserted.id },
          });
          if (r.meet_link) toast.success(`Reunião criada com Google Meet: ${r.meet_link}`);
          else toast.success(`Reunião criada. Link da sala: ${publicLink}`);
        } catch (e) {
          toast.warning(
            `Reunião salva (link: ${publicLink}). Sincronização Google falhou: ${e instanceof Error ? e.message : "erro"}`,
          );
        }
      } else {
        toast.success(`Reunião registrada. Link da sala: ${publicLink}`);
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
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
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reunião de descoberta"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Local / Link</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Deixe em branco para gerar link automaticamente"
            />
          </div>
          <div>
            <Label>Participantes</Label>
            <AttendeePicker value={attendees} onChange={setAttendees} />
          </div>
          <div>
            <Label>Descrição</Label>
            <RichHtmlEditor value={description} onChange={setDescription} minHeight={120} />
          </div>
          {!accountId && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs flex items-center justify-between gap-2">
              <span>
                Nenhum Google Calendar conectado — um link de sala será gerado automaticamente.
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/settings/calendars" });
                }}
              >
                Conectar <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Marcar reunião"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
