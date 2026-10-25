import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkCapabilities, type WorkResource } from "./work-core.functions";
import { usePermissions } from "./use-permissions";
const denied = {
  can_view: false,
  can_update: false,
  can_delete: false,
  can_assign: false,
  can_send: false,
  can_cancel: false,
  can_share: false,
  can_manage: false,
};
export function useWorkCapabilities(resource: WorkResource, ids: string[]) {
  const p = usePermissions(),
    fetch = useServerFn(getWorkCapabilities),
    unique = [...new Set(ids)].sort();
  const q = useQuery({
    queryKey: [
      "work-core-capabilities",
      p.workspaceId,
      resource,
      unique,
      [...p.permissions].sort(),
    ],
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < unique.length; i += 500) batches.push(unique.slice(i, i + 500));
      const rows = await Promise.all(batches.map((ids) => fetch({ data: { resource, ids } })));
      return Object.fromEntries(rows.flat().map((x) => [x.id, x]));
    },
    enabled: !!p.workspaceId && !p.isLoading && !p.isError && unique.length > 0,
    staleTime: 0,
  });
  return {
    ...q,
    for: (id: string) =>
      (!p.isError && !p.isLoading && !q.isError ? q.data?.[id] : undefined) ?? denied,
  };
}
