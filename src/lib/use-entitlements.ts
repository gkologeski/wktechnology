// Hook React para consultar entitlements do workspace atual.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan } from "@/lib/billing.functions";
import type { EntKey, PlanCode } from "@/lib/entitlements";

export type EntitlementInfo = { limit: number | null; enabled: boolean; used: number };

export function useEntitlements() {
  const fetcher = useServerFn(getMyPlan);
  const query = useQuery({
    queryKey: ["billing", "my-plan"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });

  const ents = query.data?.entitlements ?? {};
  const plan = (query.data?.plan?.code as PlanCode | undefined) ?? "free";

  const info = (key: EntKey | string): EntitlementInfo =>
    ents[key] ?? { limit: 0, enabled: false, used: 0 };

  const can = (key: EntKey | string): boolean => {
    const i = info(key);
    if (!i.enabled) return false;
    if (i.limit === null) return true; // ilimitado
    if (i.limit === 0) return true; // flag booleana ligada
    return i.used < i.limit;
  };

  const isEnabled = (key: EntKey | string): boolean => info(key).enabled;

  const remaining = (key: EntKey | string): number | null => {
    const i = info(key);
    if (i.limit === null) return null;
    return Math.max(0, i.limit - i.used);
  };

  return {
    loading: query.isLoading,
    plan,
    planName: query.data?.plan?.name ?? "Free",
    workspaceOwnerId: query.data?.workspace_owner_id ?? null,
    info,
    can,
    isEnabled,
    remaining,
    refetch: query.refetch,
  };
}
