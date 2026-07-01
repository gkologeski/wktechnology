import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/crm";
import type { Deal } from "@/lib/db-types";
import { Building2, CalendarDays, Clock, User as UserIcon } from "lucide-react";

function initials(s?: string | null) {
  if (!s) return "??";
  return s
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const DEFAULT_CARD_FIELDS = ["value", "company", "contact", "close_date", "owner"];

export const CARD_FIELD_OPTIONS = [
  { key: "value", label: "Valor" },
  { key: "company", label: "Empresa" },
  { key: "contact", label: "Contato" },
  { key: "close_date", label: "Data prevista" },
  { key: "owner", label: "Responsável" },
  { key: "priority", label: "Prioridade" },
];

export function DealsBoardCard({
  deal,
  companyName,
  contactName,
  ownerName,
  fields,
  columnId,
  nextActivityDate,
  onClick,
}: {
  deal: Deal;
  companyName?: string;
  contactName?: string;
  ownerName?: string;
  fields?: string[];
  columnId?: string;
  nextActivityDate?: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.4 : 1,
      }
    : undefined;

  const closeDate = deal.expected_close_date ? new Date(deal.expected_close_date) : null;
  const overdue =
    closeDate && closeDate.getTime() < Date.now() && !["won", "lost"].includes(String(deal.stage));

  const f = fields && fields.length > 0 ? fields : DEFAULT_CARD_FIELDS;
  const has = (k: string) => f.includes(k);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      data-kanban-card
      data-kanban-column={columnId}
      className="group rounded-md border bg-card p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-[var(--hs-orange)] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hs-orange)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-tight truncate flex-1">{deal.name}</div>
        {has("priority") && deal.hs_priority && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
            {deal.hs_priority}
          </Badge>
        )}
      </div>

      {has("value") && (
        <div className="mt-1 text-[13px] font-semibold tabular-nums text-foreground">
          {formatCurrency(Number(deal.value), deal.currency)}
        </div>
      )}

      {has("company") && companyName && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{companyName}</span>
        </div>
      )}
      {has("contact") && contactName && (
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
          <UserIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">{contactName}</span>
        </div>
      )}

      {(has("close_date") || has("owner")) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {has("close_date") ? (
            <div
              className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-[var(--hs-text-muted)]"}`}
            >
              <CalendarDays className="h-3 w-3" />
              <span>
                {deal.expected_close_date ? formatDate(deal.expected_close_date) : "Sem data"}
              </span>
            </div>
          ) : (
            <span />
          )}
          {has("owner") && (
            <Avatar className="h-5 w-5 text-[9px]">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initials(ownerName)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
    </div>
  );
}
