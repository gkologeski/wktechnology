// Card do quadro (Kanban) de Leads.
import { useDraggable } from "@dnd-kit/core";
import { Building2, Mail, Phone } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BoardCardCheckbox } from "@/components/kanban/board-card-checkbox";
import { SubstatusQuickPicker } from "@/components/pipelines/substatus-quick-picker";
import type { LeadGridRow } from "@/lib/leads/constants";

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "??"
  );
}

export function LeadsBoardCard({
  lead,
  columnId,
  ownerName,
  pipelineId,
  selectable,
  selected,
  canUpdate,
  onSubstatusChanged,
  onToggleSelect,
  onClick,
}: {
  lead: LeadGridRow;
  columnId: string;
  ownerName?: string;
  pipelineId?: string | null;
  selectable?: boolean;
  selected?: boolean;
  canUpdate?: boolean;
  onSubstatusChanged?: () => void;
  onToggleSelect?: (shift: boolean) => void;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.4 : 1,
      }
    : undefined;

  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
    lead.email ||
    "Lead sem nome";
  const score = typeof lead.score === "number" ? lead.score : null;

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
      className={`group rounded-md border bg-card p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-[var(--hs-orange)] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hs-orange)] ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {selectable && onToggleSelect && (
          <BoardCardCheckbox
            selected={!!selected}
            label={`Selecionar lead ${name}`}
            onToggle={onToggleSelect}
          />
        )}
        <div className="font-medium leading-tight truncate flex-1">{name}</div>
        {score !== null && (
          <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
            {score}
          </Badge>
        )}
      </div>

      <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
        {lead.company_name && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {pipelineId ? (
          <SubstatusQuickPicker
            table="leads"
            rowId={lead.id}
            pipelineId={pipelineId}
            stageValue={columnId}
            value={lead.stage_substatus_id ?? null}
            canUpdate={canUpdate}
            onChanged={onSubstatusChanged}
          />
        ) : (
          <span />
        )}
        {ownerName && ownerName !== "—" && (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">{initials(ownerName)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
