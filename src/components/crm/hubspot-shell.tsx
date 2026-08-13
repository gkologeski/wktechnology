import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Plus } from "lucide-react";
import { TablePagination } from "@/components/table-pagination";

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function FiltersSidebar({
  hasActiveFilters,
  onClear,
  children,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/30 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros
        </h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={onClear}
          >
            Limpar tudo
          </Button>
        )}
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
    </aside>
  );
}

export function FilterGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-1">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted">
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        <div className="space-y-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CheckboxFilter({
  label,
  count,
  checked,
  onChange,
  dotClass,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  dotClass?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      {dotClass && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
    </label>
  );
}

export function RadioFilter<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      {options.map(([v, label]) => (
        <label
          key={v}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <input
            type="radio"
            name={name}
            checked={value === v}
            onChange={() => onChange(v)}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span>{label}</span>
        </label>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Views tabs
// ---------------------------------------------------------------------------

export function ViewsTabs<T extends string>({
  views,
  active,
  onChange,
}: {
  views: readonly { id: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={cn(
            "relative shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors",
            active === v.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
          {active === v.id && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
      <Button variant="ghost" size="sm" className="ml-2 shrink-0 text-muted-foreground" disabled>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar visualização
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

export type SortDir = "asc" | "desc";

export function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  className,
}: {
  children?: ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: SortDir;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b px-3 py-2.5 font-semibold",
        sortable && "cursor-pointer select-none hover:text-foreground",
        active && "text-foreground",
        className,
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <ChevronsUpDown
            className={cn(
              "h-3 w-3 opacity-50",
              active && dir === "asc" && "rotate-180 opacity-100",
              active && dir === "desc" && "opacity-100",
            )}
          />
        )}
      </span>
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn("max-w-[260px] truncate border-b px-3 py-2 align-middle", className)}>
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function Pagination({
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  setPage: (n: number | ((p: number) => number)) => void;
  setPageSize: (n: number) => void;
}) {
  return (
    <TablePagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(p) => setPage(p)}
      onPageSizeChange={setPageSize}
    />
  );
}

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

export type Tone = {
  dot: string;
  bg: string;
  text: string;
};

export const TONES: Record<string, Tone> = {
  sky: { dot: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  violet: {
    dot: "bg-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
  },
  emerald: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  rose: { dot: "bg-rose-500", bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300" },
  amber: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
  },
  slate: {
    dot: "bg-slate-400",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-300",
  },
  indigo: {
    dot: "bg-indigo-500",
    bg: "bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    bg: "bg-fuchsia-500/10",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
  },
};

export function Pill({ tone, label }: { tone: keyof typeof TONES | Tone; label: ReactNode }) {
  const t = typeof tone === "string" ? (TONES[tone] ?? TONES.slate) : tone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        t.bg,
        t.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar / helpers
// ---------------------------------------------------------------------------

export function colorFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 45%)`;
}

export function InitialsAvatar({
  text,
  seed,
  size = 7,
}: {
  text: string;
  seed: string;
  size?: 6 | 7;
}) {
  const cls = size === 6 ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[10px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        cls,
      )}
      style={{ background: colorFromString(seed) }}
    >
      {text}
    </span>
  );
}

export { formatDateTime as timeAgo } from "@/lib/crm";

export function HeaderCheckbox({
  allSelected,
  someSelected,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={onToggle}
    />
  );
}
