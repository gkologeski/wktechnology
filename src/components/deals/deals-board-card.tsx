import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/crm";
import type { Deal } from "@/lib/db-types";
import { Building2, CalendarDays, User as UserIcon } from "lucide-react";

function initials(s?: string | null) {
  if (!s) return "??";
  return s
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function DealsBoardCard({
  deal,
  companyName,
  contactName,
  ownerName,
  onClick,
}: {
  deal: Deal;
  companyName?: string;
  contactName?: string;
  ownerName?: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  const closeDate = deal.expected_close_date ? new Date(deal.expected_close_date) : null;
  const overdue = closeDate && closeDate.getTime() < Date.now() && !["won", "lost"].includes(String(deal.stage));

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onClick={onClick}
      className="group rounded-md border bg-card p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-[var(--hs-orange)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-tight truncate flex-1">{deal.name}</div>
        {deal.hs_priority && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">{deal.hs_priority}</Badge>
        )}
      </div>

      <div className="mt-1 text-[13px] font-semibold tabular-nums text-foreground">
        {formatCurrency(Number(deal.value), deal.currency)}
      </div>

      {companyName && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{companyName}</span>
        </div>
      )}
      {contactName && (
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
          <UserIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{contactName}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-[var(--hs-text-muted)]"}`}>
          <CalendarDays className="h-3 w-3" />
          <span>{deal.expected_close_date ? formatDate(deal.expected_close_date) : "Sem data"}</span>
        </div>
        <Avatar className="h-5 w-5 text-[9px]">
          <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(ownerName)}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
