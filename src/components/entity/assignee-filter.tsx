import { useCallback, useMemo, useState } from "react";
import { UserCircle2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { cn } from "@/lib/utils";

export const ASSIGNEE_ALL = "__all__";
export const ASSIGNEE_NONE = "__none__";
export const ASSIGNEE_ME = "__me__";

export type AssigneeFilterValue = string;

/**
 * Estado + predicado do filtro de Responsável para telas de lista.
 * Filtra em memória pela coluna `assigned_to` já retornada pela consulta.
 */
export function useAssigneeFilter(initial: AssigneeFilterValue = ASSIGNEE_ALL) {
  const [assignee, setAssignee] = useState<AssigneeFilterValue>(initial);
  const meId = useCurrentUserId();

  const matches = useCallback(
    (row: { assigned_to?: string | null } | null | undefined) => {
      if (assignee === ASSIGNEE_ALL) return true;
      const value = row?.assigned_to ?? null;
      if (assignee === ASSIGNEE_NONE) return value == null;
      if (assignee === ASSIGNEE_ME) return meId != null && value === meId;
      return value === assignee;
    },
    [assignee, meId],
  );

  const filterRows = useCallback(
    <T,>(rows: T[]): T[] =>
      assignee === ASSIGNEE_ALL
        ? rows
        : rows.filter((r) => matches(r as { assigned_to?: string | null })),
    [assignee, matches],
  );

  return { assignee, setAssignee, matches, filterRows, isActive: assignee !== ASSIGNEE_ALL };
}

/** Select compacto de Responsável para barras de filtro. */
export function AssigneeFilter({
  value,
  onChange,
  className,
  label = "Responsável",
  allowedUserIds = null,
  allowAll = true,
}: {
  value: AssigneeFilterValue;
  onChange: (next: AssigneeFilterValue) => void;
  className?: string;
  label?: string;
  /** Restringe as opções aos responsáveis visíveis pelo escopo. `null` = sem restrição. */
  allowedUserIds?: string[] | null;
  /** Quando falso, oculta "Todos os responsáveis" (escopo limitado). */
  allowAll?: boolean;
}) {
  const { data: members = [], isLoading } = useWorkspaceMembers();
  const meId = useCurrentUserId();

  const options = useMemo(
    () =>
      [...members]
        .filter((m) => m.user_id !== meId)
        .filter((m) => !allowedUserIds || allowedUserIds.includes(m.user_id))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "")),
    [members, meId, allowedUserIds],
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-56", className)} aria-label={label}>
        <UserCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ASSIGNEE_ALL}>Todos os responsáveis</SelectItem>}
        {meId && <SelectItem value={ASSIGNEE_ME}>Meus registros</SelectItem>}
        {allowAll && <SelectItem value={ASSIGNEE_NONE}>Sem responsável</SelectItem>}
        {isLoading ? (
          <SelectItem value="__loading__" disabled>
            Carregando…
          </SelectItem>
        ) : (
          options.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || m.user_id.slice(0, 8)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
