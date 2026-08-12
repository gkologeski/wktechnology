// Indicador discreto do estado do rascunho automático.
import { Check, Loader2 } from "lucide-react";
import type { DraftStatus } from "@/hooks/use-message-draft";

export function MessageDraftStatus({
  status,
  savedAt,
  className,
}: {
  status: DraftStatus;
  savedAt: string | null;
  className?: string;
}) {
  if (status === "idle") return null;
  const time = savedAt
    ? new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className ?? ""}`}
    >
      {status === "saved" ? (
        <>
          <Check className="h-3 w-3" aria-hidden="true" />
          {time ? `Rascunho salvo às ${time}` : "Rascunho salvo"}
        </>
      ) : (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {status === "loading" ? "Carregando rascunho…" : "Salvando…"}
        </>
      )}
    </span>
  );
}
