import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHrPrivateCapabilities } from "./hr-private.functions";
import type { HrPrivateResource } from "./hr-private.server";
import { usePermissions } from "./use-permissions";

export function useHrPrivateAccess(
  resource: HrPrivateResource,
  id: string | null | undefined,
  parent = false,
) {
  const permissions = usePermissions();
  const fetch = useServerFn(getHrPrivateCapabilities);
  const enabled =
    !!id && !!permissions.workspaceId && !permissions.isLoading && !permissions.isError;
  const query = useQuery({
    queryKey: [
      "hr-private-capabilities",
      permissions.workspaceId,
      resource,
      id,
      parent,
      [...permissions.permissions].sort(),
    ],
    queryFn: () => fetch({ data: { resource, ids: [id!], parent } }),
    enabled,
    staleTime: 0,
  });
  return {
    ...query,
    canView: enabled && !query.isError && query.data?.[0]?.can_view === true,
    canUpdate: enabled && !query.isError && query.data?.[0]?.can_update === true,
  };
}
