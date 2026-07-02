// Fase 3 — Enforcement de permissões.
// Server functions para consultar/afirmar permissões do usuário atual.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
}

export type MyPermissionsResult = {
  workspace_id: string | null;
  permissions: string[];
};

/**
 * Retorna todas as permission_keys efetivas do usuário atual no workspace ativo.
 */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPermissionsResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    if (!workspaceId) return { workspace_id: null, permissions: [] };
    const { data, error } = await supabase.rpc("current_user_permissions", {
      _workspace_id: workspaceId,
    });
    if (error) throw new Error(error.message);
    const perms = ((data ?? []) as Array<string | { current_user_permissions: string }>).map(
      (r) => (typeof r === "string" ? r : r.current_user_permissions),
    );
    return { workspace_id: workspaceId, permissions: perms };
  });
