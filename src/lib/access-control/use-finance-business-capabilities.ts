import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceBusinessCapabilities } from "./finance-business.functions";
import { usePermissions } from "./use-permissions";
const denied = {
  can_update: false,
  can_delete: false,
  can_settle: false,
  can_issue: false,
  can_cancel: false,
};
export function useFinanceBusinessCapabilities(
  resource:
    | "invoices"
    | "categories"
    | "bank_accounts"
    | "legal_entities"
    | "legal_entity_groups"
    | "dunning"
    | "charging_templates",
  ids: string[],
) {
  const p = usePermissions(),
    fetch = useServerFn(getFinanceBusinessCapabilities),
    unique = [...new Set(ids)].sort();
  const q = useQuery({
    queryKey: [
      "finance-business-capabilities",
      p.workspaceId,
      resource,
      unique,
      [...p.permissions].sort(),
    ],
    queryFn: async () =>
      Object.fromEntries((await fetch({ data: { resource, ids: unique } })).map((r) => [r.id, r])),
    enabled: !!p.workspaceId && !p.isLoading && !p.isError && unique.length > 0,
    staleTime: 0,
  });
  return { ...q, for: (id: string) => (!q.isError ? q.data?.[id] : undefined) ?? denied };
}
