import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceCapabilities, type FinanceCapability } from "./finance-capabilities.functions";
import { usePermissions } from "./use-permissions";
const denied = {
  can_update: false,
  can_delete: false,
  can_cancel: false,
  can_pay: false,
  can_reverse: false,
};
export function useFinanceCapabilities(ids: string[]) {
  const p = usePermissions();
  const fetch = useServerFn(getFinanceCapabilities);
  const unique = [...new Set(ids)].sort();
  const enabled = !p.isLoading && !p.isError && !!p.workspaceId;
  const q = useQuery({
    queryKey: ["finance-capabilities", p.workspaceId, unique, [...p.permissions].sort()],
    queryFn: async () => {
      const rows: FinanceCapability[] = [];
      for (let i = 0; i < unique.length; i += 200)
        rows.push(...(await fetch({ data: { ids: unique.slice(i, i + 200) } })));
      return Object.fromEntries(rows.map((row) => [row.id, row]));
    },
    enabled: enabled && unique.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return { ...q, for: (id: string) => (enabled && !q.isError ? (q.data?.[id] ?? denied) : denied) };
}
