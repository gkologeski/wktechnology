import { UserPlus2 } from "lucide-react";

import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { cn } from "@/lib/utils";

/**
 * Campo "Criado por" — somente leitura, padrão HubSpot.
 *
 * O criador do registro (`created_by ?? owner_id`) nunca muda depois da
 * criação; para alterar o responsável use `AssigneeField`.
 */
export function CreatorField({
  creatorId,
  compact = false,
  className,
}: {
  creatorId: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const { nameFor } = useWorkspaceMembers();
  const label = creatorId ? (nameFor(creatorId) ?? "—") : "—";

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-1.5", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <UserPlus2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Criado por</span>
      </div>
      <div className="text-sm text-foreground">{label}</div>
    </div>
  );
}
