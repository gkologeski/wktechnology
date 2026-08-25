import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  chips?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * FilterBar shell — created in Wave 0 for future list/table screens.
 * Not yet applied; see docs/ats-design-system.md.
 */
export function FilterBar({ search, chips, actions, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle",
        "bg-surface-2 px-2.5 py-2 shadow-xs",
        className,
      )}
    >
      {search ? (
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-1.5">
          <Search className="h-4 w-4 text-text-tertiary" aria-hidden />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Buscar…"}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-hidden"
          />
        </label>
      ) : null}
      {chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>
      ) : null}
    </div>
  );
}
