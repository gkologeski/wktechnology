import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listWorkspaceMembers } from "@/lib/rotation.functions";

export function useWorkspaceMembers() {
  const fetchMembers = useServerFn(listWorkspaceMembers);
  const query = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => fetchMembers(),
    staleTime: 60_000,
  });

  const byId = useMemo(() => {
    const map = new Map<string, { full_name: string | null }>();
    (query.data ?? []).forEach((m) => map.set(m.user_id, { full_name: m.full_name ?? null }));
    return map;
  }, [query.data]);

  const nameFor = (id: string | null | undefined): string => {
    if (!id) return "—";
    const m = byId.get(id);
    return m?.full_name?.trim() || `${id.slice(0, 8)}…`;
  };

  const initialsFor = (id: string | null | undefined): string => {
    if (!id) return "—";
    const name = byId.get(id)?.full_name?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const a = parts[0]?.[0] ?? "";
      const b = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "");
      return (a + b).toUpperCase() || "?";
    }
    return id.slice(0, 2).toUpperCase();
  };

  return { ...query, byId, nameFor, initialsFor };
}
