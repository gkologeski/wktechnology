// Texto final enviado pelo SDR (puro). Remove qualquer URL escrita pela IA e
// qualquer link de autoagendamento; só o link de videoconferência de uma
// reunião CONFIRMADA e os materiais aprovados entram, adicionados pelo sistema.
import { stripUrls } from "./agent-config";

export const SELF_BOOKING_RE = /\/book\//i;

export function buildOutgoingText(p: {
  reply: string;
  materials: { title: string; url: string }[];
  meeting: { status: string; meetLink: string | null } | null;
}): string {
  const parts = [stripUrls(p.reply)];
  if (
    p.meeting?.status === "confirmed" &&
    p.meeting.meetLink &&
    !SELF_BOOKING_RE.test(p.meeting.meetLink)
  )
    parts.push(`Link da videoconferência: ${p.meeting.meetLink}`);
  for (const m of p.materials) if (!SELF_BOOKING_RE.test(m.url)) parts.push(`${m.title}: ${m.url}`);
  return parts.filter(Boolean).join("\n\n");
}
