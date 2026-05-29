// Filtro reutilizável de "Responsável" — lista checkboxes com todos os membros do workspace
// + opção "Sem responsável". Use dentro de um <FilterGroup title="Responsável">.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { listWorkspaceMembers } from "@/lib/rotation.functions";

export type OwnerFilterValue = {
  ownerIds: string[];
  includeUnassigned: boolean;
};

export function OwnerFilter({
  value,
  onChange,
}: {
  value: OwnerFilterValue;
  onChange: (next: OwnerFilterValue) => void;
}) {
  const fetchMembers = useServerFn(listWorkspaceMembers);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => fetchMembers(),
    staleTime: 60_000,
  });

  const toggleOwner = (id: string, checked: boolean) => {
    onChange({
      ...value,
      ownerIds: checked
        ? Array.from(new Set([...value.ownerIds, id]))
        : value.ownerIds.filter((x) => x !== id),
    });
  };

  return (
    <div className="space-y-0.5">
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
        <Checkbox
          checked={value.includeUnassigned}
          onCheckedChange={(v) => onChange({ ...value, includeUnassigned: !!v })}
        />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span>Sem responsável</span>
      </label>
      {isLoading ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Carregando…</p>
      ) : members.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum membro</p>
      ) : (
        members.map((m) => {
          const checked = value.ownerIds.includes(m.user_id);
          const label = m.full_name || m.user_id.slice(0, 8);
          return (
            <label
              key={m.user_id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggleOwner(m.user_id, !!v)}
              />
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="truncate">
                {label}
                {m.is_me ? " (eu)" : ""}
              </span>
            </label>
          );
        })
      )}
    </div>
  );
}

/** Constrói cláusula para Supabase: aplica `.in("owner_id", ids)` e/ou `.is("owner_id", null)`. */
export function applyOwnerFilter<T extends { in: Function; is: Function; or: Function }>(
  query: T,
  value: OwnerFilterValue,
): T {
  const hasIds = value.ownerIds.length > 0;
  if (hasIds && value.includeUnassigned) {
    return query.or(`owner_id.in.(${value.ownerIds.join(",")}),owner_id.is.null`) as T;
  }
  if (hasIds) return query.in("owner_id", value.ownerIds) as T;
  if (value.includeUnassigned) return query.is("owner_id", null) as T;
  return query;
}

export const EMPTY_OWNER_FILTER: OwnerFilterValue = { ownerIds: [], includeUnassigned: false };
