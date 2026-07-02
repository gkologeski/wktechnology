// Helper server-side: use dentro de outros server functions (após requireSupabaseAuth)
// para bloquear ações sem a permissão apropriada.
import type { SupabaseClient } from "@supabase/supabase-js";

export class PermissionDeniedError extends Error {
  status = 403;
  permissionKey: string;
  constructor(permissionKey: string) {
    super(`Permissão negada: ${permissionKey}`);
    this.permissionKey = permissionKey;
  }
}

/**
 * Verifica se o usuário atual tem a permissão informada no workspace.
 * Lança PermissionDeniedError se não tiver.
 *
 * Uso típico dentro de um createServerFn com requireSupabaseAuth:
 *   await assertPermission(context.supabase, context.userId, workspaceId, "ats.jobs.create");
 */
export async function assertPermission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  permissionKey: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("user_has_permission", {
    _user_id: userId,
    _workspace_id: workspaceId,
    _permission_key: permissionKey,
  });
  if (error) throw new Error(`Falha ao verificar permissão: ${error.message}`);
  if (!data) throw new PermissionDeniedError(permissionKey);
}

/**
 * Retorna true/false sem lançar. Útil para lógica condicional server-side.
 */
export async function hasPermission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  permissionKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_has_permission", {
    _user_id: userId,
    _workspace_id: workspaceId,
    _permission_key: permissionKey,
  });
  if (error) return false;
  return Boolean(data);
}
