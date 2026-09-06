// Bloco de metadados de reunião dentro do card da timeline: horário, link de
// acesso, participantes, gravação e ação de resumo por IA.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { CalendarDays, Link as LinkIcon, Mail, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";

type MeetingMeta = {
  attendees?: Array<{ email: string; name?: string; contact_id?: string }>;
  end_at?: string;
  meet_link?: string;
  calendar_html_link?: string;
  recording_url?: string;
};

export function MeetingMetaCard({
  activity: a,
  onSummarize,
}: {
  activity: Activity;
  onSummarize?: (activityId: string) => void;
}) {
  const meta = ((a as unknown as { attachments?: unknown }).attachments ?? {}) as MeetingMeta;
  const ext = ((a as unknown as { external_ids?: Record<string, unknown> }).external_ids ??
    {}) as Record<string, unknown>;
  const loc = (a as unknown as { meeting_location?: string }).meeting_location;
  // Prefer Google Calendar event link (htmlLink). Fall back to meet/Jitsi link.
  const calendarLink =
    meta.calendar_html_link ||
    (typeof ext.gcal_html_link === "string" ? (ext.gcal_html_link as string) : null);
  const joinLink = meta.meet_link || (loc && /^https?:\/\//i.test(loc) ? loc : null);
  const accessLink = calendarLink || joinLink;
  const recordingUrl =
    meta.recording_url ||
    (typeof ext.recording_url === "string" ? (ext.recording_url as string) : null);
  const startD = a.due_date ? new Date(a.due_date) : null;
  const endD = meta.end_at ? new Date(meta.end_at) : null;
  const sameDay = startD && endD && startD.toDateString() === endD.toDateString();
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hasMeetingMeta =
    !!startD ||
    !!joinLink ||
    !!loc ||
    (meta.attendees && meta.attendees.length > 0) ||
    !!accessLink ||
    !!recordingUrl;
  if (!hasMeetingMeta) return null;

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs">
      {startD && (
        <div className="flex items-start gap-2">
          <CalendarDays className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div>
            <div className="font-medium text-foreground">
              {formatDateTime(startD.toISOString())}
              {endD && (
                <span className="text-muted-foreground">
                  {sameDay ? ` – ${timeFmt(endD)}` : ` – ${formatDateTime(endD.toISOString())}`}
                </span>
              )}
            </div>
            {endD && (
              <div className="text-[11px] text-muted-foreground">
                Duração: {Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 60000))} min
              </div>
            )}
          </div>
        </div>
      )}
      {(joinLink || loc) && (
        <div className="flex items-start gap-2">
          <LinkIcon className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            {joinLink ? (
              <a
                href={joinLink}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline break-all"
              >
                {joinLink}
              </a>
            ) : (
              <span className="break-all">{loc}</span>
            )}
          </div>
        </div>
      )}
      {meta.attendees && meta.attendees.length > 0 && (
        <div className="flex items-start gap-2">
          <Users className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="flex flex-wrap gap-1">
            {meta.attendees.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                {p.contact_id ? <User className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                {p.name ? `${p.name} <${p.email}>` : p.email}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {(accessLink || recordingUrl) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {accessLink && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <a href={accessLink} target="_blank" rel="noreferrer">
                Acessar reunião
              </a>
            </Button>
          )}
          {recordingUrl && (
            <>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <a href={recordingUrl} target="_blank" rel="noreferrer">
                  Ver gravação
                </a>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => onSummarize?.(a.id)}
              >
                Resumir reunião
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
