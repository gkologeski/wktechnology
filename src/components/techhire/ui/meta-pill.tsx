import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetaPillProps {
  children: ReactNode;
  className?: string;
}

/**
 * MetaPill — pequeno chip neutro para metadados densos (senioridade, modalidade,
 * vínculo, localização, contadores). Presentacional, sem dependências de domínio.
 * Promovido a partir do JobCard para uso em qualquer lista/detalhe do TechHire.
 */
export function MetaPill({ children, className }: MetaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-text-secondary whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
