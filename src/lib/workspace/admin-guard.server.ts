// Guarda server-only: exige que o usuário seja administrador do workspace
// (owner/admin) ou administrador de plataforma para ações de licenciamento.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export async function isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
  if (!userId || !workspaceId) return false;

  const { data: pa } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (pa) return true;

  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (member as { role?: string | null } | null)?.role ?? null;
  if (role && ADMIN_ROLES.has(role)) return true;

  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("created_by")
    .eq("id", workspaceId)
    .maybeSingle();
  return (ws as { created_by?: string | null } | null)?.created_by === userId;
}

/** Lança erro quando o usuário não é administrador do workspace. */
export async function assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<void> {
  if (!(await isWorkspaceAdmin(userId, workspaceId))) {
    throw new Error(
      "Apenas administradores do workspace podem alterar módulos e planos contratados.",
    );
  }
}
