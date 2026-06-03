import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle, Building2, Clock, User as UserIcon } from "lucide-react";
import type { TicketRow } from "./types";

const PRIORITY_VAR: Record<string, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};

function initials(s?: string | null) {
  if (!s) return "—";
  return s.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function TicketCard({
  ticket,
  contactName,
  companyName,
  ownerName,
  draggable = true,
  active = false,
  onClick,
}: {
  ticket: TicketRow;
  contactName?: string;
  companyName?: string;
  ownerName?: string;
  draggable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    disabled: !draggable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;
  const overdue = ticket.due_at && new Date(ticket.due_at).getTime() < Date.now() && !ticket.resolved_at;
  const priorityColor = PRIORITY_VAR[ticket.priority] ?? "var(--priority-low)";

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      style={style}
      onClick={onClick}
      className={`group relative rounded-md border bg-card p-2.5 text-sm transition-all hover:border-[var(--hs-orange)] hover:shadow-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${active ? "border-[var(--hs-orange)] ring-1 ring-[var(--hs-orange)]" : ""}`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-md"
        style={{ background: priorityColor }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="font-medium leading-tight line-clamp-2 flex-1">{ticket.subject}</div>
        {ticket.priority === "urgent" && (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: priorityColor }} />
        )}
      </div>

      {(contactName || companyName) && (
        <div className="mt-1.5 space-y-0.5 pl-1">
          {contactName && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
              <UserIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{contactName}</span>
            </div>
          )}
          {companyName && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--hs-text-muted)] truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{companyName}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 pl-1">
        <div
          className={`flex items-center gap-1 text-[11px] tabular-nums ${
            overdue ? "text-destructive font-medium" : "text-[var(--hs-text-muted)]"
          }`}
        >
          <Clock className="h-3 w-3" />
          <span>{timeAgo(ticket.created_at)}</span>
          {overdue && <span className="ml-1">• vencido</span>}
        </div>
        <Avatar className="h-5 w-5 text-[9px]" title={ownerName ?? ""}>
          <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(ownerName)}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
