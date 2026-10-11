// Autorização de ações de gestão em projetos: permissão de workspace OU
// papel "manager" no próprio projeto. Usa o cliente do usuário (RLS).
import type { SupabaseClient } from "@supabase/supabase-js";

async function hasAnyPermission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  keys: string[],
): Promise<boolean> {
  for (const key of keys) {
    const { data } = await supabase.rpc("user_has_permission", {
      _user_id: userId,
      _workspace_id: workspaceId,
      _permission_key: key,
    });
    if (data) return true;
  }
  return false;
}

/** Exige, para cada par (workspace, projeto), permissão ou papel de gestor no projeto. */
export async function assertProjectManagerFor(
  supabase: SupabaseClient,
  userId: string,
  pairs: Array<{ workspace_id: string | null; project_id: string | null }>,
  permissionKeys: string[],
): Promise<void> {
  const seenWs = new Map<string, boolean>();
  for (const p of pairs) {
    if (!p.workspace_id) throw new Error("Sem permissão para esta ação no projeto.");
    let wsOk = seenWs.get(p.workspace_id);
    if (wsOk === undefined) {
      wsOk = await hasAnyPermission(supabase, userId, p.workspace_id, permissionKeys);
      seenWs.set(p.workspace_id, wsOk);
    }
    if (wsOk) continue;
    if (!p.project_id) throw new Error("Sem permissão para esta ação no projeto.");
    const { data: m } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", p.project_id)
      .eq("user_id", userId)
      .eq("role_in_project", "manager")
      .maybeSingle();
    if (!m) throw new Error("Sem permissão para esta ação no projeto.");
  }
}
