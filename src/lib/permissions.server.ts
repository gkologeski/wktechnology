// Helpers de permissão (server-only).
// Valida ferramentas (tool matrix) e escopos (view/edit/delete) com base em
// access_profiles / access_profile_tools / access_profile_permissions.
// Owner do workspace e platform admins sempre têm acesso total.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ToolKey =
  | "communicate"
  | "import"
  | "export"
  | "bulk_delete"
  | "manage_workflows"
  | "manage_properties"
  | "manage_pipelines"
  | "access_logs"
  | "manage_integrations"
  | "manage_billing"
  | "manage_users";

export type ObjectKey =
  | "contacts" | "companies" | "leads" | "deals" | "quotes" | "products"
  | "tickets" | "tasks" | "notes" | "calls" | "meetings" | "emails" | "activities";

export type ActionKey = "view" | "edit" | "delete";
export type Scope = "none" | "own" | "team" | "all";

/** Resolve o workspace owner para um usuário (espelha billing.functions.resolveWorkspaceOwner). */
export async function resolveWorkspaceOwner(userId: string): Promise<string> {
  const { data: own } = await supabaseAdmin
    .from("workspace_subscriptions")
    .select("workspace_owner_id")
    .eq("workspace_owner_id", userId)
    .maybeSingle();
  if (own) return userId;
  const { data: mem } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("created_by")
      .eq("id", mem.workspace_id)
      .maybeSingle();
    if (ws?.created_by) return ws.created_by as string;
  }
  return userId;
}

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function getAccessProfileId(workspaceOwnerId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("team_members")
    .select("access_profile_id")
    .eq("workspace_owner_id", workspaceOwnerId)
    .eq("member_user_id", userId)
    .maybeSingle();
  return (data?.access_profile_id as string | null) ?? null;
}

/** Retorna true se o usuário pode usar a ferramenta no workspace. */
export async function userHasTool(userId: string, toolKey: ToolKey, workspaceOwnerId?: string): Promise<boolean> {
  const owner = workspaceOwnerId ?? (await resolveWorkspaceOwner(userId));
  if (owner === userId) return true;
  if (await isPlatformAdmin(userId)) return true;

  const profileId = await getAccessProfileId(owner, userId);
  if (!profileId) return false;

  const { data } = await supabaseAdmin
    .from("access_profile_tools")
    .select("enabled")
    .eq("profile_id", profileId)
    .eq("tool_key", toolKey)
    .maybeSingle();
  return !!(data?.enabled);
}

/** Lança erro amigável caso o usuário não tenha a ferramenta. */
export async function requireTool(userId: string, toolKey: ToolKey, workspaceOwnerId?: string): Promise<void> {
  const ok = await userHasTool(userId, toolKey, workspaceOwnerId);
  if (!ok) {
    throw new Error(
      `Permissão negada: sua função não permite "${toolKey}". Peça ao administrador para ajustar seu perfil de acesso.`
    );
  }
}

/** Lê o escopo do usuário para um objeto/ação. */
export async function getUserScope(
  userId: string,
  objectKey: ObjectKey,
  action: ActionKey,
  workspaceOwnerId?: string
): Promise<Scope> {
  const owner = workspaceOwnerId ?? (await resolveWorkspaceOwner(userId));
  if (owner === userId) return "all";
  if (await isPlatformAdmin(userId)) return "all";

  const profileId = await getAccessProfileId(owner, userId);
  if (!profileId) return "none";

  const { data } = await supabaseAdmin
    .from("access_profile_permissions")
    .select("view_scope, edit_scope, delete_scope")
    .eq("profile_id", profileId)
    .eq("object_key", objectKey)
    .maybeSingle();
  if (!data) return "none";
  const col = action === "view" ? "view_scope" : action === "edit" ? "edit_scope" : "delete_scope";
  return ((data as Record<string, unknown>)[col] as Scope) ?? "none";
}

/** Valida ação contra um registro específico (com assigned_user_id). */
export async function assertCanAct(
  userId: string,
  objectKey: ObjectKey,
  action: ActionKey,
  rowOwnerId: string,
  rowAssigneeId: string | null
): Promise<void> {
  if (userId === rowOwnerId) return;
  if (await isPlatformAdmin(userId)) return;
  const scope = await getUserScope(userId, objectKey, action, rowOwnerId);
  if (scope === "all") return;
  if (scope === "team") return; // mesmo workspace já implica
  if (scope === "own" && rowAssigneeId && rowAssigneeId === userId) return;
  throw new Error(`Permissão negada para ${action} em ${objectKey}.`);
}
