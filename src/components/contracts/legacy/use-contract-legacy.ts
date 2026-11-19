import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContractLegacyState } from "@/lib/contracts/legacy.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { legacyGate, legacyMode } from "@/lib/contracts/legacy-view";

/** Ordinary contract readers get only classification; private details keep their own key. */
export function useContractLegacy(contractId: string) {
  const permissions = usePermissions();
  const { user } = useAuth();
  const load = useServerFn(getContractLegacyState);
  const query = useQuery({
    queryKey: [
      "contract-legacy",
      contractId,
      user?.id,
      permissions.workspaceId,
      [...permissions.permissions].sort(),
    ],
    queryFn: () => load({ data: { contractId } }),
    enabled:
      !!user?.id && !!permissions.workspaceId && !permissions.isLoading && !permissions.isError,
    retry: 1,
    staleTime: 0,
  });
  const mode = permissions.isLoading
    ? "loading"
    : permissions.isError
      ? "error"
      : legacyMode({ isLoading: query.isPending, isError: query.isError, data: query.data });
  return { query, mode, gate: legacyGate(mode) };
}
