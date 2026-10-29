import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiqueta discreta abaixo do balão com o motivo de não entrega (código/texto original no hover). */
export function DeliveryFailureLabel({
  failure,
  outbound = true,
}: {
  failure: { label: string; detail: string } | null;
  outbound?: boolean;
}) {
  if (!failure) return null;
  return (
    <div className={cn("-mt-1 flex", outbound ? "justify-end" : "justify-start")}>
      <div
        role="status"
        title={failure.detail}
        className="inline-flex max-w-[82%] items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-medium leading-4 text-destructive-foreground sm:max-w-[72%]"
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{failure.label}</span>
      </div>
    </div>
  );
}
