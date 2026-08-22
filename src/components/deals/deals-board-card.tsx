import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/crm";
import type { Deal } from "@/lib/db-types";
import type { DealSignals } from "@/lib/deals/hot-score";
import { Building2, CalendarDays, Clock, Flame, Gem, User as UserIcon } from "lucide-react";
import { BoardCardCheckbox } from "@/components/kanban/board-card-checkbox";

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
  signals,
  dimmed,
  selectable,
  selected,
  onToggleSelect,
  onClick,
}: {
  deal: Deal;
  companyName?: string;
  contactName?: string;
  ownerName?: string;
  fields?: string[];
  columnId?: string;
  nextActivityDate?: string | null;
  signals?: DealSignals;
  dimmed?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (shift: boolean) => void;
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

  const isHot = !!signals?.isHot;
  const isHighValue = !!signals?.isHighValue;
  const borderStyle: React.CSSProperties = {};
  if (isHot && isHighValue) {
    borderStyle.borderLeft = "2px solid transparent";
    borderStyle.borderImage = "linear-gradient(180deg, var(--hs-orange), var(--hs-stage-4)) 1";
  } else if (isHot) {
    borderStyle.borderLeftWidth = "2px";
    borderStyle.borderLeftColor = "var(--hs-orange)";
  } else if (isHighValue) {
    borderStyle.borderLeftWidth = "2px";
    borderStyle.borderLeftColor = "var(--hs-stage-4)";
  }

  const daysToClose = deal.expected_close_date
    ? Math.round(
        (new Date(deal.expected_close_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ ...style, ...borderStyle }}
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
      data-hot={isHot ? "1" : undefined}
      data-high-value={isHighValue ? "1" : undefined}
      className={`group rounded-md border bg-card p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-[var(--hs-orange)] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hs-orange)] ${dimmed ? "opacity-60" : ""} ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        {selectable && onToggleSelect && (
          <BoardCardCheckbox
            selected={!!selected}
            label={`Selecionar negócio ${deal.name ?? ""}`}
            onToggle={onToggleSelect}
          />
        )}
        <div className="font-medium leading-tight truncate flex-1">{deal.name}</div>
        <div className="flex items-center gap-1 shrink-0">
          {(isHot || isHighValue) && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex items-center gap-0.5"
                    aria-label={isHot ? "Negócio quente" : "Alto valor"}
                  >
                    {isHot && (
                      <Flame
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--hs-orange)" }}
                        aria-hidden
                      />
                    )}
                    {isHighValue && (
                      <Gem
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--hs-stage-4)" }}
                        aria-hidden
                      />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isHot && (
                    <div>
                      Score {signals?.score ?? 0}
                      {daysToClose !== null && daysToClose >= 0 && ` · fecha em ${daysToClose}d`}
                      {daysToClose !== null && daysToClose < 0 && ` · atrasado ${-daysToClose}d`}
                    </div>
                  )}
                  {isHighValue && <div>Top 20% em valor no funil</div>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {has("priority") && deal.hs_priority && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
              {deal.hs_priority}
            </Badge>
          )}
        </div>
      </div>

      {has("value") && (
        <div
          className="mt-1 text-[13px] font-semibold tabular-nums"
          style={isHighValue ? { color: "var(--hs-orange)" } : undefined}
        >
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
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-[var(--hs-text-muted)]"}`}
                title="Data prevista de fechamento"
              >
                <CalendarDays className="h-3 w-3" />
                <span>
                  {deal.expected_close_date ? formatDate(deal.expected_close_date) : "Sem data"}
                </span>
              </div>
              {nextActivityDate && (
                <div
                  className={`flex items-center gap-1 text-xs ${
                    new Date(nextActivityDate).getTime() < Date.now()
                      ? "text-destructive"
                      : "text-[var(--hs-text-muted)]"
                  }`}
                  title="Próxima atividade em aberto"
                >
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(nextActivityDate)}</span>
                </div>
              )}
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
