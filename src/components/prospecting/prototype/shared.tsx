/** Peças comuns do protótipo de Prospecção (apenas demonstração). */
import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const demo = (what: string) =>
  toast.info(`Demonstração: “${what}” não grava nada neste protótipo.`);

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-md border border-product-divider bg-product-panel p-4 shadow-xs",
        className,
      )}
    >
      {children}
    </section>
  );
}
