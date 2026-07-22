// Helper server-side: use dentro de outros server functions (após requireSupabaseAuth)
// para bloquear ações sem a permissão apropriada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";

export const PERMISSION_DENIED_CODE = "PERMISSION_DENIED";
export const PERMISSION_DENIED_MESSAGE = "Você não tem permissão para esta ação";

export class PermissionDeniedError extends Error {
  status = 403 as const;
  code = PERMISSION_DENIED_CODE;
  permissionKeys: string[];
  constructor(permissionKeys: string[]) {
    // Mensagem padronizada em PT-BR; o client parseia pelo prefixo/código.
    super(`${PERMISSION_DENIED_MESSAGE}: ${permissionKeys.join(" | ")}`);
    this.name = "PermissionDeniedError";
    this.permissionKeys = permissionKeys;
  }
}

async function auditDenial(
  workspaceId: string,
  userId: string,
  permissionKeys: string[],
): Promise<void> {
  // Best-effort: nunca bloqueia o fluxo de resposta ao usuário.
  try {
    let path: string | null = null;
    let userAgent: string | null = null;
    try {
      const req = getRequest();
      path = new URL(req.url).pathname;
      userAgent = req.headers.get("user-agent");
    } catch {
      /* fora de contexto de request */
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_audit_log").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "permission_denied",
      entity_type: "permission",
      details: {
        permission_keys: permissionKeys,
        path,
        user_agent: userAgent,
      } as never,
    } as never);
  } catch {
    /* ignore audit failures */
  }
}

function denyResponse(permissionKeys: string[]): never {
  try {
    setResponseStatus(403);
  } catch {
    /* fora de contexto HTTP (SSR/testes) */
  }
  throw new PermissionDeniedError(permissionKeys);
}

/**
 * Verifica se o usuário atual tem a permissão informada no workspace.
 * Lança PermissionDeniedError (HTTP 403) se não tiver e registra em access_audit_log.
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
    await auditDenial(workspaceId, userId, [permissionKey]);
    denyResponse([permissionKey]);
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
  await auditDenial(workspaceId, userId, permissionKeys);
  denyResponse(permissionKeys);
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
