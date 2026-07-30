import { UserCircle2 } from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { cn } from "@/lib/utils";

/** Exibe o nome do responsável (assigned_to) em grids e cards. */
export function AssigneeCell({
  assignedTo,
  className,
  showIcon = true,
  emptyLabel = "Sem responsável",
}: {
  assignedTo: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  emptyLabel?: string;
}) {
  const { nameFor } = useWorkspaceMembers();
  const label = assignedTo ? nameFor(assignedTo) : emptyLabel;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        assignedTo ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {showIcon && <UserCircle2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
