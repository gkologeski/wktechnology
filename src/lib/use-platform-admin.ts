import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIPlatformAdmin } from "@/lib/platform-admin.functions";
import { useAuth } from "@/lib/auth";

export function useIsPlatformAdmin() {
export function useIsPlatformAdmin() {
  const { user, session, loading } = useAuth();
  const fn = useServerFn(amIPlatformAdmin);
  const q = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !loading && !!user && !!session?.access_token,
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: false,
  });
  return { isPlatformAdmin: q.data?.is_admin ?? false, loading: q.isLoading };
}

}
