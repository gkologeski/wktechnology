import { Inbox, UserCheck, UserX, Flame, Clock3, CheckCircle2, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import type { TicketRow } from "./types";
import { ticketResponsibleId } from "@/lib/entity/responsible";

export type ViewKey = "all" | "mine" | "unassigned" | "urgent" | "overdue" | "closed_today";

const ITEMS: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "Todos abertos", icon: Inbox },
  { key: "mine", label: "Meus abertos", icon: UserCheck },
  { key: "unassigned", label: "Não atribuídos", icon: UserX },
  { key: "urgent", label: "Urgentes", icon: Flame },
  { key: "overdue", label: "Vencidos", icon: Clock3 },
  { key: "closed_today", label: "Fechados hoje", icon: CheckCircle2 },
];

export function filterByView(tickets: TicketRow[], view: ViewKey, userId: string | null) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  switch (view) {
    case "mine":
      return tickets.filter(
        (t) =>
          ticketResponsibleId(t) === userId && t.status !== "closed" && t.status !== "resolved",
      );
    case "unassigned":
      return tickets.filter(
        (t) => !ticketResponsibleId(t) && t.status !== "closed" && t.status !== "resolved",
      );
    case "urgent":
      return tickets.filter((t) => t.priority === "urgent" && t.status !== "closed");
    case "overdue":
      return tickets.filter(
        (t) => t.due_at && new Date(t.due_at).getTime() < now && !t.resolved_at,
      );
    case "closed_today":
      return tickets.filter(
        (t) => t.resolved_at && new Date(t.resolved_at).getTime() >= startOfDay.getTime(),
      );
    case "all":
    default:
      return tickets;
  }
}

export function TicketsSidebar({
  tickets,
  userId,
  current,
  onChange,
}: {
  tickets: TicketRow[];
  userId: string | null;
  current: ViewKey;
  onChange: (v: ViewKey) => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r bg-[var(--hs-surface)] flex flex-col">
      <div className="p-3 border-b">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hs-text-muted)]">
          Visualizações
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {ITEMS.map((it) => {
          const count = filterByView(tickets, it.key, userId).length;
          const Icon = it.icon;
          const active = current === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-[var(--hs-orange)]/10 text-foreground font-medium"
                  : "hover:bg-muted/60 text-foreground/80"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{it.label}</span>
              <span className="text-[11px] tabular-nums text-[var(--hs-text-muted)]">{count}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-[var(--hs-text-muted)]"
          disabled
        >
          <ListFilter className="h-3.5 w-3.5 mr-1.5" /> Nova view (em breve)
        </Button>
      </div>
    </aside>
  );
}
