import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/grid-client-sort";

type Props = {
  label: ReactNode;
  active: boolean;
  dir?: SortDir;
  onSort: () => void;
  className?: string;
  align?: "left" | "right";
};

/** Cabeçalho de coluna clicável com seta de ordenação e aria-sort. */
export function SortableTableHead({ label, active, dir, onSort, className, align }: Props) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "ml-auto flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}
