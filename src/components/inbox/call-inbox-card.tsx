import { Phone } from "lucide-react";
import { WhatsAppMediaBubble } from "@/components/whatsapp/whatsapp-media-bubble";
import { CALL_PREFIX, splitCallInboxBody } from "@/lib/prospecting/calls/call-inbox";

/** Cartão "Ligação" na conversa: situação, resumo, áudio e transcrição expansível. */
export function CallInboxCard({
  body,
  recordingUrl,
}: {
  body: string;
  recordingUrl: string | null;
}) {
  const { head, transcript } = splitCallInboxBody(body);
  const [title, ...rest] = head.split("\n");
  return (
    <div className="space-y-2" aria-label="Ligação do agente de voz">
      <div className="flex items-center gap-2 font-medium">
        <Phone className="h-4 w-4" aria-hidden />
        <span>{title?.replace(`${CALL_PREFIX} · `, "Ligação · ")}</span>
      </div>
      {rest.length ? <div className="whitespace-pre-wrap text-sm">{rest.join("\n")}</div> : null}
      {recordingUrl ? <WhatsAppMediaBubble url={recordingUrl} contentType="audio/wav" /> : null}
      {transcript ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs underline">Ver transcrição completa</summary>
          <div className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs">
            {transcript}
          </div>
        </details>
      ) : null}
    </div>
  );
}
