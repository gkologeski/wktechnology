// Hook client-side que retorna o role mais alto do usuário considerando
// todos os workspaces em que ele participa (próprio + equipes).
// Usa TanStack Query: uma única consulta compartilhada por todos os
// componentes, guardada por 5 minutos e com uma nova tentativa em falha.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "manager" | "member";

const RANK: Record<AppRole, number> = { admin: 3, manager: 2, member: 1 };

export function pickHighestRole(ownsWorkspace: boolean, roles: readonly string[]): AppRole {
  let best: AppRole = ownsWorkspace ? "admin" : "member";
  for (const r of roles) {
    const role = r as AppRole;
    if (RANK[role] && RANK[role] > RANK[best]) best = role;
  }
  return best;
}

async function fetchMyRole(userId: string): Promise<AppRole> {
  // Owner de algum workspace = admin nato desse workspace.
  const [owned, rows] = await Promise.all([
    supabase.from("workspaces").select("id").eq("created_by", userId).limit(1),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (owned.error) throw owned.error;
  if (rows.error) throw rows.error;
  return pickHighestRole(
    (owned.data ?? []).length > 0,
    (rows.data ?? []).map((r) => r.role),
  );
}

export function useMyRole() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const q = useQuery({
    queryKey: ["my-role", userId],
    queryFn: () => fetchMyRole(userId as string),
    enabled: !authLoading && !!userId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const role: AppRole = q.data ?? "member";
  const loading = authLoading || (!!userId && q.isPending);
  return {
    role,
    loading,
    isError: q.isError,
    refetch: q.refetch,
    isAdmin: role === "admin",
    isManager: role === "admin" || role === "manager",
  };
}
