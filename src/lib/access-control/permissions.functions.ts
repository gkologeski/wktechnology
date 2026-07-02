// Fase 3 — Enforcement de permissões.
// Server functions para consultar/afirmar permissões do usuário atual.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista todas as permission_keys efetivas do usuário atual em um workspace.
 * Considera owner do workspace, cargos e pacotes extras.
 */
export const getMyPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string }) => input)
  .handler(async ({ data, context }): Promise<string[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("current_user_permissions", {
      _workspace_id: data.workspaceId,
    });
    if (error) throw new Error(error.message);
    return (rows as unknown as string[] | null) ?? [];
  });

/**
 * Checa uma permissão específica. Retorna boolean.
 */
export const checkPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workspaceId: string; permissionKey: string }) => input)
  .handler(async ({ data, context }): Promise<boolean> => {
    const { supabase, userId } = context;
    const { data: allowed, error } = await supabase.rpc("user_has_permission", {
      _user_id: userId,
      _workspace_id: data.workspaceId,
      _permission_key: data.permissionKey,
    });
    if (error) throw new Error(error.message);
    return Boolean(allowed);
  });
