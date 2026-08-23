// Hook client-side que retorna quais ferramentas (tool matrix) o usuário
// tem habilitadas no workspace ATIVO. Usado para esconder/desabilitar UI.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ToolKey =
  | "communicate"
  | "import"
  | "export"
  | "bulk_delete"
  | "manage_workflows"
  | "manage_properties"
  | "manage_pipelines"
  | "access_logs"
  | "manage_integrations"
  | "manage_billing"
  | "manage_users";

export function useMyTools() {
  const { user, loading: authLoading } = useAuth();
  const [tools, setTools] = useState<Record<ToolKey, boolean>>({
    communicate: true,
    import: true,
    export: true,
    bulk_delete: true,
    manage_workflows: true,
    manage_properties: true,
    manage_pipelines: true,
    access_logs: true,
    manage_integrations: true,
    manage_billing: true,
    manage_users: true,
  });
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1) Workspace ativo
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", user.id)
        .maybeSingle();
      const wsId = (prof?.active_workspace_id as string | null) ?? user.id;

      // 2) Papel no workspace atual (modelo vigente: workspace_members).
      //    Donos/admins do workspace mantêm todas as ferramentas.
      const { data: wm } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", wsId)
        .eq("user_id", user.id)
        .maybeSingle();
      const role = (wm?.role as string | null) ?? null;
      const owner = wsId === user.id || role === "owner" || role === "admin";
      if (cancelled) return;
      setIsOwner(owner);

      if (owner) {
        setLoading(false);
        return;
      }

      // 3) Perfil de acesso legado (tool matrix). Quando não existir, as
      //    ferramentas permanecem no padrão permissivo: a decisão final é do
      //    RBAC granular (`Can`) e da RLS, não deste gate legado.
      const { data: tm } = await supabase
        .from("team_members")
        .select("access_profile_id")
        .eq("workspace_owner_id", wsId)
        .eq("member_user_id", user.id)
        .maybeSingle();
      const profileId = (tm?.access_profile_id as string | null) ?? null;
      if (!profileId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: rows } = await supabase
        .from("access_profile_tools")
        .select("tool_key, enabled")
        .eq("profile_id", profileId);
      const next: Record<string, boolean> = {};
      for (const r of rows ?? []) next[r.tool_key as string] = !!r.enabled;
      if (!cancelled) {
        setTools((t) => ({ ...t, ...next }) as Record<ToolKey, boolean>);
        setLoading(false);
      }

    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return {
    tools,
    loading,
    isOwner,
    can: (k: ToolKey) => isOwner || tools[k] !== false,
  };
}
