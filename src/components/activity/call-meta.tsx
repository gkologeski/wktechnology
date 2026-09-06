// Blocos de metadados de chamadas no card da timeline: direção/status extraídos
// do corpo, duração/disposição e player da gravação.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Activity } from "@/lib/db-types";

export const isStructuredCallBody = (a: Activity) =>
  a.type === "call" && !!a.body && /Tipo de Chamada\s*:/i.test(a.body);

export function CallSummaryBadges({ activity: a }: { activity: Activity }) {
  if (!isStructuredCallBody(a) || !a.body) return null;
  const text = a.body.replace(/<[^>]+>/g, "\n");
  const pick = (re: RegExp) => {
    const m = text.match(re);
    return m?.[1]?.trim() ?? null;
  };
  const direction = pick(/Tipo de Chamada\s*:\s*([A-Z]+)/i);
  const from = pick(/De\s*:\s*([+\d\s()-]+?)(?:\s+para|$)/i);
  const to = pick(/para\s+([+\d\s()-]+)/i);
  const status = pick(/Status\s*:\s*([A-Z_]+)/i);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {direction && (
        <Badge variant="outline" className="text-[10px] capitalize">
          {direction.toLowerCase() === "outbound"
            ? "Saída"
            : direction.toLowerCase() === "inbound"
              ? "Entrada"
              : direction.toLowerCase()}
        </Badge>
      )}
      {from && to && (
        <span className="text-muted-foreground tabular-nums">
          {from} → {to}
        </span>
      )}
      {status && (
        <Badge variant="secondary" className="text-[10px] capitalize">
          {status.toLowerCase().replace(/_/g, " ")}
        </Badge>
      )}
    </div>
  );
}

export function CallDurationBadges({ activity: a }: { activity: Activity }) {
  if (a.type !== "call" || (!a.duration_ms && !a.disposition)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {a.disposition && (
        <Badge variant="secondary" className="text-[10px]">
          {a.disposition}
        </Badge>
      )}
      {a.duration_ms != null && a.duration_ms > 0 && (
        <span className="text-muted-foreground">
          {Math.floor(a.duration_ms / 60000)}m {Math.floor((a.duration_ms % 60000) / 1000)}s
        </span>
      )}
    </div>
  );
}

export function CallRecordingPlayer({ activity: a }: { activity: Activity }) {
  if (a.type !== "call") return null;
  const url =
    a.recording_url ||
    (a.body?.match(/https?:\/\/[^\s<"']+\.(?:mp3|wav|ogg|m4a)/i)?.[0] ?? null) ||
    (a.body?.match(/https?:\/\/api\.twilio\.com\/[^\s<"']+/i)?.[0] ?? null);
  if (!url) return null;
  return (
    <div className="mt-3 space-y-1">
      <audio controls preload="none" src={url} className="w-full h-10" />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
      >
        <LinkIcon className="h-3 w-3" /> Abrir gravação
      </a>
    </div>
  );
}

export function EmailStatusBadges({ activity: a }: { activity: Activity }) {
  if (a.type !== "email" || (!a.email_direction && !a.email_status)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {a.email_direction && (
        <Badge variant="outline" className="text-[10px] capitalize">
          {a.email_direction === "inbound"
            ? "recebido"
            : a.email_direction === "outbound"
              ? "enviado"
              : a.email_direction}
        </Badge>
      )}
      {a.email_status && (
        <Badge variant="secondary" className="text-[10px] capitalize">
          {a.email_status}
        </Badge>
      )}
    </div>
  );
}
