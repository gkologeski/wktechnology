// Situação dos lembretes de WhatsApp de uma reunião futura, com opção de desligar
// só para esta reunião. Carrega apenas quando renderizado (reuniões futuras).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getMeetingReminderStatus,
  setMeetingRemindersDisabled,
} from "@/lib/whatsapp/meeting-reminders.functions";

const SHORT: Record<number, string> = { 1440: "24h", 180: "3h", 60: "1h", 5: "5 min" };
const STATUS: Record<string, string> = {
  sent: "enviado",
  failed: "falhou",
  skipped: "ignorado",
  sending: "enviando",
};

export function MeetingReminderStatus({ activityId }: { activityId: string }) {
  const getFn = useServerFn(getMeetingReminderStatus);
  const setFn = useServerFn(setMeetingRemindersDisabled);
  const qc = useQueryClient();
  const { canAny } = usePermissions();
  const canEdit = canAny([
    "techsales.meetings.update.own",
    "techsales.meetings.update.team",
    "techsales.meetings.update.workspace",
  ]);
  const key = ["meeting-reminder-status", activityId];
  const q = useQuery({ queryKey: key, queryFn: () => getFn({ data: { activityId } }), retry: 0 });
  const d = q.data;
  if (!d || !d.isMeeting || !d.workspaceEnabled || d.offsets.length === 0) return null;
  const parts = [...d.offsets]
    .sort((a, b) => b - a)
    .map((o) => {
      const s = d.dispatches.find((x) => x.offset_minutes === o);
      return `${SHORT[o] ?? `${o} min`} ${s ? (STATUS[s.status] ?? s.status) : d.disabled ? "desligado" : "agendado"}`;
    });
  const id = `mr-off-${activityId}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <BellRing className="h-3.5 w-3.5 text-primary" aria-hidden />
      <span>Lembretes WhatsApp: {parts.join(" · ")}</span>
      <label htmlFor={id} className="ml-auto flex items-center gap-1.5">
        <Switch
          id={id}
          checked={!d.disabled}
          disabled={!canEdit}
          aria-label="Enviar lembretes desta reunião"
          onCheckedChange={async (on) => {
            try {
              await setFn({ data: { activityId, disabled: !on } });
              await qc.invalidateQueries({ queryKey: key });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Não foi possível alterar.");
            }
          }}
        />
        Enviar
      </label>
    </div>
  );
}
