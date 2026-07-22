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
  if (!data) {
    // Registro de auditoria — best-effort, não bloqueia o fluxo se falhar.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("access_audit_log").insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: "permission_denied",
        entity_type: "permission",
        details: { permission_key: permissionKey } as never,
      } as never);
    } catch {
      /* ignore audit failures */
    }
    throw new PermissionDeniedError(permissionKey);
  }
}

/**
 * Assert que o usuário tem pelo menos UMA das permissões informadas.
 * Útil quando .own OU .workspace concedem a ação.
 */
export async function assertAnyPermission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  permissionKeys: string[],
): Promise<void> {
  for (const key of permissionKeys) {
    const { data } = await supabase.rpc("user_has_permission", {
      _user_id: userId,
      _workspace_id: workspaceId,
      _permission_key: key,
    });
    if (data) return;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_audit_log").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "permission_denied",
      entity_type: "permission",
      details: { permission_keys: permissionKeys } as never,
    } as never);
  } catch {
    /* ignore */
  }
  throw new PermissionDeniedError(permissionKeys.join(" | "));
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

/**
 * Resolve o workspace ativo do usuário atual a partir do perfil.
 * Usado por gates de permissão que precisam do workspace_id.
 */
export async function getActiveWorkspaceId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao resolver workspace ativo: ${error.message}`);
  const ws = (data as { active_workspace_id?: string } | null)?.active_workspace_id;
  if (!ws) throw new Error("Workspace ativo não encontrado");
  return ws;
}

