import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSalesCapabilities } from "./sales-capabilities.functions";
import type { SalesTable } from "./sales-resources";
import { usePermissions } from "./use-permissions";
const denied = {
  can_view: false,
  can_update: false,
  can_delete: false,
  can_assign: false,
  can_approve: false,
  can_export: false,
  can_manage: false,
  can_share: false,
  can_send: false,
};
export function useSalesCapabilities(table: SalesTable, ids: string[]) {
  const p = usePermissions(),
    fetch = useServerFn(getSalesCapabilities),
    unique = [...new Set(ids)].sort();
  const q = useQuery({
    queryKey: ["sales-capabilities", p.workspaceId, table, unique, [...p.permissions].sort()],
    queryFn: async () => {
      const results = [];
      for (let i = 0; i < unique.length; i += 500)
        results.push(await fetch({ data: { table, ids: unique.slice(i, i + 500) } }));
      return Object.fromEntries(results.flat().map((x) => [x.id, x]));
    },
    enabled: !!p.workspaceId && !p.isLoading && !p.isError && unique.length > 0,
    staleTime: 0,
  });
  return {
    ...q,
    for: (id: string) =>
      (!p.isLoading && !p.isError && !q.isError ? q.data?.[id] : undefined) ?? denied,
  };
}
