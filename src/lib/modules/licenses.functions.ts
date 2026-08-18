// Licenças de módulo do workspace ativo (cliente).
// Fonte única para o gate de licenciamento no menu, switcher e rotas.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ModuleLicenses = {
  workspaceId: string | null;
  /** ids de módulo habilitados para o workspace ativo. */
  enabled: string[];
  /**
   * Quando o workspace não possui nenhuma linha de licença, tratamos como
   * "sem controle configurado" e liberamos todos os módulos (compatibilidade).
   */
  unrestricted: boolean;
};

export const getModuleLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModuleLicenses> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");

    let workspaceId: string | null = null;
    try {
      workspaceId = await resolveActiveWorkspace(context.userId);
    } catch {
      return { workspaceId: null, enabled: [], unrestricted: true };
    }

    const { data, error } = await supabaseAdmin
      .from("workspace_modules")
      .select("module_id, enabled")
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ module_id: string; enabled: boolean }>;
    if (rows.length === 0) {
      return { workspaceId, enabled: [], unrestricted: true };
    }
    return {
      workspaceId,
      enabled: rows.filter((r) => r.enabled).map((r) => r.module_id),
      unrestricted: false,
    };
  });
