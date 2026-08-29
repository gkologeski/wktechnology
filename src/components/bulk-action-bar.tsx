import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type BulkActionBarProps = {
  count: number;
  onClear: () => void;
  children: ReactNode;
  /** Total de registros que atendem aos filtros atuais (em todas as páginas). */
  totalMatching?: number;
  /** Acionado para selecionar todos os registros que atendem aos filtros. */
  onSelectAll?: () => void;
  isSelectingAll?: boolean;
};

export function BulkActionBar({
  count,
  onClear,
  children,
  totalMatching,
  onSelectAll,
  isSelectingAll,
}: BulkActionBarProps) {
  const showSelectAll = typeof totalMatching === "number" && totalMatching > count && !!onSelectAll;
  return (
    <div className="fixed bottom-4 inset-x-4 z-40 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Limpar seleção">
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium">
        {count.toLocaleString("pt-BR")} selecionado{count === 1 ? "" : "s"}
      </span>
      {showSelectAll && (
        <Button
          variant="link"
          size="sm"
          className="h-7 px-1 text-xs"
          disabled={isSelectingAll}
          onClick={onSelectAll}
        >
          {isSelectingAll
            ? "Selecionando…"
            : `Selecionar todos os ${totalMatching!.toLocaleString("pt-BR")} registros`}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
