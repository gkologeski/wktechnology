// Acesso efetivo a módulos do usuário atual.
// Regra: licença do workspace (workspace_modules) ∩ permissões efetivas do usuário.
// Administradores do workspace permanecem irrestritos.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyModuleAccess = {
  workspaceId: string | null;
  /** Módulos habilitados para o workspace (vazio quando não há controle configurado). */
  licensed: string[];
  /** Módulos que o usuário pode acessar. */
  allowed: string[];
  /** true quando não há restrição aplicável (admin ou sem dados). */
  unrestricted: boolean;
};

export const getMyModuleAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyModuleAccess> => {
    const { supabase, userId } = context;
    const { deriveAllowedModules } = await import("@/lib/modules/module-permissions");

    const profile = await supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();
    let workspaceId = (profile.data?.active_workspace_id as string | null) ?? null;
    if (!workspaceId) {
      const member = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      workspaceId = (member.data?.workspace_id as string | null) ?? null;
    }
    if (!workspaceId) {
      return { workspaceId: null, licensed: [], allowed: [], unrestricted: true };
    }

    const admin = await supabase.rpc("is_workspace_admin_v2", {
      _workspace: workspaceId,
      _user: userId,
    });
    if (!admin.error && admin.data === true) {
      return { workspaceId, licensed: [], allowed: [], unrestricted: true };
    }

    const { data: licenseRows } = await supabase
      .from("workspace_modules")
      .select("module_id, enabled")
      .eq("workspace_id", workspaceId);
    const licensed = ((licenseRows ?? []) as Array<{ module_id: string; enabled: boolean }>)
      .filter((r) => r.enabled)
      .map((r) => r.module_id);
    const hasLicenseControl = (licenseRows ?? []).length > 0;

    const agg = await supabase.rpc("current_user_permissions_json", {
      _workspace_id: workspaceId,
    });
    let keys: string[] = Array.isArray(agg.data) ? (agg.data as string[]) : [];
    if (agg.error || keys.length === 0) {
      const fallback = await supabase.rpc("current_user_permissions", {
        _workspace_id: workspaceId,
      });
      keys = ((fallback.data ?? []) as Array<string | { current_user_permissions: string }>).map(
        (r) => (typeof r === "string" ? r : r.current_user_permissions),
      );
    }

    const derived = deriveAllowedModules(keys);
    const allowed = hasLicenseControl ? derived.filter((id) => licensed.includes(id)) : derived;

    return { workspaceId, licensed, allowed, unrestricted: false };
  });
