import { LayoutGrid, Rows3, Columns3 } from "lucide-react";

import { AssigneeFilter } from "@/components/entity/assignee-filter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterBar } from "@/components/ats/ui";
import {
  DERIVED_STATUS_LABELS,
  type DerivedCandidateStatus,
} from "@/lib/ats/candidate-status.functions";
import { cn } from "@/lib/utils";
import { STATUS_ORDER } from "./candidate-status-pill";
import type { Cand } from "./types";

export function CandidatesFilterBar({
  search,
  onSearchChange,
  rows,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  assignee,
  onAssigneeChange,
  view,
  onViewChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  rows: Cand[];
  statusFilter: DerivedCandidateStatus | "all";
  onStatusFilterChange: (v: DerivedCandidateStatus | "all") => void;
  statusCounts: Record<DerivedCandidateStatus, number>;
  assignee: string;
  onAssigneeChange: (v: string) => void;
  view: "cards" | "table" | "kanban";
  onViewChange: (v: "cards" | "table" | "kanban") => void;
}) {
  return (
    <FilterBar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: "Buscar por nome, email, cargo ou skill…",
      }}
      chips={
        <>
          <button
            type="button"
            onClick={() => onStatusFilterChange("all")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              statusFilter === "all"
                ? "border-border-strong bg-surface-1 text-text-primary"
                : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary",
            )}
          >
            Todos <span className="tabular-nums opacity-70">{rows.length}</span>
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusFilterChange(s)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                statusFilter === s
                  ? "border-border-strong bg-surface-1 text-text-primary"
                  : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary",
              )}
            >
              {DERIVED_STATUS_LABELS[s]}{" "}
              <span className="tabular-nums opacity-70">{statusCounts[s]}</span>
            </button>
          ))}
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <AssigneeFilter
            value={assignee}
            onChange={onAssigneeChange}
            className="h-8 w-44 text-xs"
          />
          <Tabs value={view} onValueChange={(v) => onViewChange(v as "cards" | "table" | "kanban")}>
            <TabsList className="h-8">
              <TabsTrigger value="cards" className="h-7 px-2 text-xs gap-1">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Cards
              </TabsTrigger>
              <TabsTrigger value="table" className="h-7 px-2 text-xs gap-1">
                <Rows3 className="h-3.5 w-3.5" aria-hidden /> Tabela
              </TabsTrigger>
              <TabsTrigger value="kanban" className="h-7 px-2 text-xs gap-1">
                <Columns3 className="h-3.5 w-3.5" aria-hidden /> Kanban
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      }
    />
  );
}
