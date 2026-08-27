// Histórico de alterações de substatus de Leads e Negócios.
// A origem é a tabela `property_history`, alimentada pelos gatilhos de auditoria
// `leads_audit` / `deals_audit`. A visibilidade é decidida pela RLS do banco.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubstatusHistoryEntry = {
  id: string;
  changed_at: string;
  changed_by: string | null;
  changed_by_name: string | null;
  from_id: string | null;
  to_id: string | null;
  from_name: string | null;
  to_name: string | null;
  from_color: string | null;
  to_color: string | null;
};

/** Evita a inferência custosa do supabase-js sobre a string de select. */
const sel = (s: string): string => s;

type HistoryRow = {
  id: string;
  changed_at: string;
  changed_by: string | null;
  old_value: unknown;
  new_value: unknown;
};

type SubstatusRow = { id: string; name: string; color: string | null };

/** `property_history` guarda os valores como jsonb — normaliza para uuid ou null. */
function asId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0 && value !== "null") return value;
  return null;
}

export async function fetchSubstatusHistory(
  entity: "leads" | "deals",
  entityId: string,
): Promise<SubstatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from("property_history")
    .select(sel("id, changed_at, changed_by, old_value, new_value"))
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .eq("property", "stage_substatus_id")
    .order("changed_at", { ascending: false })
    .limit(50)
    .returns<HistoryRow[]>();
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const substatusIds = Array.from(
    new Set(rows.flatMap((r) => [asId(r.old_value), asId(r.new_value)]).filter(Boolean) as string[]),
  );
  const userIds = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean) as string[]));

  const [substatuses, profiles] = await Promise.all([
    substatusIds.length
      ? supabase
          .from("pipeline_stage_substatuses")
          .select(sel("id, name, color"))
          .in("id", substatusIds)
          .returns<SubstatusRow[]>()
      : Promise.resolve({ data: [] as SubstatusRow[], error: null }),
    userIds.length
      ? supabase
          .from("profiles")
          .select(sel("id, full_name"))
          .in("id", userIds)
          .returns<Array<{ id: string; full_name: string | null }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }>, error: null }),
  ]);

  const subMap = new Map((substatuses.data ?? []).map((s) => [s.id, s]));
  const userMap = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => {
    const fromId = asId(r.old_value);
    const toId = asId(r.new_value);
    const from = fromId ? subMap.get(fromId) : undefined;
    const to = toId ? subMap.get(toId) : undefined;
    return {
      id: r.id,
      changed_at: r.changed_at,
      changed_by: r.changed_by,
      changed_by_name: r.changed_by ? (userMap.get(r.changed_by) ?? null) : null,
      from_id: fromId,
      to_id: toId,
      from_name: from?.name ?? null,
      to_name: to?.name ?? null,
      from_color: from?.color ?? null,
      to_color: to?.color ?? null,
    };
  });
}

export function useSubstatusHistory(entity: "leads" | "deals", entityId?: string | null) {
  return useQuery({
    queryKey: ["substatus-history", entity, entityId ?? "none"],
    enabled: !!entityId,
    staleTime: 30_000,
    queryFn: () => fetchSubstatusHistory(entity, entityId as string),
  });
}

/** Invalida o histórico de substatus após uma alteração. */
export function useInvalidateSubstatusHistory() {
  const qc = useQueryClient();
  return (entity: "leads" | "deals", entityId: string) =>
    void qc.invalidateQueries({ queryKey: ["substatus-history", entity, entityId] });
}
