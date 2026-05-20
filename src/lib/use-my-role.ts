// Hook client-side que retorna o role mais alto do usuário considerando
// todos os workspaces em que ele participa (próprio + equipes).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "manager" | "member";

const RANK: Record<AppRole, number> = { admin: 3, manager: 2, member: 1 };

export function useMyRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>("member");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole("member"); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // Owner do próprio workspace = admin nato.
      // Buscamos também user_roles em outros workspaces e pegamos o mais alto.
      const { data: rows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      let best: AppRole = "admin"; // próprio workspace
      for (const r of rows ?? []) {
        const role = r.role as AppRole;
        if (RANK[role] > RANK[best]) best = role;
      }
      if (!cancelled) { setRole(best); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isManager: role === "admin" || role === "manager",
  };
}
