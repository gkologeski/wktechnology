import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LEGACY_STATUS_LABELS, type LeadStage } from "@/lib/leads/stages";
import { STATUS_TONE, type SortDir } from "@/lib/leads/constants";

export function FilterGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
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

export function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  className,
}: {
  children: React.ReactNode;
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

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("max-w-[260px] truncate border-b px-3 py-2 align-middle", className)}>
      {children}
    </td>
  );
}

export function StagePill({ stage, value }: { stage?: LeadStage; value: string }) {
  const tone = STATUS_TONE[value] ?? STATUS_TONE[stage?.type === "won" ? "qualified" : "new"];
  const label = stage?.label ?? LEGACY_STATUS_LABELS[value] ?? value;
  const color = stage?.color;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        color ? "bg-muted text-foreground" : tone.bg,
        color ? undefined : tone.text,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", color ? undefined : tone.dot)}
        style={color ? { backgroundColor: color } : undefined}
      />
      {label}
    </span>
  );
}

export function ScoreCell({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 75
      ? "from-emerald-500 to-emerald-400"
      : clamped >= 40
        ? "from-amber-500 to-amber-400"
        : "from-rose-500 to-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full bg-gradient-to-r", tone)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-medium tabular-nums">{clamped}</span>
    </div>
  );
}
