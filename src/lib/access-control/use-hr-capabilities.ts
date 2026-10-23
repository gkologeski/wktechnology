import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getHrCapabilities,
  type HrRecordResource,
  type HrCapability,
} from "./hr-capabilities.functions";
import { usePermissions } from "./use-permissions";

const denied: Omit<HrCapability, "id"> = {
  can_view: false,
  can_update: false,
  can_delete: false,
  can_create_child: false,
  can_edit_settings: false,
};

export function useHrCapabilities(resource: HrRecordResource, ids: string[]) {
  const permissions = usePermissions();
  const fetch = useServerFn(getHrCapabilities);
  const uniqueIds = [...new Set(ids)].sort();
  const enabled = !permissions.isLoading && !permissions.isError && !!permissions.workspaceId;
  const query = useQuery({
    queryKey: [
      "hr-capabilities",
      permissions.workspaceId,
      resource,
      uniqueIds,
      [...permissions.permissions].sort(),
    ],
    queryFn: async () => {
      const rows: HrCapability[] = [];
      // One HTTP/SQL request per 200 rows; bounded concurrency and no per-row HTTP.
      for (let i = 0; i < uniqueIds.length; i += 200) {
        rows.push(...(await fetch({ data: { resource, ids: uniqueIds.slice(i, i + 200) } })));
      }
      return Object.fromEntries(rows.map((row) => [row.id, row]));
    },
    enabled: enabled && uniqueIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return {
    ...query,
    for: (id: string): Omit<HrCapability, "id"> =>
      enabled && !query.isError ? (query.data?.[id] ?? denied) : denied,
  };
}
