/**
 * Hook React para consultar feature flags do workspace atual.
 *
 * Uso:
 *   const enabled = useFeatureFlag("ats.sourcing.multi_posting");
 *   if (!enabled) return <ComingSoonCard />;
 *
 * Rollout gradual: quando rollout_percentage < 100 mas > 0, a flag é
 * considerada ligada para uma fração estável dos usuários (hash determinístico
 * sobre user.id), mantendo a mesma decisão entre sessões.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFeatureFlags } from "@/lib/feature-flags.functions";
import { useAuth } from "@/lib/auth";

function hashUserBucket(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

export function useFeatureFlags() {
  const fetcher = useServerFn(listFeatureFlags);
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
}

export function useFeatureFlag(key: string): {
  enabled: boolean;
  loading: boolean;
  rolloutBucket: number | null;
} {
  const { user } = useAuth();
  const query = useFeatureFlags();
  const flag = query.data?.items.find((f) => f.key === key);

  if (query.isLoading) return { enabled: false, loading: true, rolloutBucket: null };
  if (!flag || !flag.enabled) return { enabled: false, loading: false, rolloutBucket: null };

  const rollout = flag.rollout_percentage ?? 100;
  if (rollout >= 100) return { enabled: true, loading: false, rolloutBucket: 100 };
  if (rollout <= 0) return { enabled: false, loading: false, rolloutBucket: 0 };

  const bucket = user?.id ? hashUserBucket(user.id) : 100;
  return { enabled: bucket < rollout, loading: false, rolloutBucket: bucket };
}
