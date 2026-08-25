import { AssigneeFilter, type AssigneeFilterValue } from "@/components/entity/assignee-filter";
import { ViewModeToggle, type ListViewMode } from "@/components/kanban/view-mode-toggle";

export function JobApplicationsToolbar({
  assignee,
  onAssigneeChange,
  visibleCount,
  totalCount,
  view,
  onViewChange,
}: {
  assignee: AssigneeFilterValue;
  onAssigneeChange: (v: AssigneeFilterValue) => void;
  visibleCount: number;
  totalCount: number;
  view: ListViewMode;
  onViewChange: (v: ListViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AssigneeFilter value={assignee} onChange={onAssigneeChange} className="h-9 w-56" />
        <span className="text-xs text-text-tertiary" aria-live="polite">
          {visibleCount} de {totalCount} candidatura(s)
        </span>
      </div>
      <ViewModeToggle value={view} onChange={onViewChange} />
    </div>
  );
}
