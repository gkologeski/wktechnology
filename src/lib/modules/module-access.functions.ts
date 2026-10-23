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

    const { getActiveWorkspaceId } = await import("@/lib/access-control/enforce.server");
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    const member = await supabase.rpc("is_workspace_member", {
      _workspace: workspaceId,
      _user: userId,
    });
    if (member.error) throw new Error("Não foi possível verificar o vínculo com o workspace.");
    if (member.data !== true) throw new Error("Workspace indisponível ou sem vínculo ativo.");

    const admin = await supabase.rpc("is_workspace_admin_v2", {
      _workspace: workspaceId,
      _user: userId,
    });
    if (admin.error) throw new Error("Não foi possível verificar o acesso administrativo.");
    if (admin.data === true) {
      return { workspaceId, licensed: [], allowed: [], unrestricted: true };
    }

    const { data: licenseRows, error: licenseError } = await supabase
      .from("workspace_modules")
      .select("module_id, enabled")
      .eq("workspace_id", workspaceId);
    if (licenseError) throw new Error("Não foi possível consultar as licenças do workspace.");
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
      if (fallback.error) throw new Error("Não foi possível consultar as permissões efetivas.");
      keys = ((fallback.data ?? []) as Array<string | { current_user_permissions: string }>).map(
        (r) => (typeof r === "string" ? r : r.current_user_permissions),
      );
    }

    const derived = deriveAllowedModules(keys);
    const allowed = hasLicenseControl ? derived.filter((id) => licensed.includes(id)) : derived;

    return { workspaceId, licensed, allowed, unrestricted: false };
  });
