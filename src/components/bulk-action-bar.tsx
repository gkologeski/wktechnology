import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export type BulkActionBarProps = {
  count: number;
  onClear: () => void;
  children: ReactNode;
};

export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  return (
    <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Limpar seleção">
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium">
        {count} selecionado{count === 1 ? "" : "s"}
      </span>
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
