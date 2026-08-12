// Marcador discreto sobre o ícone/botão de e-mail quando existe rascunho salvo.
import type { ReactNode } from "react";
import { Pencil } from "lucide-react";

export function MessageDraftPin({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      {children}
      {show && (
        <span
          role="img"
          aria-label="Rascunho salvo"
          title="Rascunho salvo"
          className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
        >
          <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
