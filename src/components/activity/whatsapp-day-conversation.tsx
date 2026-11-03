// Conversa do dia (WhatsApp) dentro do card da timeline: balões em ordem.
import { cn } from "@/lib/utils";
import {
  isWaMessageFailed,
  waSenderLabel,
  waTime,
  type WaDayMessage,
} from "@/lib/timeline/whatsapp-day";

export function WhatsAppDayConversation({ messages }: { messages: WaDayMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <ol className="mt-2 flex flex-col gap-1.5" aria-label="Mensagens do dia">
      {messages.map((m) => {
        const inbound = m.direction === "inbound";
        const failed = !inbound && isWaMessageFailed(m);
        return (
          <li key={m.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-1.5 text-sm",
                inbound ? "bg-muted text-foreground" : "bg-primary/10 text-foreground",
                failed && "border border-destructive/60",
              )}
            >
              <div className="text-[11px] text-muted-foreground">
                {waSenderLabel(m)} · {waTime(m.at)}
              </div>
              <p className="whitespace-pre-wrap break-words">{m.body || "—"}</p>
              {failed && (
                <span className="mt-1 inline-block rounded-full bg-destructive/10 px-2 text-[11px] text-destructive">
                  Não entregue{m.error ? ` · ${m.error}` : ""}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
